const Booking = require('../models/Booking');
const Resource = require('../models/Resource');
const appEvents = require('../utils/events');

// Booking state transition table
const BOOKING_TRANSITION_TABLE = {
  'held': {
    'confirm': 'confirmed',
    'cancel': 'cancelled',
    'expire': 'expired'
  },
  'confirmed': {
    'cancel': 'cancelled'
  }
};

/**
 * Executes a status transition on a booking based on the transition table.
 */
function getNextStatus(currentStatus, action) {
  const transitions = BOOKING_TRANSITION_TABLE[currentStatus];
  if (!transitions || !transitions[action]) {
    throw new Error(`Invalid state transition: Cannot perform "${action}" on booking with status "${currentStatus}"`);
  }
  return transitions[action];
}

/**
 * Stale holds (older than 5 minutes) are expired.
 * We run this lazily before checking slot availability or creating holds.
 */
const cleanupExpiredBookings = async () => {
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
  const expiredHolds = await Booking.find({
    status: 'held',
    createdAt: { $lt: fiveMinsAgo }
  });

  for (const booking of expiredHolds) {
    try {
      booking.status = 'expired';
      await booking.save();
      // Emit booking:cancelled event to notify waitlist observer
      appEvents.emit('booking:cancelled', {
        resourceId: booking.resourceId,
        slotStart: booking.slotStart
      });
    } catch (err) {
      console.error(`Failed to expire booking ${booking._id}:`, err.message);
    }
  }
};

const holdSlot = async (req, res) => {
  const { resourceId, slotStart } = req.body;
  const { orgId, userId, rank } = req.user;

  if (!resourceId || !slotStart) {
    return res.status(400).json({ error: 'ResourceId and slotStart are required' });
  }

  try {
    // Lazily clean up any expired bookings first
    await cleanupExpiredBookings();

    const parsedStart = new Date(slotStart);
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ error: 'Invalid slotStart timestamp' });
    }

    const resource = await Resource.findOne({ _id: resourceId, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Verify user authority level
    if (rank !== null && rank > resource.maxAllowedRank) {
      return res.status(403).json({ error: 'Access denied: Insufficient authority' });
    }

    // Calculate slotEnd based on duration
    const parsedEnd = new Date(parsedStart.getTime() + resource.slotDurationMinutes * 60 * 1000);

    // Validate operating hours
    const isoDateStr = parsedStart.toISOString().split('T')[0];
    const opStart = new Date(`${isoDateStr}T${resource.operatingHours.start}:00Z`);
    const opEnd = new Date(`${isoDateStr}T${resource.operatingHours.end}:00Z`);

    if (parsedStart < opStart || parsedEnd > opEnd) {
      return res.status(400).json({ error: 'Slot falls outside resource operating hours' });
    }

    // Check if slot is already occupied by a held or confirmed booking
    const existing = await Booking.findOne({
      resourceId,
      slotStart: parsedStart,
      status: { $in: ['held', 'confirmed'] }
    });

    if (existing) {
      return res.status(409).json({ error: 'This slot is already booked or held' });
    }

    const booking = new Booking({
      resourceId,
      userId,
      slotStart: parsedStart,
      slotEnd: parsedEnd,
      status: 'held'
    });

    try {
      await booking.save();
      res.status(201).json(booking);
    } catch (dbErr) {
      // Map E11000 duplicate key error to clean 409 Conflict
      if (dbErr.code === 11000) {
        return res.status(409).json({ error: 'This slot is already booked or held' });
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to hold slot' });
  }
};

const confirmBooking = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the user holding the slot is authorized to confirm it
    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Access denied: You are not the owner of this hold' });
    }

    // Try state machine transition
    try {
      const nextStatus = getNextStatus(booking.status, 'confirm');
      booking.status = nextStatus;
      await booking.save();
      res.json(booking);
    } catch (transErr) {
      return res.status(400).json({ error: transErr.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
};

const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const { userId, rank } = req.user;

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const isOwner = booking.userId.toString() === userId.toString();
    const isAdmin = rank === 0;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to cancel this booking' });
    }

    // Try state machine transition
    try {
      const nextStatus = getNextStatus(booking.status, 'cancel');
      booking.status = nextStatus;
      await booking.save();

      // Emit booking:cancelled event to notify waitlist observer
      appEvents.emit('booking:cancelled', {
        resourceId: booking.resourceId,
        slotStart: booking.slotStart
      });

      res.json(booking);
    } catch (transErr) {
      return res.status(400).json({ error: transErr.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

module.exports = {
  holdSlot,
  confirmBooking,
  cancelBooking,
  cleanupExpiredBookings
};
