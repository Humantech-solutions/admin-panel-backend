const express = require('express');
const router = express.Router();

const { register, login, verifyMfa, changePassword, setupCompany } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-mfa', verifyMfa);
router.post('/change-password', authMiddleware, changePassword);
router.post('/setup-company', authMiddleware, setupCompany);

module.exports = router;