const express = require('express');
const router = express.Router();
const { createJoinRequest, getPendingRequestsForResolver, resolveJoinRequest, submitJoinRequestForUser, getMyJoinRequests } = require('../controllers/joinRequestController');
const { authenticateToken } = require('../middleware/auth');

// Public route: potential user requests to join an organization
router.post('/', createJoinRequest);

// Protected routes
router.post('/submit', authenticateToken, submitJoinRequestForUser);
router.get('/my-requests', authenticateToken, getMyJoinRequests);
router.get('/pending', authenticateToken, getPendingRequestsForResolver);
router.post('/:requestId/resolve', authenticateToken, resolveJoinRequest);

module.exports = router;
