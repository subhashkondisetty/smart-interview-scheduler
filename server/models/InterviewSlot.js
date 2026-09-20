const mongoose = require('mongoose');

const interviewSlotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: 'Technical Mock Interview',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    interviewerName: {
      type: String,
      trim: true,
      default: 'Senior Technical Interviewer',
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [15, 'Duration must be at least 15 minutes'],
      default: 45,
    },
    capacity: {
      type: Number,
      required: true,
      min: [1, 'Capacity must be at least 1'],
      default: 1,
    },
    bookedCount: {
      type: Number,
      default: 0,
      min: [0, 'Booked count cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['available', 'booked', 'cancelled', 'completed'],
        message: 'Status must be available, booked, cancelled, or completed',
      },
      default: 'available',
    },
    meetingLink: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Slot must be associated with an admin creator'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes to optimize slot searching and overlap lookups
interviewSlotSchema.index({ startTime: 1, status: 1 });
interviewSlotSchema.index({ status: 1, startTime: 1 });
interviewSlotSchema.index({ createdBy: 1, status: 1, startTime: 1, endTime: 1 });

const InterviewSlot =
  mongoose.models.InterviewSlot || mongoose.model('InterviewSlot', interviewSlotSchema);

module.exports = InterviewSlot;
