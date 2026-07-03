const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { joinWaitingQueue, getPendingQueueRequests, resolveQueueRequest } = require('../controllers/waitingQueueController');

const router = express.Router();

// Join the waiting queue for an organization
router.post('/join', authenticateToken, joinWaitingQueue);

// Get pending queue requests for current user's org (only accessible to upper rank users)
router.get('/pending', authenticateToken, getPendingQueueRequests);

// Approve or reject a queue request
router.post('/:queueId/resolve', authenticateToken, resolveQueueRequest);

module.exports = router;
