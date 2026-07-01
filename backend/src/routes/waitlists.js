const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { joinWaitlist } = require('../controllers/waitlistController');

router.post('/join', authenticateToken, joinWaitlist);

module.exports = router;
