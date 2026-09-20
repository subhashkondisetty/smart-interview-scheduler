const mongoose = require('mongoose');

const answerItemSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: [true, 'Question ID is required'],
    },
    topic: {
      type: String,
      trim: true,
      default: '',
    },
    selectedOptionIndex: {
      type: Number,
      default: null,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    marksAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const topicBreakdownSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    correctCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const assessmentAttemptSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Candidate ID is required'],
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
    },
    attemptNumber: {
      type: Number,
      required: [true, 'Attempt number is required'],
      min: [1, 'Attempt number must be at least 1'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry time is required'],
    },
    endTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['in_progress', 'completed', 'expired'],
        message: 'Status must be in_progress, completed, or expired',
      },
      default: 'in_progress',
    },
    answers: {
      type: [answerItemSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    topicBreakdown: {
      type: [topicBreakdownSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Partial Unique Index:
 * Guarantees at most ONE in-progress attempt per candidate per assessment at any given moment.
 * Does not restrict accumulated completed or expired attempts over time.
 */
assessmentAttemptSchema.index(
  { candidateId: 1, assessmentId: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' } }
);

// Optimize candidate attempt history querying
assessmentAttemptSchema.index({ candidateId: 1, assessmentId: 1, attemptNumber: 1 });
assessmentAttemptSchema.index({ candidateId: 1, createdAt: -1 });

// Optimize scheduled & on-access expiry queries
assessmentAttemptSchema.index({ expiresAt: 1, status: 1 });

const AssessmentAttempt =
  mongoose.models.AssessmentAttempt ||
  mongoose.model('AssessmentAttempt', assessmentAttemptSchema);

module.exports = AssessmentAttempt;
