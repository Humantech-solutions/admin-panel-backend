const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes are public for submission
router.post('/brochure', salesController.submitSalesBrochure);

// Admin route
router.get('/all', authMiddleware, salesController.getAllSalesMails);

module.exports = router;
