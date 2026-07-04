const Resource = require('../models/Resource');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const User = require('../models/User');

const createResource = async (req, res) => {
  const { name, description, image, quantity, maxAllowedRank, slotDurationMinutes, operatingHours } = req.body;
  const { orgId, userId } = req.user;

  const qty = Number(quantity);
  if (!name || maxAllowedRank === undefined || !slotDurationMinutes || !operatingHours || !operatingHours.start || !operatingHours.end || quantity === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, quantity, maxAllowedRank, slotDurationMinutes, operatingHours' });
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'Quantity must be a positive integer' });
  }

  try {
    const resource = new Resource({
      orgId,
      name,
      description: description || '',
      image: image || '',
      quantity: qty,
      maxAllowedRank,
      slotDurationMinutes,
      operatingHours,
      createdBy: userId
    });

    await resource.save();
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create resource' });
  }
};

const getResources = async (req, res) => {
  const { orgId } = req.user;

  try {
    const resources = await Resource.find({ orgId });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
};

const getResourceById = async (req, res) => {
  const { id } = req.params;
  const { orgId } = req.user;

  try {
    const resource = await Resource.findOne({ _id: id, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
};

const updateResource = async (req, res) => {
  const { id } = req.params;
  const { orgId, rank, userId } = req.user;
  const { name, description, image, quantity, maxAllowedRank, slotDurationMinutes, operatingHours } = req.body;

  try {
    const resource = await Resource.findOne({ _id: id, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Access: user.rank <= Math.floor(resource.maxAllowedRank / 2) OR creator OR admin
    let canAccess = (rank === 0);
    if (!canAccess && resource.createdBy && resource.createdBy.toString() === userId.toString()) {
      canAccess = true;
    }
    if (!canAccess && rank !== null && rank <= Math.floor(resource.maxAllowedRank / 2)) {
      canAccess = true;
    }

    if (!canAccess) {
      return res.status(403).json({ error: `Access denied: your rank (${rank}) cannot edit a resource with max level ${resource.maxAllowedRank}. Requires rank <= ${Math.floor(resource.maxAllowedRank / 2)}` });
    }

    if (name !== undefined) resource.name = name;
    if (description !== undefined) resource.description = description;
    if (image !== undefined) resource.image = image;
    if (quantity !== undefined) resource.quantity = quantity;
    if (maxAllowedRank !== undefined) resource.maxAllowedRank = maxAllowedRank;
    if (slotDurationMinutes !== undefined) resource.slotDurationMinutes = slotDurationMinutes;
    if (operatingHours !== undefined) resource.operatingHours = operatingHours;

    await resource.save();
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update resource' });
  }
};

const deleteResource = async (req, res) => {
  const { id } = req.params;
  const { orgId, rank, userId } = req.user;

  try {
    const resource = await Resource.findOne({ _id: id, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Access: user.rank <= Math.floor(resource.maxAllowedRank / 2) OR creator OR admin
    let canAccess = (rank === 0);
    if (!canAccess && resource.createdBy && resource.createdBy.toString() === userId.toString()) {
      canAccess = true;
    }
    if (!canAccess && rank !== null && rank <= Math.floor(resource.maxAllowedRank / 2)) {
      canAccess = true;
    }

    if (!canAccess) {
      return res.status(403).json({ error: `Access denied: your rank (${rank}) cannot delete a resource with max level ${resource.maxAllowedRank}. Requires rank <= ${Math.floor(resource.maxAllowedRank / 2)}` });
    }

    const result = await Resource.deleteOne({ _id: id, orgId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Resource not found or already deleted' });
    }
    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete resource' });
  }
};

const getResourceSlots = async (req, res) => {
  const { id } = req.params;
  const { orgId, userId } = req.user;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }

  try {
    const resource = await Resource.findOne({ _id: id, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const startTime = new Date(`${date}T${resource.operatingHours.start}:00Z`);
    const endTime = new Date(`${date}T${resource.operatingHours.end}:00Z`);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({ error: 'Invalid operating hours configuration' });
    }

    const bookings = await Booking.find({
      resourceId: id,
      slotStart: { $gte: startTime, $lt: endTime },
      status: { $in: ['held', 'confirmed'] }
    });

    const allWaitlist = await Waitlist.find({
      resourceId: id,
      slotStart: { $gte: startTime, $lt: endTime }
    }).populate('userId', 'name email');

    const slots = [];
    let current = new Date(startTime.getTime());

    while (current < endTime) {
      const slotStart = new Date(current.getTime());
      const slotEnd = new Date(current.getTime() + resource.slotDurationMinutes * 60 * 1000);

      if (slotEnd > endTime) break;

      const activeBooking = bookings.find(b => b.slotStart.getTime() === slotStart.getTime());
      const slotWaitlist = allWaitlist.filter(w => w.slotStart.getTime() === slotStart.getTime());
      const userInWaitlist = slotWaitlist.find(w => w.userId._id.toString() === userId.toString());

      slots.push({
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        available: !activeBooking,
        status: activeBooking ? activeBooking.status : 'open',
        bookingId: activeBooking ? activeBooking._id : null,
        bookingUserId: activeBooking ? activeBooking.userId?.toString() : null,
        waitlistCount: slotWaitlist.length,
        userInWaitlist: !!userInWaitlist,
        waitlistUsers: slotWaitlist.sort((a, b) => a.position - b.position).map(w => ({
          name: w.userId?.name || 'Unknown',
          email: w.userId?.email,
          position: w.position
        }))
      });

      current = slotEnd;
    }

    res.json({ resourceId: id, date, slots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate slots' });
  }
};

module.exports = {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
  getResourceSlots
};
