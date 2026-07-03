const mongoose = require('mongoose');

const WaitingQueueSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true },
  requestedRoleLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoleLevel', required: true },
  status: { type: String, enum: ['waiting', 'approved', 'rejected'], default: 'waiting' },
  resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  position: { type: Number, default: 0 } // Position in queue (auto-calculated)
}, { timestamps: true });

module.exports = mongoose.model('WaitingQueue', WaitingQueueSchema);
