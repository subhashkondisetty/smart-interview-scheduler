const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const notificationService = require('./notificationService');

/**
 * Unified, single source-of-truth scoring computation.
 * Evaluates candidate answers against official assessment questions.
 *
 * @param {Array} questions - Array of official Question documents/objects
 * @param {Array} rawAnswers - Array of candidate answer objects { questionId, selectedOptionIndex }
 * @param {Number} passingPercentage - Assessment passing percentage threshold
 * @returns {Object} { score, totalMarks, percentage, passed, evaluatedAnswers, topicBreakdown }
 */
const computeAttemptScore = (questions = [], rawAnswers = [], passingPercentage = 60) => {
  // Deduplicate candidate answers into a map: questionId -> answer
  const candidateAnswerMap = new Map();
  if (Array.isArray(rawAnswers)) {
    for (const ans of rawAnswers) {
      if (ans && ans.questionId) {
        const qIdStr = ans.questionId.toString();
        if (!candidateAnswerMap.has(qIdStr)) {
          candidateAnswerMap.set(qIdStr, ans);
        }
      }
    }
  }

  let totalMarks = 0;
  let score = 0;
  const evaluatedAnswers = [];
  const topicStats = {};

  // Strictly iterate over official assessment questions (never client's submitted array)
  for (const q of questions) {
    totalMarks += q.marks;

    if (!topicStats[q.topic]) {
      topicStats[q.topic] = {
        score: 0,
        totalMarks: 0,
        correctCount: 0,
        totalQuestions: 0,
      };
    }
    topicStats[q.topic].totalMarks += q.marks;
    topicStats[q.topic].totalQuestions += 1;

    const submitted = candidateAnswerMap.get(q._id.toString());
    let selectedOptionIndex = null;
    let isCorrect = false;
    let marksAwarded = 0;

    if (
      submitted &&
      submitted.selectedOptionIndex !== null &&
      submitted.selectedOptionIndex !== undefined &&
      Number.isInteger(Number(submitted.selectedOptionIndex))
    ) {
      const optIdx = Number(submitted.selectedOptionIndex);
      // Valid option index within [0, q.options.length - 1]
      if (optIdx >= 0 && optIdx < q.options.length) {
        selectedOptionIndex = optIdx;
        if (optIdx === q.correctOptionIndex) {
          isCorrect = true;
          marksAwarded = q.marks;
          score += marksAwarded;
          topicStats[q.topic].score += marksAwarded;
          topicStats[q.topic].correctCount += 1;
        }
      }
      // If outside bounds, selectedOptionIndex remains null (unanswered) with 0 marks
    }

    evaluatedAnswers.push({
      questionId: q._id,
      topic: q.topic,
      selectedOptionIndex,
      isCorrect,
      marksAwarded,
    });
  }

  const percentage =
    totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0;
  const passed = percentage >= passingPercentage;

  const topicBreakdown = Object.keys(topicStats).map((topic) => {
    const tScore = topicStats[topic].score;
    const tTotal = topicStats[topic].totalMarks;
    const tCorrect = topicStats[topic].correctCount;
    const tQuestions = topicStats[topic].totalQuestions;
    return {
      topic,
      score: tScore,
      totalMarks: tTotal,
      percentage: tTotal > 0 ? Math.round((tScore / tTotal) * 10000) / 100 : 0,
      correctCount: tCorrect,
      totalQuestions: tQuestions,
    };
  });

  return {
    score,
    totalMarks,
    percentage,
    passed,
    evaluatedAnswers,
    topicBreakdown,
  };
};

/**
 * Atomically transitions an in-progress attempt to 'expired' and formally scores it.
 * Derives score, totalMarks, percentage, passed, and topicBreakdown dynamically.
 * Sets endTime strictly to attempt.expiresAt for consistent duration metrics.
 *
 * If a concurrent call site already finalized the attempt, matches 0 documents and returns
 * the existing finalized document without clobbering writes.
 *
 * @param {Object} attempt - AssessmentAttempt document
 * @returns {Promise<Object>} The finalized AssessmentAttempt document
 */
const finalizeExpiredAttempt = async (attempt) => {
  if (!attempt) return null;

  if (attempt.status !== 'in_progress') {
    return attempt;
  }

  const assessment = await Assessment.findById(attempt.assessmentId);
  const questions = await Question.find({ assessmentId: attempt.assessmentId }).lean();
  const passingPercentage = assessment ? assessment.passingPercentage : 60;

  const scoringResult = computeAttemptScore(
    questions,
    attempt.answers || [],
    passingPercentage
  );

  const updatedAttempt = await AssessmentAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: 'in_progress',
    },
    {
      $set: {
        status: 'expired',
        endTime: attempt.expiresAt,
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
    // Another concurrent call site already finalized this attempt: re-fetch and return (NO notification dispatch)
    return await AssessmentAttempt.findById(attempt._id);
  }

  // Winning branch: dispatch in-app notification strictly once
  notificationService.createNotification({
    userId: attempt.candidateId,
    type: 'assessment_expired',
    message: `Assessment attempt for "${assessment ? assessment.title : 'Assessment'}" expired. Score: ${scoringResult.score}/${scoringResult.totalMarks}.`,
  }).catch((err) => {
    console.error('[Notification] Failed to send assessment expired notification:', err.message);
  });

  return updatedAttempt;
};

module.exports = {
  computeAttemptScore,
  finalizeExpiredAttempt,
};
