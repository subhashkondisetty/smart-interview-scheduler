const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');
const { validateNotificationId } = require('../validators/notificationValidator');

/**
 * @route   GET /api/notifications
 * @desc    Get authenticated user's own notifications (paginated)
 * @access  Private
 */
router.get('/', authenticate, getUserNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all unread notifications as read for authenticated user
 * @access  Private
 */
router.patch('/read-all', authenticate, markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.patch('/:id/read', authenticate, validateNotificationId, markNotificationAsRead);

module.exports = router;
