const express = require('express');
const router = express.Router();
const { registerOrg, login, logout, listActiveOrgs, listOrgRoles, register, createOrgForUser, getMyOrgs, switchOrg } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/list-orgs', listActiveOrgs);
router.get('/orgs', listActiveOrgs);
router.get('/org-roles/:orgId', listOrgRoles);
router.get('/orgs/:orgId/roles', listOrgRoles);
router.post('/register-org', registerOrg);
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Authenticated routes
router.post('/create-org', authenticateToken, createOrgForUser);
router.get('/my-orgs', authenticateToken, getMyOrgs);
router.post('/switch-org/:orgId', authenticateToken, switchOrg);

module.exports = router;
