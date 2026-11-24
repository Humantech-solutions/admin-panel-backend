const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/websiteController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdminAccess, requireEditAccess } = require('../middleware/roleMiddleware');

// Public route — active websites for a given company (e.g., used by front-end selectors)
router.get('/active/:companyId', websiteController.getActiveWebsitesByCompany);

// Public route — get embed snippet and installation guide for a website
router.get('/:idOrSlug/embed-code', websiteController.getWebsiteEmbedCode);

// Protected routes for admin
router.get('/all', authMiddleware, websiteController.getAllWebsites);
router.get('/company/:companyId', authMiddleware, websiteController.getWebsitesByCompany);
router.get('/:idOrSlug', authMiddleware, websiteController.getWebsiteByIdOrSlug);
router.post('/add', authMiddleware, requireAdminAccess, websiteController.createWebsite);
router.put('/:id', authMiddleware, requireEditAccess, websiteController.updateWebsite);
router.delete('/:id', authMiddleware, requireAdminAccess, websiteController.deleteWebsite);

module.exports = router;
