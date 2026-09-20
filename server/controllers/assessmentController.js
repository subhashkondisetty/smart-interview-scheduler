const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Create a new assessment
 * @route   POST /api/admin/assessments
 * @access  Private (Admin only)
 */
const createAssessment = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    difficulty,
    durationMinutes,
    passingPercentage,
    maxAttempts,
    isPublished = false,
  } = req.body;

  const adminId = req.user._id || req.user.id;

  const assessment = await Assessment.create({
    title,
    description,
    difficulty,
    durationMinutes,
    passingPercentage,
    maxAttempts,
    isPublished,
    createdBy: adminId,
  });

  res.status(201).json({
    success: true,
    message: 'Assessment created successfully',
    data: {
      assessment,
    },
  });
});

/**
 * @desc    Get all assessments (Admin view - includes drafts and published)
 * @route   GET /api/admin/assessments
 * @access  Private (Admin only)
 */
const getAdminAssessments = asyncHandler(async (req, res) => {
  const { difficulty, isPublished } = req.query;
  const filter = {};

  if (difficulty) filter.difficulty = difficulty;
  if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const [total, assessments] = await Promise.all([
    Assessment.countDocuments(filter),
    Assessment.find(filter)
      .populate('createdBy', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  let assessmentsWithCounts = assessments;
  if (mongoose.connection.readyState !== 0 && assessments.length > 0) {
    const assessmentIds = assessments.map((a) => a._id);
    const [questionCounts, attemptCounts] = await Promise.all([
      Question.aggregate([
        { $match: { assessmentId: { $in: assessmentIds } } },
        { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
      ]),
      AssessmentAttempt.aggregate([
        { $match: { assessmentId: { $in: assessmentIds } } },
        { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
      ]),
    ]);

    const qMap = {};
    questionCounts.forEach((qc) => {
      if (qc._id) qMap[qc._id.toString()] = qc.count;
    });

    const aMap = {};
    attemptCounts.forEach((ac) => {
      if (ac._id) aMap[ac._id.toString()] = ac.count;
    });

    assessmentsWithCounts = assessments.map((a) => {
      const obj = a.toObject ? a.toObject() : { ...a };
      obj.questionCount = qMap[a._id.toString()] || 0;
      obj.attemptCount = aMap[a._id.toString()] || 0;
      return obj;
    });
  }

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    count: assessmentsWithCounts.length,
    data: {
      assessments: assessmentsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        hasMore: page < totalPages,
      },
    },
  });
});

/**
 * @desc    Get single assessment by ID (Admin view)
 * @route   GET /api/admin/assessments/:id
 * @access  Private (Admin only)
 */
const getAdminAssessmentById = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id).populate('createdBy', 'email role');

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      assessment,
    },
  });
});

/**
 * @desc    Update an assessment
 * @route   PUT /api/admin/assessments/:id
 * @access  Private (Admin only)
 */
const updateAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found',
    });
  }

  const updatableFields = [
    'title',
    'description',
    'difficulty',
    'durationMinutes',
    'passingPercentage',
    'maxAttempts',
    'isPublished',
  ];

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      assessment[field] = req.body[field];
    }
  }

  await assessment.save();

  res.status(200).json({
    success: true,
    message: 'Assessment updated successfully',
    data: {
      assessment,
    },
  });
});

/**
 * @desc    Delete an assessment
 * @route   DELETE /api/admin/assessments/:id
 * @access  Private (Admin only)
 */
const deleteAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found',
    });
  }

  // Guard: Block deletion if any candidate attempts reference this assessment
  if (mongoose.connection.readyState !== 0) {
    const attemptCount = await AssessmentAttempt.countDocuments({ assessmentId: req.params.id });
    if (attemptCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete assessment with existing candidate attempts. Unpublish the assessment instead to preserve candidate attempt history.',
      });
    }
  }

  await Assessment.findByIdAndDelete(req.params.id);

  // Cascade cleanup: remove associated questions since no attempts ever referenced them
  if (mongoose.connection.readyState !== 0) {
    await Question.deleteMany({ assessmentId: req.params.id });
  }

  res.status(200).json({
    success: true,
    message: 'Assessment deleted successfully',
  });
});

/**
 * @desc    Toggle publish status of an assessment
 * @route   PATCH /api/admin/assessments/:id/publish
 * @access  Private (Admin only)
 */
const togglePublish = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found',
    });
  }

  if (req.body.isPublished !== undefined) {
    assessment.isPublished = Boolean(req.body.isPublished);
  } else {
    assessment.isPublished = !assessment.isPublished;
  }

  await assessment.save();

  res.status(200).json({
    success: true,
    message: `Assessment ${assessment.isPublished ? 'published' : 'unpublished'} successfully`,
    data: {
      assessment,
    },
  });
});

/**
 * @desc    Get all published assessments (Candidate/Public discovery)
 * @route   GET /api/assessments
 * @access  Public / Candidate
 */
const getPublishedAssessments = asyncHandler(async (req, res) => {
  const { difficulty } = req.query;
  const filter = { isPublished: true };

  if (difficulty) {
    filter.difficulty = difficulty;
  }

  const assessments = await Assessment.find(filter)
    .select('-createdBy')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: assessments.length,
    data: {
      assessments,
    },
  });
});

/**
 * @desc    Get published assessment details
 * @route   GET /api/assessments/:id
 * @access  Public / Candidate
 */
const getPublishedAssessmentById = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({
    _id: req.params.id,
    isPublished: true,
  }).select('-createdBy');

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found or is currently unpublished.',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      assessment,
    },
  });
});

module.exports = {
  createAssessment,
  getAdminAssessments,
  getAdminAssessmentById,
  updateAssessment,
  deleteAssessment,
  togglePublish,
  getPublishedAssessments,
  getPublishedAssessmentById,
};
