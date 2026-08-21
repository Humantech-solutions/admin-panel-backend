const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/websiteController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route — active websites for a given company (e.g., used by front-end selectors)
router.get('/active/:companyId', websiteController.getActiveWebsitesByCompany);

// Protected routes for admin
router.get('/all', authMiddleware, websiteController.getAllWebsites);
router.get('/company/:companyId', authMiddleware, websiteController.getWebsitesByCompany);
router.get('/:idOrSlug', authMiddleware, websiteController.getWebsiteByIdOrSlug);
router.post('/add', authMiddleware, websiteController.createWebsite);
router.put('/:id', authMiddleware, websiteController.updateWebsite);
router.delete('/:id', authMiddleware, websiteController.deleteWebsite);

module.exports = router;
