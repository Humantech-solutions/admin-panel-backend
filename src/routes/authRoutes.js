const express = require('express');
const router = express.Router();

const { register, login, verifyMfa, changePassword, setupCompany, sendEmailOtp, resetMfaQr, forgotPassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendEmailOtp);
router.post('/reset-mfa-qr', resetMfaQr);
router.post('/forgot-password', forgotPassword);
router.post('/verify-mfa', verifyMfa);
router.post('/change-password', authMiddleware, changePassword);
router.post('/change-password-temp', require('../controllers/authController').changePasswordTemp);
router.post('/setup-company', authMiddleware, setupCompany);

module.exports = router;