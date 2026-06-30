const mongoose = require('mongoose');

const JoinRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  requestedRoleLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoleLevel', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('JoinRequest', JoinRequestSchema);
