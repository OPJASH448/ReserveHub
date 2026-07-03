const mongoose = require('mongoose');

const OrgSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: { type: String, required: true, trim: true }, // Free-text type (e.g., "school", "hospital", "coworking")
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Org', OrgSchema);
