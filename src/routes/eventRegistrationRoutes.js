const express = require('express');
const router = express.Router();
const eventRegistrationController = require('../controllers/eventRegistrationController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for submission
router.post('/submit', eventRegistrationController.submitRegistration);

// Protected routes for admin
router.get('/all', authMiddleware, eventRegistrationController.getAllRegistrations);

module.exports = router;
