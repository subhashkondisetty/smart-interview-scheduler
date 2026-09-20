const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const { computeAttemptScore, finalizeExpiredAttempt } = require('../services/scoringService');

const getUserId = (user) => {
  if (!user) return null;
  return user.id || (user._id ? user._id.toString() : null);
};

/**
 * @route   POST /api/candidate/assessments/:id/start
 * @desc    Start a new assessment attempt or resume an active one
 * @access  Private (Candidate only)
 */
const startAssessmentAttempt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const candidateId = getUserId(req.user);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid assessment ID',
    });
  }

  // 1. Verify assessment exists and is published
  const assessment = await Assessment.findOne({ _id: id, isPublished: true });
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found or is not currently published',
    });
  }

  const now = new Date();

  // 2. Check for existing in-progress attempt (at most one exists due to partial unique index)
  let activeAttempt = await AssessmentAttempt.findOne({
    candidateId,
    assessmentId: assessment._id,
    status: 'in_progress',
  });

  if (activeAttempt) {
    if (now > activeAttempt.expiresAt) {
      await finalizeExpiredAttempt(activeAttempt);
      activeAttempt = null;
    } else {
      return res.status(200).json({
        success: true,
        message: 'Active assessment attempt in progress',
        data: {
          attempt: activeAttempt,
        },
      });
    }
  }

  // 4. Enforce maxAttempts on all historical attempts (completed + expired)
  const existingAttemptsCount = await AssessmentAttempt.countDocuments({
    candidateId,
    assessmentId: assessment._id,
  });

  if (existingAttemptsCount >= assessment.maxAttempts) {
    return res.status(400).json({
      success: false,
      message: `Maximum attempts limit (${assessment.maxAttempts}) reached for this assessment`,
    });
  }

  // 5. Compute metadata
  const attemptNumber = existingAttemptsCount + 1;
  const startTime = new Date();
  const expiresAt = new Date(startTime.getTime() + assessment.durationMinutes * 60 * 1000);

  // 6. Insert with duplicate-key protection for concurrent start race condition
  let attempt;
  try {
    attempt = await AssessmentAttempt.create({
      candidateId,
      assessmentId: assessment._id,
      attemptNumber,
      startTime,
      expiresAt,
      status: 'in_progress',
    });
  } catch (err) {
    // Intercept duplicate key error code 11000 from partial unique index
    if (err.code === 11000) {
      const concurrentAttempt = await AssessmentAttempt.findOne({
        candidateId,
        assessmentId: assessment._id,
        status: 'in_progress',
      });

      if (concurrentAttempt) {
        return res.status(200).json({
          success: true,
          message: 'Active assessment attempt in progress',
          data: {
            attempt: concurrentAttempt,
          },
        });
      }
    }
    throw err;
  }

  return res.status(201).json({
    success: true,
    message: 'Assessment attempt started successfully',
    data: {
      attempt,
    },
  });
});

/**
 * @route   POST /api/candidate/attempts/:attemptId/submit
 * @desc    Submit an assessment attempt, score strictly server-side, and finalize atomically
 * @access  Private (Candidate only)
 */
const submitAssessmentAttempt = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const candidateId = getUserId(req.user);

  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid attempt ID',
    });
  }

  // 1. Fetch attempt and verify ownership
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) {
    return res.status(404).json({
      success: false,
      message: 'Assessment attempt not found',
    });
  }

  if (attempt.candidateId.toString() !== candidateId) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to submit this assessment attempt',
    });
  }

  // 2. Status & Expiry Check
  if (attempt.status !== 'in_progress') {
    return res.status(400).json({
      success: false,
      message: 'Assessment attempt is already finalized or expired',
    });
  }

  const now = new Date();
  if (now > attempt.expiresAt) {
    // Atomically transition to expired with formal scoring and exact expiresAt endTime
    await finalizeExpiredAttempt(attempt);
    return res.status(400).json({
      success: false,
      message: 'Assessment time limit has expired. Submission rejected.',
    });
  }

  // 3. Question-Driven Server-Side Scoring Engine
  const assessment = await Assessment.findById(attempt.assessmentId);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Underlying assessment not found',
    });
  }

  const questions = await Question.find({ assessmentId: attempt.assessmentId }).lean();
  const scoringResult = computeAttemptScore(
    questions,
    req.body.answers,
    assessment.passingPercentage
  );

  // 4. Atomic Status Transition Guard
  // Only the winning atomic update will match status === 'in_progress'
  const updatedAttempt = await AssessmentAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      candidateId,
      status: 'in_progress',
    },
    {
      $set: {
        status: 'completed',
        endTime: now,
        score: scoringResult.score,
        totalMarks: scoringResult.totalMarks,
        percentage: scoringResult.percentage,
        passed: scoringResult.passed,
        topicBreakdown: scoringResult.topicBreakdown,
        answers: scoringResult.evaluatedAnswers,
      },
    },
    { new: true }
  );

  if (!updatedAttempt) {
    return res.status(400).json({
      success: false,
      message: 'This assessment attempt has already been submitted or expired',
    });
  }

  // 5. Non-blocking assessment completion email dispatch
  emailService.sendAssessmentCompletionEmail(req.user, assessment, {
    score: scoringResult.score,
    totalMarks: scoringResult.totalMarks,
    percentage: scoringResult.percentage,
    passed: scoringResult.passed,
  });

  // In-app notification dispatch
  notificationService.createNotification({
    userId: candidateId,
    type: 'assessment_completed',
    message: `Assessment "${assessment.title}" completed. Score: ${scoringResult.score}/${scoringResult.totalMarks} (${scoringResult.percentage}%). Result: ${scoringResult.passed ? 'Passed' : 'Failed'}.`,
  }).catch((err) => {
    console.error('[Notification] Failed to send assessment completion notification:', err.message);
  });

  return res.status(200).json({
    success: true,
    message: 'Assessment submitted successfully',
    data: {
      attempt: updatedAttempt,
    },
  });
});

/**
 * @route   GET /api/candidate/attempts
 * @desc    Get authenticated candidate's assessment attempt history
 * @access  Private (Candidate only)
 */
const getCandidateAttempts = asyncHandler(async (req, res) => {
  const candidateId = getUserId(req.user);
  const query = { candidateId };

  if (req.query.assessmentId) {
    if (mongoose.Types.ObjectId.isValid(req.query.assessmentId)) {
      query.assessmentId = req.query.assessmentId;
    }
  }

  // On-access expiry check for this candidate's pending attempts
  const now = new Date();
  const elapsedAttempts = await AssessmentAttempt.find({
    candidateId,
    status: 'in_progress',
    expiresAt: { $lt: now },
  });

  for (const att of elapsedAttempts) {
    await finalizeExpiredAttempt(att);
  }

  const attempts = await AssessmentAttempt.find(query)
    .populate('assessmentId', 'title description difficulty durationMinutes passingPercentage')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: attempts.length,
    data: {
      attempts,
    },
  });
});

/**
 * @route   GET /api/candidate/attempts/:attemptId
 * @desc    Get candidate's attempt details by ID
 * @access  Private (Candidate only)
 */
const getAttemptById = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const candidateId = getUserId(req.user);

  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid attempt ID',
    });
  }

  let attempt = await AssessmentAttempt.findById(attemptId).populate(
    'assessmentId',
    'title description difficulty durationMinutes passingPercentage'
  );

  if (!attempt) {
    return res.status(404).json({
      success: false,
      message: 'Assessment attempt not found',
    });
  }

  if (attempt.candidateId.toString() !== candidateId) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to view this assessment attempt',
    });
  }

  // On-access expiry check
  const now = new Date();
  if (attempt.status === 'in_progress' && now > attempt.expiresAt) {
    attempt = await finalizeExpiredAttempt(attempt);
  }

  return res.status(200).json({
    success: true,
    data: {
      attempt,
    },
  });
});

/**
 * @route   GET /api/candidate/attempts/:attemptId/result
 * @desc    Get detailed result for a finalized/completed assessment attempt
 * @access  Private (Candidate only)
 */
const getAttemptResult = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const candidateId = getUserId(req.user);

  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid attempt ID',
    });
  }

  let attempt = await AssessmentAttempt.findById(attemptId).populate(
    'assessmentId',
    'title description difficulty durationMinutes passingPercentage'
  );

  if (!attempt) {
    return res.status(404).json({
      success: false,
      message: 'Assessment attempt not found',
    });
  }

  // Ownership enforcement
  if (attempt.candidateId.toString() !== candidateId) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to view this assessment result',
    });
  }

  // In-progress attempt handling
  const now = new Date();
  if (attempt.status === 'in_progress') {
    if (now > attempt.expiresAt) {
      // Transition to expired and score using shared scoring engine
      attempt = await finalizeExpiredAttempt(attempt);
      attempt = await AssessmentAttempt.findById(attemptId).populate(
        'assessmentId',
        'title description difficulty durationMinutes passingPercentage'
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Assessment attempt is still in progress. Results are available after submission.',
      });
    }
  }

  // Compute question counts
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const incorrectCount = answers.filter((a) => !a.isCorrect && a.selectedOptionIndex !== null).length;
  const unansweredCount = answers.filter((a) => a.selectedOptionIndex === null).length;
  const totalQuestions = answers.length;

  // Compute time taken (deterministic based on endTime and startTime)
  const timeTakenSeconds =
    attempt.endTime && attempt.startTime
      ? Math.max(0, Math.round((new Date(attempt.endTime).getTime() - new Date(attempt.startTime).getTime()) / 1000))
      : 0;
  const timeTakenMinutes = Math.round((timeTakenSeconds / 60) * 10) / 10;

  return res.status(200).json({
    success: true,
    data: {
      result: {
        attemptId: attempt._id,
        assessment: attempt.assessmentId || {
          title: 'Retired Assessment',
          description: 'This assessment is no longer active in the catalog.',
          difficulty: 'intermediate',
          durationMinutes: 0,
          passingPercentage: 0,
        },
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        passed: attempt.passed,
        correctCount,
        incorrectCount,
        unansweredCount,
        totalQuestions,
        timeTakenSeconds,
        timeTakenMinutes,
        startTime: attempt.startTime,
        endTime: attempt.endTime,
        topicBreakdown: attempt.topicBreakdown,
        answers: attempt.answers,
      },
    },
  });
});

/**
 * @route   GET /api/candidate/assessments/history
 * @desc    Get candidate's past assessment attempt history (completed and expired)
 * @access  Private (Candidate only)
 */
const getAssessmentHistory = asyncHandler(async (req, res) => {
  const candidateId = getUserId(req.user);

  // Run on-access expiry for any of candidate's pending elapsed attempts
  const now = new Date();
  const elapsedAttempts = await AssessmentAttempt.find({
    candidateId,
    status: 'in_progress',
    expiresAt: { $lt: now },
  });

  for (const att of elapsedAttempts) {
    await finalizeExpiredAttempt(att);
  }

  const attempts = await AssessmentAttempt.find({ candidateId })
    .populate('assessmentId', 'title description difficulty durationMinutes passingPercentage')
    .sort({ createdAt: -1 });

  const history = attempts.map((att) => {
    const timeTakenSeconds =
      att.endTime && att.startTime
        ? Math.max(0, Math.round((new Date(att.endTime).getTime() - new Date(att.startTime).getTime()) / 1000))
        : 0;

    return {
      attemptId: att._id,
      assessment: att.assessmentId || {
        title: 'Retired Assessment',
        description: 'This assessment is no longer active in the catalog.',
        difficulty: 'intermediate',
        durationMinutes: 0,
        passingPercentage: 0,
      },
      attemptNumber: att.attemptNumber,
      status: att.status,
      score: att.score,
      totalMarks: att.totalMarks,
      percentage: att.percentage,
      passed: att.passed,
      timeTakenSeconds,
      timeTakenMinutes: Math.round((timeTakenSeconds / 60) * 10) / 10,
      startTime: att.startTime,
      endTime: att.endTime,
      createdAt: att.createdAt,
    };
  });

  return res.status(200).json({
    success: true,
    count: history.length,
    data: {
      history,
    },
  });
});

/**
 * @route   GET /api/candidate/performance/topic-wise
 * @desc    Get candidate's aggregated accuracy and metrics per topic across completed attempts
 * @access  Private (Candidate only)
 */
const getTopicWisePerformance = asyncHandler(async (req, res) => {
  const candidateId = getUserId(req.user);

  // Architectural Decision #15: Include ONLY completed attempts; exclude expired/abandoned attempts
  const completedAttempts = await AssessmentAttempt.find({
    candidateId,
    status: 'completed',
  });

  const topicMap = {};

  for (const att of completedAttempts) {
    if (Array.isArray(att.topicBreakdown)) {
      for (const tb of att.topicBreakdown) {
        if (!topicMap[tb.topic]) {
          topicMap[tb.topic] = {
            topic: tb.topic,
            totalAttempts: 0,
            score: 0,
            totalMarks: 0,
            correctCount: 0,
            totalQuestions: 0,
          };
        }
        topicMap[tb.topic].totalAttempts += 1;
        topicMap[tb.topic].score += (tb.score || 0);
        topicMap[tb.topic].totalMarks += (tb.totalMarks || 0);
        topicMap[tb.topic].correctCount += (tb.correctCount || 0);
        topicMap[tb.topic].totalQuestions += (tb.totalQuestions || 0);
      }
    }
  }

  const topics = Object.values(topicMap).map((t) => ({
    topic: t.topic,
    totalAttempts: t.totalAttempts,
    score: t.score,
    totalMarks: t.totalMarks,
    correctCount: t.correctCount,
    totalQuestions: t.totalQuestions,
    accuracy: t.totalMarks > 0 ? Math.round((t.score / t.totalMarks) * 10000) / 100 : 0,
    questionAccuracy: t.totalQuestions > 0 ? Math.round((t.correctCount / t.totalQuestions) * 10000) / 100 : 0,
  }));

  return res.status(200).json({
    success: true,
    count: topics.length,
    data: {
      topics,
    },
  });
});

module.exports = {
  startAssessmentAttempt,
  submitAssessmentAttempt,
  getCandidateAttempts,
  getAttemptById,
  getAttemptResult,
  getAssessmentHistory,
  getTopicWisePerformance,
};
