const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const websiteController = require('../controllers/websiteController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdminAccess, requireEditAccess } = require('../middleware/roleMiddleware');

// Public route to list active companies for front-end selector/dropdowns
router.get('/active', companyController.getActiveCompanies);

// Protected routes for administrative management
router.get('/all', authMiddleware, companyController.getAllCompanies);
router.get('/:idOrSlug', authMiddleware, companyController.getCompanyByIdOrSlug);
router.post('/add', authMiddleware, requireAdminAccess, companyController.createCompany);
router.put('/:id', authMiddleware, requireEditAccess, companyController.updateCompany);
router.delete('/:id', authMiddleware, requireAdminAccess, companyController.deleteCompany);

// Website sub-routes under company
router.get('/:companyId/websites', authMiddleware, websiteController.getWebsitesByCompany);
router.post('/:companyId/websites', authMiddleware, requireAdminAccess, websiteController.createWebsite);

module.exports = router;
