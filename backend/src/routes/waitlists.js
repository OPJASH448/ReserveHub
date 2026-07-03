const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { joinWaitlist } = require('../controllers/waitlistController');
const Waitlist = require('../models/Waitlist');

router.post('/join', authenticateToken, joinWaitlist);

router.get('/resource/:resourceId', authenticateToken, async (req, res) => {
  try {
    const entries = await Waitlist.find({ resourceId: req.params.resourceId })
      .populate('userId', 'name email')
      .sort({ position: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

module.exports = router;
