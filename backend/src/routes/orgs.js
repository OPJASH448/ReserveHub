const express = require('express');
const router = express.Router();
const { getPendingOrgs, approveOrg, rejectOrg } = require('../controllers/orgController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get('/pending-orgs', getPendingOrgs);
router.post('/approve-org/:orgId', approveOrg);
router.post('/reject-org/:orgId', rejectOrg);

module.exports = router;
