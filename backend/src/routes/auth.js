const express = require('express');
const router = express.Router();
const { registerOrg, login, logout } = require('../controllers/authController');

router.post('/register-org', registerOrg);
router.post('/login', login);
router.post('/logout', logout);

module.exports = router;
