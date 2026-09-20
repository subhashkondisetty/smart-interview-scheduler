const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    difficulty: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Difficulty must be beginner, intermediate, or advanced',
      },
      default: 'intermediate',
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [5, 'Duration must be at least 5 minutes'],
      max: [180, 'Duration cannot exceed 180 minutes'],
      default: 30,
    },
    passingPercentage: {
      type: Number,
      required: [true, 'Passing percentage is required'],
      min: [0, 'Passing percentage cannot be negative'],
      max: [100, 'Passing percentage cannot exceed 100'],
      default: 60,
    },
    maxAttempts: {
      type: Number,
      required: [true, 'Max attempts is required'],
      min: [1, 'Must allow at least 1 attempt'],
      default: 3,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assessment creator is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Optimize candidate published list querying and admin chronological feeds
assessmentSchema.index({ isPublished: 1, createdAt: -1 });
assessmentSchema.index({ createdAt: -1 });

const Assessment =
  mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema);

module.exports = Assessment;
