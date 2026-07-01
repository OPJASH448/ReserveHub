const express = require('express');
const router = express.Router();
const { cleanupExpiredBookings } = require('../controllers/bookingController');

router.post('/expire-holds', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET || 'cron_secret_12345';

  if (!cronSecret || cronSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }

  try {
    await cleanupExpiredBookings();
    res.json({ message: 'Stale holds expired successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to expire stale holds' });
  }
});

module.exports = router;
