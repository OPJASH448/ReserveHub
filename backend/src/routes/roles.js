const express = require('express');
const router = express.Router();
const { createRole, getRoles } = require('../controllers/roleController');
const { authenticateToken, requireOrgAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// Only OrgAdmin (rank 0) can create new role levels
router.post('/', requireOrgAdmin, createRole);

// Any authenticated member can read the role level hierarchy
router.get('/', getRoles);

module.exports = router;
