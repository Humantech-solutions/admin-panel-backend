const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for submission
router.post('/submit', contactController.submitContact);

// Protected routes for admin
router.get('/all', authMiddleware, contactController.getAllContacts);
router.get('/:id', authMiddleware, contactController.getContactById);
router.patch('/:id/status', authMiddleware, contactController.updateStatus);

module.exports = router;
