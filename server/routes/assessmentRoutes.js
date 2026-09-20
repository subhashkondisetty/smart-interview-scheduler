const express = require('express');
const router = express.Router();
const {
  getPublishedAssessments,
  getPublishedAssessmentById,
} = require('../controllers/assessmentController');
const { getCandidateQuestions } = require('../controllers/questionController');

/**
 * Candidate Discovery Routes (Published Assessments only)
 */
router.get('/', getPublishedAssessments);
router.get('/:id', getPublishedAssessmentById);
router.get('/:id/questions', getCandidateQuestions);

module.exports = router;
