const asyncHandler = require('../utils/asyncHandler');
const CandidateProfile = require('../models/CandidateProfile');
const InterviewBooking = require('../models/InterviewBooking');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Notification = require('../models/Notification');
const scoringService = require('../services/scoringService');

const getUserId = (user) => {
  if (!user) return null;
  return (user._id || user.id).toString();
};

/**
 * @desc    Get candidate dashboard aggregate metrics
 * @route   GET /api/candidate/dashboard
 * @access  Private (Candidate only)
 */
const getCandidateDashboard = asyncHandler(async (req, res) => {
  const candidateId = getUserId(req.user);
  const now = new Date();

  // 1. On-Access Expiry Sweep:
  // Sweep any stale in-progress attempts whose duration has elapsed,
  // ensuring genuine scoring occurs before assembling dashboard statistics.
  const elapsedAttempts = await AssessmentAttempt.find({
    candidateId,
    status: 'in_progress',
    expiresAt: { $lt: now },
  });

  for (const attempt of elapsedAttempts) {
    await scoringService.finalizeExpiredAttempt(attempt);
  }

  // 2. Parallel Query Aggregation across domain models
  const [
    profile,
    confirmedBookings,
    recentAttempts,
    completedAttempts,
    unreadNotificationsCount,
    activeInProgressAttempt,
  ] = await Promise.all([
    // CandidateProfile references User via 'user'
    CandidateProfile.findOne({ user: candidateId }).lean(),

    // InterviewBooking references User via 'candidate'
    InterviewBooking.find({ candidate: candidateId, status: 'confirmed' })
      .populate('slot')
      .lean(),

    // AssessmentAttempt references User via 'candidateId' (Last 5 finalized attempts)
    AssessmentAttempt.find({ candidateId, status: { $in: ['completed', 'expired'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assessmentId', 'title description durationMinutes passingPercentage')
      .lean(),

    // AssessmentAttempt completed scores for calculating averageScore & averagePercentage
    AssessmentAttempt.find({ candidateId, status: 'completed' }, 'score percentage').lean(),

    // Notification references User via 'userId'
    Notification.countDocuments({ userId: candidateId, isRead: false }),

    // Check for any currently active, unexpired in-progress attempt
    AssessmentAttempt.findOne({
      candidateId,
      status: 'in_progress',
      expiresAt: { $gte: now },
    })
      .populate('assessmentId', 'title')
      .lean(),
  ]);

  // 3. Evaluate Next Upcoming Interview
  // Only consider confirmed bookings with valid slots where startTime is in the future
  const futureBookings = (confirmedBookings || []).filter((booking) => {
    if (!booking || !booking.slot || !booking.slot.startTime) return false;
    return new Date(booking.slot.startTime) > now;
  });

  // Sort ascending to get earliest upcoming interview
  futureBookings.sort((a, b) => new Date(a.slot.startTime) - new Date(b.slot.startTime));
  const nextUpcomingInterview = futureBookings.length > 0 ? futureBookings[0] : null;

  // 4. Calculate Average Score & Average Percentage across completed attempts
  let averageScore = 0;
  let averagePercentage = 0;
  if (completedAttempts && completedAttempts.length > 0) {
    const totalScore = completedAttempts.reduce((acc, att) => acc + (att.score || 0), 0);
    const totalPercentage = completedAttempts.reduce((acc, att) => acc + (att.percentage || 0), 0);
    averageScore = Math.round((totalScore / completedAttempts.length) * 100) / 100;
    averagePercentage = Math.round((totalPercentage / completedAttempts.length) * 100) / 100;
  }

  // 5. Evaluate Profile Completion & Pending Actions
  const profileCompletionPercentage = profile ? profile.profileCompletionPercentage || 0 : 0;
  const hasResume = Boolean(
    profile &&
      profile.resume &&
      profile.resume.url &&
      typeof profile.resume.url === 'string' &&
      profile.resume.url.trim().length > 0
  );

  const pendingActions = [];

  if (!profile || profileCompletionPercentage < 100) {
    pendingActions.push('Incomplete profile');
  }

  if (!hasResume) {
    pendingActions.push('No resume uploaded');
  }

  if (activeInProgressAttempt) {
    pendingActions.push('In-progress assessment pending completion');
  }

  res.status(200).json({
    success: true,
    data: {
      profileCompletionPercentage,
      targetRole: profile?.targetRole || null,
      nextUpcomingInterview,
      recentAttempts: recentAttempts || [],
      averageScore,
      averagePercentage,
      unreadNotificationsCount: unreadNotificationsCount || 0,
      unreadCount: unreadNotificationsCount || 0,
      pendingActions,
    },
  });
});

module.exports = {
  getCandidateDashboard,
};
