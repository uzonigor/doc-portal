const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');

// ============================================
// FORM ROUTES
// ============================================

// GET sve dostupne forme
router.get('/', formController.getAllForms);

// GET specifičnu formu po ID-u
router.get('/:formId', formController.getFormById);

// POST - Čuva formu (draft)
router.post('/save', formController.saveForm);

// POST - Validira formu
router.post('/validate', formController.validateForm);

module.exports = router;
