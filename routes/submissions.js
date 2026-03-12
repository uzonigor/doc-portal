const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');

// ============================================
// SUBMISSION ROUTES
// ============================================

// GET - Sve submission-e (admin)
router.get('/', submissionController.getAllSubmissions);

// GET - Specifičan submission po ID-u
router.get('/:submissionId', submissionController.getSubmissionById);

// POST - Novi submission
router.post('/create', submissionController.createSubmission);

// PUT - Ažuriraj submission
router.put('/:submissionId', submissionController.updateSubmission);

// POST - Pošalji submission operatoru (email)
router.post('/:submissionId/send', submissionController.sendSubmission);

// GET - Status submission-a
router.get('/:submissionId/status', submissionController.getSubmissionStatus);

// DELETE - Obriši submission (draft)
router.delete('/:submissionId', submissionController.deleteSubmission);

module.exports = router;
