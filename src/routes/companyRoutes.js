const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to list active companies for front-end selector/dropdowns
router.get('/active', companyController.getActiveCompanies);

// Protected routes for administrative management
router.get('/all', authMiddleware, companyController.getAllCompanies);
router.get('/:idOrSlug', authMiddleware, companyController.getCompanyByIdOrSlug);
router.post('/add', authMiddleware, companyController.createCompany);
router.put('/:id', authMiddleware, companyController.updateCompany);
router.delete('/:id', authMiddleware, companyController.deleteCompany);

module.exports = router;
