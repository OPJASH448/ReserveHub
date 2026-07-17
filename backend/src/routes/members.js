const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Any authenticated org member can list/search users in their org
router.get('/', authenticateToken, async (req, res) => {
  const { q } = req.query;
  try {
    const filter = { orgId: req.user.orgId };
    if (typeof q === 'string' && q.trim()) {
      const prefix = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: `^${prefix}`, $options: 'i' } },
        { email: { $regex: `^${prefix}`, $options: 'i' } }
      ];
    }
    const users = await User.find(filter)
      .populate('roleLevelId', 'name rank')
      .select('name email department status roleLevelId createdAt')
      .limit(50)
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get current user's own profile details
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('roleLevelId', 'name rank')
      .select('name email department status orgId roleLevelId createdAt updatedAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// OrgAdmin: update user's department and/or role
router.put('/:userId', authenticateToken, async (req, res) => {
  const { rank, orgId } = req.user;
  const targetId = req.params.userId;
  const { department, roleLevelId } = req.body;

  // Only OrgAdmin can update members
  if (rank !== 0) {
    return res.status(403).json({ error: 'Access denied: Only OrgAdmin can update users' });
  }

  try {
    const target = await User.findOne({ _id: targetId, orgId });
    if (!target) return res.status(404).json({ error: 'User not found in your organization' });

    if (department !== undefined) target.department = department;
    if (roleLevelId !== undefined) {
      const RoleLevel = require('../models/RoleLevel');
      const role = await RoleLevel.findOne({ _id: roleLevelId, orgId });
      if (!role) return res.status(400).json({ error: 'Role not found in your organization' });
      target.roleLevelId = role._id;
    }

    await target.save();
    const updated = await User.findById(target._id).populate('roleLevelId', 'name rank').select('name email department roleLevelId status');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
