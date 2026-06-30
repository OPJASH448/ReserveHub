const express = require('express');
const router = express.Router();
const { createJoinRequest, getPendingRequestsForResolver, resolveJoinRequest } = require('../controllers/joinRequestController');
const { authenticateToken } = require('../middleware/auth');

// Public route: potential user requests to join an organization
router.post('/', createJoinRequest);

// Protected routes for current members to list/resolve incoming requests
router.get('/pending', authenticateToken, getPendingRequestsForResolver);
router.post('/:requestId/resolve', authenticateToken, resolveJoinRequest);

module.exports = router;
