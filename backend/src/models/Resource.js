const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  maxAllowedRank: { type: Number, required: true }, // Authority ceiling (e.g. users with rank <= maxAllowedRank can book)
  slotDurationMinutes: { type: Number, required: true, default: 60 },
  operatingHours: {
    start: { type: String, required: true }, // e.g. "09:00"
    end: { type: String, required: true }   // e.g. "17:00"
  }
}, { timestamps: true });

module.exports = mongoose.model('Resource', ResourceSchema);
