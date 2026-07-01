const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { holdSlot, confirmBooking, cancelBooking } = require('../controllers/bookingController');

// All booking routes require authentication
router.use(authenticateToken);

router.post('/hold', holdSlot);
router.post('/:id/confirm', confirmBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;
