const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { holdSlot, confirmBooking, cancelBooking, getMyBookings } = require('../controllers/bookingController');

router.use(authenticateToken);

router.get('/my-bookings', getMyBookings);
router.post('/hold', holdSlot);
router.post('/:id/confirm', confirmBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;
