const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for submission
router.post('/query', chatController.submitChatQuery);

// Admin-protected route
router.get('/all', authMiddleware, chatController.getAllChatQueries);

module.exports = router;
