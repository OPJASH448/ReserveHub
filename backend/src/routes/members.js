const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Any authenticated org member can list/search users in their org
router.get('/', authenticateToken, async (req, res) => {
  const { q } = req.query;
  try {
    const filter = { orgId: req.user.orgId };
    if (q && q.trim()) {
      const prefix = q.trim();
      filter.$or = [
        { name: { $regex: `^${prefix}`, $options: 'i' } },
        { email: { $regex: `^${prefix}`, $options: 'i' } }
      ];
    }
    const users = await User.find(filter)
      .populate('roleLevelId', 'name rank')
      .select('name email status roleLevelId createdAt')
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
      .select('name email status orgId roleLevelId createdAt updatedAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
