const mongoose = require('mongoose');

const RoleLevelSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true },
  rank: { type: Number, required: true }, // 0 is highest, increasing downward
  parentRoleLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoleLevel', default: null }
}, { timestamps: true });

// Ensure role names are unique per organization
RoleLevelSchema.index({ orgId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RoleLevel', RoleLevelSchema);
