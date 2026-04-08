const express = require('express');
const router = express.Router();

const { register, login, verifyMfa } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-mfa', verifyMfa);

module.exports = router;