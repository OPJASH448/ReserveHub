const appEvents = require('../utils/events');
const Waitlist = require('../models/Waitlist');
const Booking = require('../models/Booking');
const Resource = require('../models/Resource');
const { runWithTransaction } = require('../utils/transaction');

// Listen for booking cancellations/expirations to promote waitlisted users
appEvents.on('booking:cancelled', async ({ resourceId, slotStart }) => {
  console.log(`Event 'booking:cancelled' received for resource: ${resourceId}, slotStart: ${slotStart}`);

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
    }).sort({ position: 1 });

    if (!nextInLine) {
      console.log(`Observer: No users on the waitlist for slot ${parsedStart.toISOString()}`);
      return;
    }

    console.log(`Observer: Promoting waitlisted user ${nextInLine.userId} for slot ${parsedStart.toISOString()}`);

    // Perform promotion inside a transaction to prevent double bookings
    await runWithTransaction(async (session) => {
      // 1. Re-verify the waitlist entry still exists
      const freshWaitlist = await Waitlist.findById(nextInLine._id).session(session);
      if (!freshWaitlist) return;

      // 2. Ensure no active bookings were created concurrently
      const activeBooking = await Booking.findOne({
        resourceId,
        slotStart: parsedStart,
        status: { $in: ['held', 'confirmed'] }
      }).session(session);

      if (activeBooking) {
        console.warn(`Observer aborted: Slot was occupied concurrently by booking ${activeBooking._id}`);
        return;
      }

      // 3. Create the new booking (held status)
      const slotEnd = new Date(parsedStart.getTime() + resource.slotDurationMinutes * 60 * 1000);
      const newBooking = new Booking({
        resourceId,
        userId: freshWaitlist.userId,
        slotStart: parsedStart,
        slotEnd,
        status: 'held'
      });
      await newBooking.save({ session });

      // 4. Delete the promoted waitlist entry
      await Waitlist.deleteOne({ _id: freshWaitlist._id }).session(session);
      console.log(`Observer: Successfully promoted user ${freshWaitlist.userId} to active booking ${newBooking._id}`);
    });
  } catch (err) {
    console.error('Observer: Error processing waitlist promotion:', err.message);
  }
});

console.log('Waitlist Observer successfully registered.');
