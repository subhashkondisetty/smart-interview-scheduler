const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireRole = require('../middleware/roleMiddleware');
const {
  createSlot,
  getAdminSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
} = require('../controllers/interviewSlotController');
const {
  validateCreateSlot,
  validateUpdateSlot,
} = require('../validators/interviewSlotValidator');
const {
  broadcastNotification,
  getAdminNotifications,
} = require('../controllers/notificationController');
const { validateBroadcastNotification } = require('../validators/notificationValidator');
const {
  getAdminResults,
  getAdminResultById,
} = require('../controllers/adminResultController');

const { getAdminDashboard } = require('../controllers/adminDashboardController');
const {
  getAdminCandidates,
  getAdminCandidateById,
  updateCandidateStatus,
  deleteCandidate,
} = require('../controllers/adminCandidateController');

/**
 * @route   GET /api/admin/ping
 * @desc    Placeholder verification endpoint for admin role authorization
 * @access  Private (Admin only)
 */
router.get('/ping', authenticate, requireRole('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin access confirmed',
    data: {
      role: req.user.role,
    },
  });
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard aggregate metrics and platform analytics
 * @access  Private (Admin only)
 */
router.get('/dashboard', authenticate, requireRole('admin'), getAdminDashboard);

/**
 * Candidate Management Routes (Admin only)
 */
router.get('/candidates', authenticate, requireRole('admin'), getAdminCandidates);
router.get('/candidates/:id', authenticate, requireRole('admin'), getAdminCandidateById);
router.patch('/candidates/:id/status', authenticate, requireRole('admin'), updateCandidateStatus);
router.delete('/candidates/:id', authenticate, requireRole('admin'), deleteCandidate);

/**
 * Interview Slot Management Routes (Admin only)
 */
router.post(
  '/interview-slots',
  authenticate,
  requireRole('admin'),
  validateCreateSlot,
  createSlot
);

router.get(
  '/interview-slots',
  authenticate,
  requireRole('admin'),
  getAdminSlots
);

router.get(
  '/interview-slots/:id',
  authenticate,
  requireRole('admin'),
  getSlotById
);

router.put(
  '/interview-slots/:id',
  authenticate,
  requireRole('admin'),
  validateUpdateSlot,
  updateSlot
);

router.delete(
  '/interview-slots/:id',
  authenticate,
  requireRole('admin'),
  deleteSlot
);

const {
  getAdminBookings,
  adminCancelBooking,
  adminRescheduleBooking,
} = require('../controllers/interviewBookingController');
const { validateReschedule } = require('../validators/interviewBookingValidator');

/**
 * Booking Management Routes (Admin only)
 */
router.get(
  '/bookings',
  authenticate,
  requireRole('admin'),
  getAdminBookings
);

router.patch(
  '/bookings/:id/cancel',
  authenticate,
  requireRole('admin'),
  adminCancelBooking
);

router.patch(
  '/bookings/:id/reschedule',
  authenticate,
  requireRole('admin'),
  validateReschedule,
  adminRescheduleBooking
);

const {
  createAssessment,
  getAdminAssessments,
  getAdminAssessmentById,
  updateAssessment,
  deleteAssessment,
  togglePublish,
} = require('../controllers/assessmentController');
const {
  validateCreateAssessment,
  validateUpdateAssessment,
} = require('../validators/assessmentValidator');

/**
 * Assessment Management Routes (Admin only)
 */
router.post(
  '/assessments',
  authenticate,
  requireRole('admin'),
  validateCreateAssessment,
  createAssessment
);

router.get(
  '/assessments',
  authenticate,
  requireRole('admin'),
  getAdminAssessments
);

router.get(
  '/assessments/:id',
  authenticate,
  requireRole('admin'),
  getAdminAssessmentById
);

router.put(
  '/assessments/:id',
  authenticate,
  requireRole('admin'),
  validateUpdateAssessment,
  updateAssessment
);

router.delete(
  '/assessments/:id',
  authenticate,
  requireRole('admin'),
  deleteAssessment
);

router.patch(
  '/assessments/:id/publish',
  authenticate,
  requireRole('admin'),
  togglePublish
);

const {
  createQuestion,
  getAdminQuestions,
  getAdminQuestionById,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const {
  validateCreateQuestion,
  validateUpdateQuestion,
} = require('../validators/questionValidator');

/**
 * Question Management Routes (Admin only)
 * Nested under /assessments/:assessmentId/questions
 */
router.post(
  '/assessments/:assessmentId/questions',
  authenticate,
  requireRole('admin'),
  validateCreateQuestion,
  createQuestion
);

router.get(
  '/assessments/:assessmentId/questions',
  authenticate,
  requireRole('admin'),
  getAdminQuestions
);

router.get(
  '/assessments/:assessmentId/questions/:questionId',
  authenticate,
  requireRole('admin'),
  getAdminQuestionById
);

router.put(
  '/assessments/:assessmentId/questions/:questionId',
  authenticate,
  requireRole('admin'),
  validateUpdateQuestion,
  updateQuestion
);

router.delete(
  '/assessments/:assessmentId/questions/:questionId',
  authenticate,
  requireRole('admin'),
  deleteQuestion
);

/**
 * Admin Notification Routes
 */
router.post(
  '/notifications/broadcast',
  authenticate,
  requireRole('admin'),
  validateBroadcastNotification,
  broadcastNotification
);

router.get(
  '/notifications',
  authenticate,
  requireRole('admin'),
  getAdminNotifications
);

/**
 * Candidate Results Routes (Admin only)
 */
router.get(
  '/results',
  authenticate,
  requireRole('admin'),
  getAdminResults
);

router.get(
  '/results/:id',
  authenticate,
  requireRole('admin'),
  getAdminResultById
);

module.exports = router;
