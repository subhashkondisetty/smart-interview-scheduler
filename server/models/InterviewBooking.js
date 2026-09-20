const mongoose = require('mongoose');

const interviewBookingSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Candidate reference is required'],
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSlot',
      required: [true, 'Slot reference is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['confirmed', 'cancelled', 'completed', 'rescheduled'],
        message: 'Status must be confirmed, cancelled, completed, or rescheduled',
      },
      default: 'confirmed',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    rescheduledTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSlot',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize candidate and slot lookups
interviewBookingSchema.index({ candidate: 1, status: 1 });
interviewBookingSchema.index({ candidate: 1, createdAt: -1 });
interviewBookingSchema.index({ slot: 1, status: 1 });

/**
 * Partial Unique Index:
 * Guarantees at most ONE confirmed booking per candidate per interview slot at any moment.
 * Does not restrict historical cancelled, completed, or rescheduled bookings on the same slot.
 */
interviewBookingSchema.index(
  { candidate: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

const InterviewBooking =
  mongoose.models.InterviewBooking ||
  mongoose.model('InterviewBooking', interviewBookingSchema);

module.exports = InterviewBooking;
