const express = require('express');
const router = express.Router();
const { getAvailableSlots } = require('../controllers/interviewSlotController');

/**
 * @route   GET /api/interview-slots
 * @desc    Candidate-visible endpoint returning only future available interview slots
 * @access  Public / Candidate
 */
router.get('/', getAvailableSlots);

module.exports = router;
