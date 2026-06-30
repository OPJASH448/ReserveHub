const express = require('express');
const router = express.Router();
const { registerOrg, login, refresh, logout } = require('../controllers/authController');

router.post('/register-org', registerOrg);
router.post('/login', login);
router.post('/token', refresh);
router.post('/logout', logout);

module.exports = router;
