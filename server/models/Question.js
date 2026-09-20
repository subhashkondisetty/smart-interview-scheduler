const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment reference is required'],
    },
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    options: {
      type: [String],
      required: [true, 'Options are required'],
      validate: [
        (opts) => Array.isArray(opts) && opts.length >= 2,
        'Question must have at least 2 options',
      ],
    },
    correctOptionIndex: {
      type: Number,
      required: [true, 'Correct option index is required'],
      min: [0, 'Correct option index must be non-negative'],
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
    },
    marks: {
      type: Number,
      required: [true, 'Marks are required'],
      min: [1, 'Marks must be at least 1'],
      default: 1,
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
    },
    difficulty: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Difficulty must be beginner, intermediate, or advanced',
      },
      default: 'intermediate',
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ assessmentId: 1, topic: 1 });

const Question =
  mongoose.models.Question || mongoose.model('Question', questionSchema);

module.exports = Question;
