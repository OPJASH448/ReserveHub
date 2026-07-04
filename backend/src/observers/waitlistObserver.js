const appEvents = require('../utils/events');
const Waitlist = require('../models/Waitlist');
const Booking = require('../models/Booking');
const Resource = require('../models/Resource');
const { runWithTransaction } = require('../utils/transaction');

// Listen for booking cancellations/expirations to promote waitlisted users
const handleSlotReleased = async ({ resourceId, slotStart }, eventName) => {
  console.log(`Event '${eventName}' received for resource: ${resourceId}, slotStart: ${slotStart}`);

  try {
    const parsedStart = new Date(slotStart);
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      console.warn(`Observer: Resource ${resourceId} not found.`);
      return;
    }

    // Find the next user in line on the waitlist
    const nextInLine = await Waitlist.findOne({
      resourceId,
      slotStart: parsedStart
    }).populate('userId', 'rank').sort({ position: 1 });

    if (!nextInLine) {
      console.log(`Observer: No users on the waitlist for slot ${parsedStart.toISOString()}`);
      return;
    }

    console.log(`Observer: Promoting waitlisted user ${nextInLine.userId._id} for slot ${parsedStart.toISOString()}`);

    // Perform promotion inside a transaction to prevent double bookings
    await runWithTransaction(async (session) => {
      // 1. Re-verify the waitlist entry still exists
      const freshWaitlist = await Waitlist.findById(nextInLine._id).populate('userId', 'rank').session(session);
      if (!freshWaitlist) return;

      // 2. Verify the waitlisted user's rank still qualifies for this resource
      const userRank = freshWaitlist.userId?.rank;
      if (userRank !== null && userRank !== undefined && userRank > resource.maxAllowedRank) {
        console.warn(`Observer: User ${freshWaitlist.userId._id} rank ${userRank} exceeds resource max ${resource.maxAllowedRank}; skipping promotion and removing from waitlist`);
        await Waitlist.deleteOne({ _id: freshWaitlist._id }).session(session);
        return;
      }

      // 3. Ensure no active bookings were created concurrently
      const activeBooking = await Booking.findOne({
        resourceId,
        slotStart: parsedStart,
        status: { $in: ['held', 'confirmed'] }
      }).session(session);

      if (activeBooking) {
        console.warn(`Observer aborted: Slot was occupied concurrently by booking ${activeBooking._id}`);
        return;
      }

      // 4. Create the new booking (held status)
      const slotEnd = new Date(parsedStart.getTime() + resource.slotDurationMinutes * 60 * 1000);
      const newBooking = new Booking({
        resourceId,
        userId: freshWaitlist.userId._id,
        slotStart: parsedStart,
        slotEnd,
        status: 'held'
      });
      await newBooking.save({ session });

      // 5. Delete the promoted waitlist entry
      await Waitlist.deleteOne({ _id: freshWaitlist._id }).session(session);
      console.log(`Observer: Successfully promoted user ${freshWaitlist.userId._id} to active booking ${newBooking._id}`);
    });
  } catch (err) {
    console.error('Observer: Error processing waitlist promotion:', err.message);
  }
};

appEvents.on('booking:cancelled', (payload) => handleSlotReleased(payload, 'booking:cancelled'));
appEvents.on('booking:expired', (payload) => handleSlotReleased(payload, 'booking:expired'));

console.log('Waitlist Observer successfully registered.');
