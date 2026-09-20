const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireRole = require('../middleware/roleMiddleware');
const {
  getProfile,
  updateProfile,
  uploadResume,
  deleteResume,
  getResume,
} = require('../controllers/candidateProfileController');
const { getCandidateDashboard } = require('../controllers/candidateDashboardController');
const { validateProfileUpdate } = require('../validators/candidateValidator');
const { uploadResumeMiddleware } = require('../middleware/upload');

/**
 * @route   GET /api/candidate/ping
 * @desc    Placeholder verification endpoint for candidate role authorization
 * @access  Private (Candidate only)
 */
router.get('/ping', authenticate, requireRole('candidate'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Candidate access confirmed',
    data: {
      role: req.user.role,
    },
  });
});

/**
 * @route   GET /api/candidate/dashboard
 * @desc    Get candidate aggregated dashboard data
 * @access  Private (Candidate only)
 */
router.get('/dashboard', authenticate, requireRole('candidate'), getCandidateDashboard);

/**
 * @route   GET /api/candidate/profile
 * @desc    Get authenticated candidate's profile
 * @access  Private (Candidate only)
 */
router.get('/profile', authenticate, requireRole('candidate'), getProfile);

/**
 * @route   PUT /api/candidate/profile
 * @desc    Update authenticated candidate's profile
 * @access  Private (Candidate only)
 */
router.put('/profile', authenticate, requireRole('candidate'), validateProfileUpdate, updateProfile);

/**
 * @route   POST /api/candidate/profile/resume
 * @desc    Upload or replace candidate resume
 * @access  Private (Candidate only)
 */
router.post(
  '/profile/resume',
  authenticate,
  requireRole('candidate'),
  uploadResumeMiddleware,
  uploadResume
);

/**
 * @route   DELETE /api/candidate/profile/resume
 * @desc    Delete candidate resume
 * @access  Private (Candidate only)
 */
router.delete('/profile/resume', authenticate, requireRole('candidate'), deleteResume);

const {
  bookSlot,
  getCandidateBookings,
  cancelBooking,
  rescheduleBooking,
} = require('../controllers/interviewBookingController');
const {
  validateBookSlot,
  validateReschedule,
} = require('../validators/interviewBookingValidator');

/**
 * @route   GET /api/candidate/profile/resume
 * @desc    Retrieve/download authenticated candidate's resume
 * @access  Private (Candidate only)
 */
router.get('/profile/resume', authenticate, requireRole('candidate', 'admin'), getResume);

/**
 * Booking Management Routes (Candidate only)
 */
router.post('/bookings', authenticate, requireRole('candidate'), validateBookSlot, bookSlot);
router.get('/bookings', authenticate, requireRole('candidate'), getCandidateBookings);
router.patch('/bookings/:id/cancel', authenticate, requireRole('candidate'), cancelBooking);
router.patch(
  '/bookings/:id/reschedule',
  authenticate,
  requireRole('candidate'),
  validateReschedule,
  rescheduleBooking
);

const {
  startAssessmentAttempt,
  submitAssessmentAttempt,
  getCandidateAttempts,
  getAttemptById,
  getAttemptResult,
  getAssessmentHistory,
  getTopicWisePerformance,
} = require('../controllers/assessmentAttemptController');
const { validateAttemptSubmit } = require('../validators/assessmentAttemptValidator');

/**
 * Assessment Attempt & Analytics Routes (Candidate only)
 */
router.get(
  '/assessments/history',
  authenticate,
  requireRole('candidate'),
  getAssessmentHistory
);
router.post(
  '/assessments/:id/start',
  authenticate,
  requireRole('candidate'),
  startAssessmentAttempt
);
router.get(
  '/performance/topic-wise',
  authenticate,
  requireRole('candidate'),
  getTopicWisePerformance
);
router.get(
  '/attempts',
  authenticate,
  requireRole('candidate'),
  getCandidateAttempts
);
router.get(
  '/attempts/:attemptId/result',
  authenticate,
  requireRole('candidate'),
  getAttemptResult
);
router.get(
  '/attempts/:attemptId',
  authenticate,
  requireRole('candidate'),
  getAttemptById
);
router.post(
  '/attempts/:attemptId/submit',
  authenticate,
  requireRole('candidate'),
  validateAttemptSubmit,
  submitAssessmentAttempt
);

module.exports = router;


