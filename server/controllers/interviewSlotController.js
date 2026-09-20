const InterviewSlot = require('../models/InterviewSlot');
const InterviewBooking = require('../models/InterviewBooking');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

/**
 * Check if a time interval overlaps with any existing non-cancelled slot for this admin.
 * Standard interval overlap: (existing.startTime < newEnd) && (existing.endTime > newStart)
 */
const checkSlotOverlap = async (adminId, startTime, endTime, excludeSlotId = null) => {
  const query = {
    createdBy: adminId,
    status: { $ne: 'cancelled' },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeSlotId) {
    query._id = { $ne: excludeSlotId };
  }

  return InterviewSlot.findOne(query);
};

/**
 * @desc    Create a new interview slot
 * @route   POST /api/admin/interview-slots
 * @access  Private (Admin only)
 */
const createSlot = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    interviewerName,
    startTime,
    durationMinutes = 45,
    capacity = 1,
    meetingLink,
  } = req.body;

  const adminId = req.user._id || req.user.id;
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  // Overlap prevention check
  const overlapping = await checkSlotOverlap(adminId, start, end);
  if (overlapping) {
    return res.status(400).json({
      success: false,
      message: 'Interview slot overlaps with an existing non-cancelled slot for this interviewer/admin.',
    });
  }

  const slot = await InterviewSlot.create({
    title,
    description,
    interviewerName,
    startTime: start,
    endTime: end,
    durationMinutes,
    capacity,
    meetingLink,
    createdBy: adminId,
  });

  res.status(201).json({
    success: true,
    message: 'Interview slot created successfully',
    data: {
      slot,
    },
  });
});

/**
 * @desc    Get all interview slots (Admin management view)
 * @route   GET /api/admin/interview-slots
 * @access  Private (Admin only)
 */
const getAdminSlots = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.startTime = {};
    if (startDate) filter.startTime.$gte = new Date(startDate);
    if (endDate) filter.startTime.$lte = new Date(endDate);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const [total, slots] = await Promise.all([
    InterviewSlot.countDocuments(filter),
    InterviewSlot.find(filter)
      .populate('createdBy', 'email role')
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    count: slots.length,
    data: {
      slots,
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
 * @desc    Get single interview slot by ID
 * @route   GET /api/admin/interview-slots/:id
 * @access  Private (Admin only)
 */
const getSlotById = asyncHandler(async (req, res) => {
  const slot = await InterviewSlot.findById(req.params.id).populate('createdBy', 'email role');

  if (!slot) {
    return res.status(404).json({
      success: false,
      message: 'Interview slot not found',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      slot,
    },
  });
});

/**
 * @desc    Update an interview slot
 * @route   PUT /api/admin/interview-slots/:id
 * @access  Private (Admin only)
 */
const updateSlot = asyncHandler(async (req, res) => {
  const slot = await InterviewSlot.findById(req.params.id);

  if (!slot) {
    return res.status(404).json({
      success: false,
      message: 'Interview slot not found',
    });
  }

  const {
    title,
    description,
    interviewerName,
    startTime,
    durationMinutes,
    capacity,
    status,
    meetingLink,
  } = req.body;

  const adminId = slot.createdBy;
  const newStart = startTime ? new Date(startTime) : slot.startTime;
  const newDuration = durationMinutes !== undefined ? durationMinutes : slot.durationMinutes;
  const newEnd = new Date(newStart.getTime() + newDuration * 60000);

  // If time or duration has changed, re-check overlap
  if (startTime || durationMinutes !== undefined) {
    const overlapping = await checkSlotOverlap(adminId, newStart, newEnd, slot._id);
    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'Interview slot overlaps with an existing non-cancelled slot for this interviewer/admin.',
      });
    }
  }

  if (title !== undefined) slot.title = title;
  if (description !== undefined) slot.description = description;
  if (interviewerName !== undefined) slot.interviewerName = interviewerName;
  if (startTime !== undefined) slot.startTime = newStart;
  if (durationMinutes !== undefined) {
    slot.durationMinutes = newDuration;
    slot.endTime = newEnd;
  }
  if (capacity !== undefined) slot.capacity = capacity;
  if (status !== undefined) slot.status = status;
  if (meetingLink !== undefined) slot.meetingLink = meetingLink;

  await slot.save();

  res.status(200).json({
    success: true,
    message: 'Interview slot updated successfully',
    data: {
      slot,
    },
  });
});

/**
 * @desc    Delete an interview slot
 * @route   DELETE /api/admin/interview-slots/:id
 * @access  Private (Admin only)
 */
const deleteSlot = asyncHandler(async (req, res) => {
  const slot = await InterviewSlot.findById(req.params.id);

  if (!slot) {
    return res.status(404).json({
      success: false,
      message: 'Interview slot not found',
    });
  }

  // If slot has active bookings, cancel it and cascade to bookings
  if (slot.bookedCount > 0) {
    slot.status = 'cancelled';
    slot.bookedCount = 0;
    if (typeof slot.save === 'function') {
      await slot.save();
    }

    // Atomic cascade: transition each active booking to cancelled using findOneAndUpdate guard
    const activeBookings = await InterviewBooking.find({
      slot: slot._id,
      status: 'confirmed',
    }).populate('candidate', 'email role');

    const cancelledAt = new Date();
    const transitionedBookings = [];
    for (const booking of activeBookings) {
      const updatedBooking = await InterviewBooking.findOneAndUpdate(
        {
          _id: booking._id,
          slot: slot._id,
          status: 'confirmed',
        },
        {
          $set: {
            status: 'cancelled',
            cancelledAt,
          },
        },
        { new: true }
      ).populate('candidate', 'email role');

      if (updatedBooking) {
        transitionedBookings.push(updatedBooking);

        // WINNING BRANCH ONLY: Fire-and-forget email and notification dispatch with .catch()
        const formattedTime = slot.startTime
          ? new Date(slot.startTime).toUTCString()
          : 'scheduled time';

        if (updatedBooking.candidate) {
          emailService
            .sendBookingCancellationEmail(
              updatedBooking.candidate,
              slot,
              updatedBooking,
              { cancelledByAdmin: true }
            )
            .catch((err) => {
              console.error('[Slot Delete Cascade] Failed to send cancellation email:', err.message);
            });
        }

        notificationService
          .createNotification({
            userId: updatedBooking.candidate?._id || updatedBooking.candidate,
            type: 'booking_cancelled',
            message: `Your interview booking for "${slot.title}" on ${formattedTime} was cancelled because the session was cancelled by an administrator.`,
          })
          .catch((err) => {
            console.error('[Slot Delete Cascade] Failed to send cancellation notification:', err.message);
          });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Interview slot has existing bookings; slot and associated bookings were marked as cancelled.',
      data: {
        slot,
        cancelledBookingsCount: transitionedBookings.length,
      },
    });
  }

  await InterviewSlot.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Interview slot deleted successfully',
  });
});

/**
 * @desc    Get candidate-visible available future interview slots
 * @route   GET /api/interview-slots
 * @access  Public / Candidate
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const now = new Date();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  const slots = await InterviewSlot.find({
    status: 'available',
    startTime: { $gt: now },
    $expr: { $lt: ['$bookedCount', '$capacity'] },
  })
    .select('-__v')
    .sort({ startTime: 1 })
    .limit(limit);

  res.status(200).json({
    success: true,
    count: slots.length,
    data: {
      slots,
    },
  });
});

module.exports = {
  createSlot,
  getAdminSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
  getAvailableSlots,
};
