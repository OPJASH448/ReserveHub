const mongoose = require('mongoose');

const OrgSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: { type: String, required: true, trim: true }, // Free-text type (e.g., "school", "hospital", "coworking")
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Org', OrgSchema);
