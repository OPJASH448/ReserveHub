const Waitlist = require('../models/Waitlist');
const Resource = require('../models/Resource');
const Booking = require('../models/Booking');

const joinWaitlist = async (req, res) => {
  const { resourceId, slotStart } = req.body;
  const { orgId, userId, rank } = req.user;

  if (!resourceId || !slotStart) {
    return res.status(400).json({ error: 'ResourceId and slotStart are required' });
  }

  try {
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

    // Validate that the slot is actually booked/held (i.e. occupied)
    const occupied = await Booking.findOne({
      resourceId,
      slotStart: parsedStart,
      status: { $in: ['held', 'confirmed'] }
    });

    if (!occupied) {
      return res.status(400).json({ error: 'This slot is currently open. You should book it directly instead of waitlisting.' });
    }

    // Ensure the user is not already on the waitlist for this slot
    const existing = await Waitlist.findOne({
      resourceId,
      slotStart: parsedStart,
      userId
    });

    if (existing) {
      return res.status(400).json({ error: 'You are already on the waitlist for this slot' });
    }

    // Calculate position in the queue with retry for race conditions
    let waitlistEntry;
    for (let attempt = 0; attempt < 3; attempt++) {
      const lastEntry = await Waitlist.findOne({
        resourceId,
        slotStart: parsedStart
      }).sort({ position: -1 });

      const position = lastEntry ? lastEntry.position + 1 : 1;

      waitlistEntry = new Waitlist({
        resourceId,
        userId,
        slotStart: parsedStart,
        position
      });

      try {
        await waitlistEntry.save();
        break;
      } catch (saveErr) {
        if (saveErr.code === 11000 && attempt < 2) {
          continue;
        }
        throw saveErr;
      }
    }

    res.status(201).json(waitlistEntry);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'You are already on the waitlist for this slot' });
    }
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
};

module.exports = {
  joinWaitlist
};
