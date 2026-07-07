const express = require('express');
const router = express.Router();
const documentRequestController = require('../controllers/documentRequestController');
const authMiddleware = require('../middleware/authMiddleware');
const handleDocumentUpload = require('../middleware/documentUploadMiddleware');

// Public route to request resource downloads (supports multipart/form-data upload and JSON)
router.post('/request', handleDocumentUpload, documentRequestController.submitDocumentRequest);

// Protected routes for administrator management
router.get('/requests', authMiddleware, documentRequestController.getAllRequests);

module.exports = router;
