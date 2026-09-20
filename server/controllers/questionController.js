const Question = require('../models/Question');
const Assessment = require('../models/Assessment');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Create a new question under an assessment
 * @route   POST /api/admin/assessments/:assessmentId/questions
 * @access  Private (Admin only)
 */
const createQuestion = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found',
    });
  }

  const { text, options, correctOptionIndex, explanation, marks, topic, difficulty } = req.body;

  const question = await Question.create({
    assessmentId,
    text,
    options,
    correctOptionIndex,
    explanation,
    marks,
    topic,
    difficulty,
  });

  res.status(201).json({
    success: true,
    message: 'Question created successfully',
    data: {
      question,
    },
  });
});

/**
 * @desc    Get all questions for an assessment (Admin view - includes answers and explanations)
 * @route   GET /api/admin/assessments/:assessmentId/questions
 * @access  Private (Admin only)
 */
const getAdminQuestions = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found',
    });
  }

  const questions = await Question.find({ assessmentId }).sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: questions.length,
    data: {
      questions,
    },
  });
});

/**
 * @desc    Get single question by ID (Admin view)
 * @route   GET /api/admin/assessments/:assessmentId/questions/:questionId
 * @access  Private (Admin only)
 */
const getAdminQuestionById = asyncHandler(async (req, res) => {
  const { assessmentId, questionId } = req.params;

  const question = await Question.findOne({ _id: questionId, assessmentId });
  if (!question) {
    return res.status(404).json({
      success: false,
      message: 'Question not found under this assessment',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      question,
    },
  });
});

/**
 * @desc    Update a question
 * @route   PUT /api/admin/assessments/:assessmentId/questions/:questionId
 * @access  Private (Admin only)
 */
const updateQuestion = asyncHandler(async (req, res) => {
  const { assessmentId, questionId } = req.params;

  const question = await Question.findOne({ _id: questionId, assessmentId });
  if (!question) {
    return res.status(404).json({
      success: false,
      message: 'Question not found under this assessment',
    });
  }

  const updatableFields = [
    'text',
    'options',
    'correctOptionIndex',
    'explanation',
    'marks',
    'topic',
    'difficulty',
  ];

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      question[field] = req.body[field];
    }
  }

  await question.save();

  res.status(200).json({
    success: true,
    message: 'Question updated successfully',
    data: {
      question,
    },
  });
});

/**
 * @desc    Delete a question
 * @route   DELETE /api/admin/assessments/:assessmentId/questions/:questionId
 * @access  Private (Admin only)
 */
const deleteQuestion = asyncHandler(async (req, res) => {
  const { assessmentId, questionId } = req.params;

  const question = await Question.findOneAndDelete({ _id: questionId, assessmentId });
  if (!question) {
    return res.status(404).json({
      success: false,
      message: 'Question not found under this assessment',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Question deleted successfully',
  });
});

/**
 * @desc    Candidate-facing endpoint: Get questions for an assessment
 * @route   GET /api/assessments/:id/questions
 * @access  Public / Candidate
 * @security Strictly strips correctOptionIndex and explanation from the output.
 */
const getCandidateQuestions = asyncHandler(async (req, res) => {
  const assessmentId = req.params.id;

  // 1. Verify assessment exists and is published
  const assessment = await Assessment.findOne({
    _id: assessmentId,
    isPublished: true,
  });

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found or is currently unpublished.',
    });
  }

  // 2. Fetch questions strictly projecting out correctOptionIndex and explanation
  const questions = await Question.find({ assessmentId })
    .select('-correctOptionIndex -explanation')
    .sort({ createdAt: 1 });

  // 3. Defense-in-depth sanitization: guarantee neither field is leaked
  const sanitizedQuestions = questions.map((q) => {
    const raw = q.toObject ? q.toObject() : { ...q };
    delete raw.correctOptionIndex;
    delete raw.explanation;
    return raw;
  });

  res.status(200).json({
    success: true,
    count: sanitizedQuestions.length,
    data: {
      questions: sanitizedQuestions,
    },
  });
});

module.exports = {
  createQuestion,
  getAdminQuestions,
  getAdminQuestionById,
  updateQuestion,
  deleteQuestion,
  getCandidateQuestions,
};
