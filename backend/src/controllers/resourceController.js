const Resource = require('../models/Resource');
const Booking = require('../models/Booking');

const createResource = async (req, res) => {
  const { name, description, maxAllowedRank, slotDurationMinutes, operatingHours } = req.body;
  const { orgId } = req.user;

  if (!name || maxAllowedRank === undefined || !slotDurationMinutes || !operatingHours || !operatingHours.start || !operatingHours.end) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const resource = new Resource({
      orgId,
      name,
      description: description || '',
      maxAllowedRank,
      slotDurationMinutes,
      operatingHours
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
  const { orgId } = req.user;
  const { name, description, maxAllowedRank, slotDurationMinutes, operatingHours } = req.body;

  try {
    const resource = await Resource.findOne({ _id: id, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (name !== undefined) resource.name = name;
    if (description !== undefined) resource.description = description;
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
  const { orgId } = req.user;

  try {
    const result = await Resource.deleteOne({ _id: id, orgId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete resource' });
  }
};

const getResourceSlots = async (req, res) => {
  const { id } = req.params;
  const { orgId } = req.user;
  const { date } = req.query; // Expecting YYYY-MM-DD

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }

  try {
    const resource = await Resource.findOne({ _id: id, orgId });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Parse operating hours in standard ISO UTC representation for test reliability
    const startTime = new Date(`${date}T${resource.operatingHours.start}:00Z`);
    const endTime = new Date(`${date}T${resource.operatingHours.end}:00Z`);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({ error: 'Invalid operating hours configuration' });
    }

    // Fetch existing active bookings for this date range
    const bookings = await Booking.find({
      resourceId: id,
      slotStart: { $gte: startTime, $lt: endTime },
      status: { $in: ['held', 'confirmed'] }
    });

    const slots = [];
    let current = new Date(startTime.getTime());

    while (current < endTime) {
      const slotStart = new Date(current.getTime());
      const slotEnd = new Date(current.getTime() + resource.slotDurationMinutes * 60 * 1000);

      if (slotEnd > endTime) {
        break;
      }

      // Check if slot overlaps with an active booking
      const activeBooking = bookings.find(b => b.slotStart.getTime() === slotStart.getTime());

      slots.push({
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        available: !activeBooking,
        status: activeBooking ? activeBooking.status : 'open',
        bookingId: activeBooking ? activeBooking._id : null
      });

      current = slotEnd;
    }

    res.json({
      resourceId: id,
      date,
      slots
    });
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
