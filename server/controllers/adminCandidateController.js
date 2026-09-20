const mongoose = require('mongoose');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');
const InterviewBooking = require('../models/InterviewBooking');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/regexEscape');

/**
 * @desc    Get paginated, searchable, filterable list of registered candidates
 * @route   GET /api/admin/candidates
 * @access  Private (Admin only)
 */
const getAdminCandidates = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = !isNaN(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 10;

  const { search, status, experienceLevel, sortBy, sortOrder } = req.query;

  // Base match: only candidates
  const matchUser = { role: 'candidate' };
  if (status === 'active') {
    matchUser.isActive = true;
  } else if (status === 'inactive') {
    matchUser.isActive = false;
  }

  // Pipeline assembly
  const pipeline = [
    { $match: matchUser },
    {
      $lookup: {
        from: 'candidateprofiles',
        localField: '_id',
        foreignField: 'user',
        as: 'profile',
      },
    },
    {
      $unwind: {
        path: '$profile',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  const filterConditions = [];

  // Search filtering with ReDoS-safe regex escaping
  if (typeof search === 'string' && search.trim().length > 0) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, 'i');
    filterConditions.push({
      $or: [
        { email: searchRegex },
        { 'profile.fullName': searchRegex },
        { 'profile.headline': searchRegex },
        { 'profile.skills': searchRegex },
        { 'profile.location': searchRegex },
      ],
    });
  }

  // Experience level filtering
  if (
    typeof experienceLevel === 'string' &&
    experienceLevel.trim().length > 0 &&
    experienceLevel !== 'all'
  ) {
    filterConditions.push({
      'profile.experienceLevel': experienceLevel.trim(),
    });
  }

  if (filterConditions.length > 0) {
    pipeline.push({
      $match: {
        $and: filterConditions,
      },
    });
  }

  // Sorting
  let sortField = 'createdAt';
  if (sortBy === 'fullName') {
    sortField = 'profile.fullName';
  } else if (sortBy === 'email') {
    sortField = 'email';
  } else if (sortBy === 'profileCompletionPercentage') {
    sortField = 'profile.profileCompletionPercentage';
  }
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  pipeline.push({
    $facet: {
      totalCount: [{ $count: 'count' }],
      candidates: [
        { $sort: { [sortField]: sortDirection, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            email: 1,
            role: 1,
            isActive: 1,
            createdAt: 1,
            lastLogoutAt: 1,
            profile: {
              _id: '$profile._id',
              fullName: { $ifNull: ['$profile.fullName', ''] },
              phone: { $ifNull: ['$profile.phone', ''] },
              location: { $ifNull: ['$profile.location', ''] },
              headline: { $ifNull: ['$profile.headline', ''] },
              skills: { $ifNull: ['$profile.skills', []] },
              experienceLevel: { $ifNull: ['$profile.experienceLevel', 'entry'] },
              yearsOfExperience: { $ifNull: ['$profile.yearsOfExperience', 0] },
              profileCompletionPercentage: { $ifNull: ['$profile.profileCompletionPercentage', 0] },
              resume: '$profile.resume',
            },
          },
        },
      ],
    },
  });

  // Execute aggregate and summary counts in parallel
  const [aggregateResult, totalAll, activeAll, inactiveAll] = await Promise.all([
    User.aggregate(pipeline),
    User.countDocuments({ role: 'candidate' }),
    User.countDocuments({ role: 'candidate', isActive: true }),
    User.countDocuments({ role: 'candidate', isActive: false }),
  ]);

  const facet = aggregateResult[0] || {};
  const total = facet.totalCount?.[0]?.count || 0;
  const candidates = facet.candidates || [];
  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    message: 'Candidates retrieved successfully',
    data: {
      candidates,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        count: candidates.length,
      },
      summary: {
        total: totalAll,
        active: activeAll,
        inactive: inactiveAll,
      },
    },
  });
});

/**
 * @desc    Get complete 360 candidate detail overview (profile, bookings, attempts)
 * @route   GET /api/admin/candidates/:id
 * @access  Private (Admin only)
 */
const getAdminCandidateById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      message: 'Candidate not found',
    });
  }

  const candidateUser = await User.findOne({ _id: id, role: 'candidate' });
  if (!candidateUser) {
    return res.status(404).json({
      success: false,
      message: 'Candidate not found',
    });
  }

  // Query Profile, Bookings (candidate field), and Attempts (candidateId field) in parallel
  const [profile, bookings, attempts] = await Promise.all([
    CandidateProfile.findOne({ user: id }).lean(),
    InterviewBooking.find({ candidate: id })
      .populate('slot', 'title interviewerName startTime endTime durationMinutes status meetingLink')
      .sort({ createdAt: -1 })
      .lean(),
    AssessmentAttempt.find({ candidateId: id })
      .populate('assessmentId', 'title difficulty durationMinutes passingPercentage')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Normalize attempt objects to provide direct `assessment` reference for client consumption
  const normalizedAttempts = attempts.map((att) => ({
    ...att,
    assessment: att.assessmentId,
  }));

  const completedAttempts = normalizedAttempts.filter((a) => a.status === 'completed');
  const passedAttempts = completedAttempts.filter((a) => {
    const passingPercentage = a.assessment?.passingPercentage ?? 60;
    return (a.percentage || 0) >= passingPercentage;
  });

  res.status(200).json({
    success: true,
    message: 'Candidate details retrieved successfully',
    data: {
      candidate: {
        _id: candidateUser._id,
        email: candidateUser.email,
        role: candidateUser.role,
        isActive: candidateUser.isActive,
        createdAt: candidateUser.createdAt,
        lastLogoutAt: candidateUser.lastLogoutAt,
        profile: profile || null,
      },
      bookings,
      attempts: normalizedAttempts,
      stats: {
        totalBookings: bookings.length,
        upcomingBookings: bookings.filter((b) => b.status === 'confirmed').length,
        totalAttempts: normalizedAttempts.length,
        completedAttempts: completedAttempts.length,
        passedAttempts: passedAttempts.length,
      },
    },
  });
});

/**
 * @desc    Toggle candidate account status (enable or disable account)
 * @route   PATCH /api/admin/candidates/:id/status
 * @access  Private (Admin only)
 */
const updateCandidateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      message: 'Candidate not found',
    });
  }

  let newStatus;
  if (typeof req.body.isActive === 'boolean') {
    newStatus = req.body.isActive;
  } else if (req.body.status === 'active') {
    newStatus = true;
  } else if (req.body.status === 'inactive') {
    newStatus = false;
  } else {
    return res.status(400).json({
      success: false,
      message:
        'Invalid status payload. Must provide isActive (boolean) or status ("active" | "inactive")',
    });
  }

  const user = await User.findOne({ _id: id, role: 'candidate' });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Candidate not found',
    });
  }

  user.isActive = newStatus;
  await user.save();

  res.status(200).json({
    success: true,
    message: `Candidate account has been ${user.isActive ? 'enabled' : 'disabled'} successfully`,
    data: {
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  });
});

module.exports = {
  getAdminCandidates,
  getAdminCandidateById,
  updateCandidateStatus,
};
