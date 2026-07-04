const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotStart: { type: Date, required: true },
  slotEnd: { type: Date, required: true },
  status: { type: String, enum: ['open', 'held', 'confirmed', 'expired', 'cancelled'], default: 'held' }
}, { timestamps: true });

// Prevent double bookings at the database layer for active bookings (held, confirmed, open)
BookingSchema.index(
  { resourceId: 1, slotStart: 1 },
  { 
    unique: true, 
    partialFilterExpression: { status: { $in: ['held', 'confirmed'] } } 
  }
);

module.exports = mongoose.model('Booking', BookingSchema);
