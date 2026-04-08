const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// All routes are public for submission
router.post('/brochure', salesController.submitSalesBrochure);

// Admin route (auth omitted for now to match other routes or you can add if available)
router.get('/all', salesController.getAllSalesMails);

module.exports = router;
