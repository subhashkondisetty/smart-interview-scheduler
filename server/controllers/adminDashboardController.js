const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const InterviewBooking = require('../models/InterviewBooking');
const cronService = require('../services/cronService');

/**
 * @desc    Get admin dashboard aggregate metrics and platform analytics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin only)
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
  const now = new Date();

  // 1. On-Access Expiry Sweep:
  // Sweep any stale in-progress attempts platform-wide before calculating statistics
  await cronService.autoExpireElapsedAttempts();

  // 2. Parse and clamp activity feed limit
  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = !isNaN(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 10;

  // 3. Parallel Query Aggregation across domain models
  const [
    totalCandidates,
    totalAssessments,
    publishedAssessmentsCount,
    totalAttempts,
    completedAttempts,
    allBookings,
    recentRegistrations,
    recentBookings,
    recentAttempts,
  ] = await Promise.all([
    // Total registered candidates
    User.countDocuments({ role: 'candidate' }),

    // Total assessments (all statuses)
    Assessment.countDocuments({}),

    // Total published assessments
    Assessment.countDocuments({ isPublished: true }),

    // Total assessment attempts across all candidates
    AssessmentAttempt.countDocuments({}),

    // Completed attempts for average score and percentage calculations
    AssessmentAttempt.find({ status: 'completed' }, 'score percentage').lean(),

    // All interview bookings with populated slot for mutually-exclusive partitioning
    InterviewBooking.find({})
      .populate('slot', 'title startTime endTime durationMinutes')
      .lean(),

    // Recent candidate registrations
    User.find({ role: 'candidate' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('email createdAt')
      .lean(),

    // Recent bookings
    InterviewBooking.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('candidate', 'email')
      .populate('slot', 'title startTime')
      .select('candidate slot status createdAt')
      .lean(),

    // Recent assessment attempts
    AssessmentAttempt.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('candidateId', 'email')
      .populate('assessmentId', 'title')
      .select('candidateId assessmentId status score percentage createdAt')
      .lean(),
  ]);

  // 4. Mutually-Exclusive Booking & Interview Partitioning (Architectural Decision #19)
  // Every booking is placed into exactly one bucket: upcoming, completed, cancelled, or rescheduled.
  // Invariant: upcoming + completed + cancelled + rescheduled === totalBookings
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  let rescheduled = 0;

  for (const booking of allBookings) {
    if (booking.status === 'cancelled') {
      cancelled++;
    } else if (booking.status === 'rescheduled') {
      rescheduled++;
    } else if (booking.status === 'confirmed') {
      // Null-safe slot fallback:
      // If booking.slot is null (deleted slot) or missing startTime, route safely to completed.
      if (booking.slot && booking.slot.startTime && new Date(booking.slot.startTime) > now) {
        upcoming++;
      } else {
        completed++;
      }
    } else if (booking.status === 'completed') {
      completed++;
    } else {
      // Fallback for any unexpected status to guarantee all records are accounted for
      completed++;
    }
  }

  const totalBookings = allBookings.length;
  const totalInterviewsScheduled = upcoming + completed;

  // 5. Calculate Assessment Performance Metrics
  const completedAttemptsCount = completedAttempts.length;
  let averageScore = 0;
  let averagePercentage = 0;

  if (completedAttemptsCount > 0) {
    const totalScore = completedAttempts.reduce((acc, att) => acc + (att.score || 0), 0);
    const totalPercentage = completedAttempts.reduce((acc, att) => acc + (att.percentage || 0), 0);
    averageScore = Math.round((totalScore / completedAttemptsCount) * 100) / 100;
    averagePercentage = Math.round((totalPercentage / completedAttemptsCount) * 100) / 100;
  }

  // 6. Assemble Unified Recent Activity Feed
  const activityItems = [];

  for (const user of recentRegistrations) {
    activityItems.push({
      id: user._id,
      type: 'candidate_registered',
      message: `New candidate registered: ${user.email}`,
      timestamp: user.createdAt,
      details: {
        userId: user._id,
        email: user.email,
      },
    });
  }

  for (const booking of recentBookings) {
    const candidateEmail = booking.candidate?.email || 'Candidate';
    const slotTitle = booking.slot?.title || 'Mock Interview';
    activityItems.push({
      id: booking._id,
      type: 'interview_booking',
      message: `Interview ${booking.status}: ${candidateEmail} (${slotTitle})`,
      timestamp: booking.createdAt,
      details: {
        bookingId: booking._id,
        status: booking.status,
        candidateEmail: booking.candidate?.email || null,
        slotTitle: booking.slot?.title || null,
        slotStartTime: booking.slot?.startTime || null,
      },
    });
  }

  for (const attempt of recentAttempts) {
    const candidateEmail = attempt.candidateId?.email || 'Candidate';
    const assessmentTitle = attempt.assessmentId?.title || 'Assessment';
    activityItems.push({
      id: attempt._id,
      type: 'assessment_attempt',
      message: `Assessment attempt ${attempt.status}: ${candidateEmail} on ${assessmentTitle}`,
      timestamp: attempt.createdAt,
      details: {
        attemptId: attempt._id,
        status: attempt.status,
        score: attempt.score,
        percentage: attempt.percentage,
        candidateEmail: attempt.candidateId?.email || null,
        assessmentTitle: attempt.assessmentId?.title || null,
      },
    });
  }

  // Sort descending by timestamp and slice to limit
  activityItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const recentActivityFeed = activityItems.slice(0, limit);

  // 7. Return structured aggregation payload
  res.status(200).json({
    success: true,
    data: {
      totalCandidates,
      totalInterviewsScheduled,
      interviewStats: {
        totalScheduled: totalInterviewsScheduled,
        upcoming,
        completed,
      },
      bookingStats: {
        total: totalBookings,
        upcoming,
        completed,
        cancelled,
        rescheduled,
      },
      assessmentStats: {
        publishedCount: publishedAssessmentsCount,
        totalAssessments,
        totalAttempts,
        completedAttempts: completedAttemptsCount,
        averageScore,
        averagePercentage,
      },
      recentActivityFeed,
      recentRegistrations,
      recentBookings,
      recentAttempts,
    },
  });
});

module.exports = {
  getAdminDashboard,
};
