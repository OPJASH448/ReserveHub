const mongoose = require('mongoose');

const WaitlistSchema = new mongoose.Schema({
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotStart: { type: Date, required: true },
  position: { type: Number, required: true }
}, { timestamps: true });

// Ensure a user can only be on the waitlist once per slot start
WaitlistSchema.index({ resourceId: 1, slotStart: 1, userId: 1 }, { unique: true });

// Ensure position is ordered and unique per slot
WaitlistSchema.index({ resourceId: 1, slotStart: 1, position: 1 }, { unique: true });

module.exports = mongoose.model('Waitlist', WaitlistSchema);
