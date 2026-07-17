const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', default: null },
  roleLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoleLevel', default: null },
  department: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
  isSuperAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
