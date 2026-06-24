const express = require('express');
const router = express.Router();
const careerController = require('../controllers/careerController');
const authMiddleware = require('../middleware/authMiddleware');
const handleResumeUpload = require('../middleware/uploadMiddleware');

// Public route for submission
router.post('/apply', handleResumeUpload, careerController.submitApplication);
router.post('/brochure', careerController.submitBrochureRequest);

// Protected routes for admin
router.get('/all', authMiddleware, careerController.getAllApplications);
router.get('/:id', authMiddleware, careerController.getApplicationById);

module.exports = router;
