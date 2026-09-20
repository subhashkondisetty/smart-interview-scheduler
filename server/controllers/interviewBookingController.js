const mongoose = require('mongoose');
const User = require('../models/User');
const InterviewBooking = require('../models/InterviewBooking');
const InterviewSlot = require('../models/InterviewSlot');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

/**
 * @desc    Book an interview slot
 * @route   POST /api/candidate/bookings
 * @access  Private (Candidate only)
 * @note    Uses atomic findOneAndUpdate with capacity guard ($expr: bookedCount < capacity)
 *          to strictly prevent race conditions and overbooking.
 */
const bookSlot = asyncHandler(async (req, res) => {
  const { slotId, notes } = req.body;
  const candidateId = req.user._id || req.user.id;

  // 1. Verify slot existence and timing
  const slot = await InterviewSlot.findById(slotId);
  if (!slot) {
    return res.status(404).json({
      success: false,
      message: 'Interview slot not found.',
    });
  }

  if (new Date(slot.startTime) <= new Date()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot book a past or ongoing interview slot.',
    });
  }

  // 2. Enforce: One active booking per candidate per slot (no duplicate booking)
  const existingActiveBooking = await InterviewBooking.findOne({
    candidate: candidateId,
    slot: slotId,
    status: 'confirmed',
  });

  if (existingActiveBooking) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active booking for this interview slot.',
    });
  }

  // 3. Atomic capacity guard: Increment bookedCount and conditionally update status in one atomic write
  const updatedSlot = await InterviewSlot.findOneAndUpdate(
    {
      _id: slotId,
      status: 'available',
      startTime: { $gt: new Date() },
      $expr: { $lt: ['$bookedCount', '$capacity'] },
    },
    [
      {
        $set: {
          bookedCount: { $add: ['$bookedCount', 1] },
          status: {
            $cond: {
              if: { $gte: [{ $add: ['$bookedCount', 1] }, '$capacity'] },
              then: 'booked',
              else: '$status',
            },
          },
        },
      },
    ],
    { new: true }
  );

  if (!updatedSlot) {
    return res.status(409).json({
      success: false,
      message: 'This interview slot is fully booked or no longer available.',
    });
  }

  // 4. Create the confirmed booking
  try {
    const booking = await InterviewBooking.create({
      candidate: candidateId,
      slot: slotId,
      status: 'confirmed',
      notes: notes || '',
    });

    const populatedBooking = await InterviewBooking.findById(booking._id).populate('slot');

    // Non-blocking fault-tolerant email dispatch
    emailService.sendBookingConfirmationEmail(req.user, updatedSlot, booking).catch((err) => {
      console.error('[Booking] Failed to send confirmation email:', err.message);
    });

    // In-app notification dispatch
    notificationService.createNotification({
      userId: candidateId,
      type: 'booking_confirmed',
      message: `Interview booking confirmed for slot on ${new Date(updatedSlot.startTime).toUTCString()}.`,
    }).catch((err) => {
      console.error('[Notification] Failed to send booking confirmation notification:', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Interview slot booked successfully',
      data: {
        booking: populatedBooking,
      },
    });
  } catch (err) {
    // Rollback atomic increment if booking creation fails
    await InterviewSlot.findByIdAndUpdate(slotId, {
      $inc: { bookedCount: -1 },
      status: 'available',
    });

    // Intercept partial unique index duplicate-key collision
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active booking for this interview slot.',
      });
    }

    throw err;
  }
});

/**
 * @desc    Get candidate's own booking history
 * @route   GET /api/candidate/bookings
 * @access  Private (Candidate only)
 */
const getCandidateBookings = asyncHandler(async (req, res) => {
  const candidateId = req.user._id || req.user.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const [total, bookings] = await Promise.all([
    InterviewBooking.countDocuments({ candidate: candidateId }),
    InterviewBooking.find({ candidate: candidateId })
      .populate('slot')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: {
      bookings,
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
 * @desc    Cancel candidate's own booking
 * @route   PATCH /api/candidate/bookings/:id/cancel
 * @access  Private (Candidate only)
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const candidateId = req.user._id || req.user.id;
  const bookingId = req.params.id;

  const booking = await InterviewBooking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Interview booking not found.',
    });
  }

  // Ownership guard
  if (booking.candidate.toString() !== candidateId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. You can only cancel your own bookings.',
    });
  }

  // Atomic transition guard: only transition if still confirmed
  const updatedBooking = await InterviewBooking.findOneAndUpdate(
    {
      _id: bookingId,
      candidate: candidateId,
      status: 'confirmed',
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updatedBooking) {
    return res.status(400).json({
      success: false,
      message: 'This booking has already been cancelled or modified by another request.',
    });
  }

  // Release slot capacity strictly using winning updatedBooking.slot
  await InterviewSlot.findByIdAndUpdate(updatedBooking.slot, {
    $inc: { bookedCount: -1 },
    $set: { status: 'available' },
  });

  const populatedBooking = await InterviewBooking.findById(updatedBooking._id).populate('slot');

  // Non-blocking fault-tolerant email dispatch
  emailService.sendBookingCancellationEmail(req.user, populatedBooking.slot, populatedBooking).catch((err) => {
    console.error('[Booking] Failed to send cancellation email:', err.message);
  });

  // In-app notification dispatch
  notificationService.createNotification({
    userId: candidateId,
    type: 'booking_cancelled',
    message: `Interview booking for slot on ${populatedBooking.slot ? new Date(populatedBooking.slot.startTime).toUTCString() : 'scheduled time'} has been cancelled.`,
  }).catch((err) => {
    console.error('[Notification] Failed to send booking cancellation notification:', err.message);
  });

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking: populatedBooking,
    },
  });
});

/**
 * @desc    Reschedule candidate's own booking to a new slot
 * @route   PATCH /api/candidate/bookings/:id/reschedule
 * @access  Private (Candidate only)
 */
const rescheduleBooking = asyncHandler(async (req, res) => {
  const candidateId = req.user._id || req.user.id;
  const bookingId = req.params.id;
  const { newSlotId, notes } = req.body;

  const booking = await InterviewBooking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Interview booking not found.',
    });
  }

  // Ownership guard
  if (booking.candidate.toString() !== candidateId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. You can only reschedule your own bookings.',
    });
  }

  if (booking.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: `Cannot reschedule a ${booking.status} booking.`,
    });
  }

  if (booking.slot.toString() === newSlotId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'New slot must be different from current slot.',
    });
  }

  // Step 1: Claim target slot capacity atomically using update pipeline
  const claimedNewSlot = await InterviewSlot.findOneAndUpdate(
    {
      _id: newSlotId,
      status: 'available',
      startTime: { $gt: new Date() },
      $expr: { $lt: ['$bookedCount', '$capacity'] },
    },
    [
      {
        $set: {
          bookedCount: { $add: ['$bookedCount', 1] },
          status: {
            $cond: {
              if: { $gte: [{ $add: ['$bookedCount', 1] }, '$capacity'] },
              then: 'booked',
              else: '$status',
            },
          },
        },
      },
    ],
    { new: true }
  );

  if (!claimedNewSlot) {
    return res.status(409).json({
      success: false,
      message: 'The target interview slot is fully booked or no longer available.',
    });
  }

  // Step 2: Transition old booking atomically
  const updatedOldBooking = await InterviewBooking.findOneAndUpdate(
    {
      _id: bookingId,
      candidate: candidateId,
      status: 'confirmed',
    },
    {
      $set: {
        status: 'rescheduled',
        rescheduledTo: newSlotId,
      },
    },
    { new: true }
  );

  if (!updatedOldBooking) {
    // Compensating rollback: release claimed capacity on new slot
    await InterviewSlot.findByIdAndUpdate(newSlotId, {
      $inc: { bookedCount: -1 },
      $set: { status: 'available' },
    });

    return res.status(400).json({
      success: false,
      message: 'This booking has already been cancelled or modified by another request.',
    });
  }

  // Step 3: Create new confirmed booking (protected against duplicate-key 11000)
  let newBooking;
  try {
    newBooking = await InterviewBooking.create({
      candidate: candidateId,
      slot: newSlotId,
      status: 'confirmed',
      notes: notes !== undefined ? notes : booking.notes,
    });
  } catch (err) {
    // Compensating rollback: release new slot capacity and revert old booking status
    await InterviewSlot.findByIdAndUpdate(newSlotId, {
      $inc: { bookedCount: -1 },
      $set: { status: 'available' },
    });

    await InterviewBooking.findByIdAndUpdate(bookingId, {
      $set: {
        status: 'confirmed',
        rescheduledTo: null,
      },
    });

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active booking for the target interview slot.',
      });
    }

    throw err;
  }

  // Step 4: Release previous slot capacity strictly using updatedOldBooking.slot
  await InterviewSlot.findByIdAndUpdate(updatedOldBooking.slot, {
    $inc: { bookedCount: -1 },
    $set: { status: 'available' },
  });

  const populatedNewBooking = await InterviewBooking.findById(newBooking._id).populate('slot');

  // Step 5: Notifications & emails
  emailService.sendBookingRescheduleEmail(req.user, updatedOldBooking.slot, claimedNewSlot, newBooking).catch((err) => {
    console.error('[Booking] Failed to send reschedule email:', err.message);
  });

  notificationService.createNotification({
    userId: candidateId,
    type: 'booking_rescheduled',
    message: `Interview booking rescheduled to new slot on ${new Date(claimedNewSlot.startTime).toUTCString()}.`,
  }).catch((err) => {
    console.error('[Notification] Failed to send booking reschedule notification:', err.message);
  });

  res.status(200).json({
    success: true,
    message: 'Booking rescheduled successfully',
    data: {
      newBooking: populatedNewBooking,
      previousBooking: updatedOldBooking,
    },
  });
});

/**
 * @desc    Get all bookings (Admin view)
 * @route   GET /api/admin/bookings
 * @access  Private (Admin only)
 */
const getAdminBookings = asyncHandler(async (req, res) => {
  const { status, slotId, candidateId } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (slotId) filter.slot = slotId;
  if (candidateId) filter.candidate = candidateId;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const [total, bookings] = await Promise.all([
    InterviewBooking.countDocuments(filter),
    InterviewBooking.find(filter)
      .populate('candidate', 'email role')
      .populate('slot')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: {
      bookings,
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
 * @desc    Cancel a booking on candidate's behalf (Admin)
 * @route   PATCH /api/admin/bookings/:id/cancel
 * @access  Private (Admin only)
 */
const adminCancelBooking = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;

  const booking = await InterviewBooking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Interview booking not found.',
    });
  }

  if (booking.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel a ${booking.status} booking.`,
    });
  }

  // Atomic transition guard: only transition if still confirmed
  const updatedBooking = await InterviewBooking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'confirmed',
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updatedBooking) {
    return res.status(400).json({
      success: false,
      message: 'This booking has already been cancelled or modified by another request.',
    });
  }

  // Release slot capacity strictly using winning updatedBooking.slot
  await InterviewSlot.findByIdAndUpdate(updatedBooking.slot, {
    $inc: { bookedCount: -1 },
    $set: { status: 'available' },
  });

  const populatedBooking = await InterviewBooking.findById(updatedBooking._id)
    .populate('slot')
    .populate('candidate', 'email role');

  // WINNING BRANCH ONLY: Non-blocking fault-tolerant email dispatch
  if (populatedBooking.candidate) {
    emailService
      .sendBookingCancellationEmail(
        populatedBooking.candidate,
        populatedBooking.slot,
        populatedBooking,
        { cancelledByAdmin: true }
      )
      .catch((err) => {
        console.error('[Admin Booking Cancel] Failed to send cancellation email:', err.message);
      });
  }

  // WINNING BRANCH ONLY: In-app notification dispatch
  notificationService
    .createNotification({
      userId: updatedBooking.candidate,
      type: 'booking_cancelled',
      message: `Your interview booking for slot on ${populatedBooking.slot ? new Date(populatedBooking.slot.startTime).toUTCString() : 'scheduled time'} was cancelled by an administrator.`,
    })
    .catch((err) => {
      console.error('[Admin Notification] Failed to send booking cancellation notification:', err.message);
    });

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully on candidate behalf',
    data: {
      booking: populatedBooking,
    },
  });
});

/**
 * @desc    Reschedule a booking to a new slot on candidate's behalf (Admin)
 * @route   PATCH /api/admin/bookings/:id/reschedule
 * @access  Private (Admin only)
 */
const adminRescheduleBooking = asyncHandler(async (req, res) => {
  const bookingId = req.params.id;
  const { newSlotId, notes } = req.body;

  const booking = await InterviewBooking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Interview booking not found.',
    });
  }

  if (booking.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: `Cannot reschedule a ${booking.status} booking.`,
    });
  }

  if (booking.slot.toString() === newSlotId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'New slot must be different from current slot.',
    });
  }

  // Step 1: Claim target slot capacity atomically using update pipeline
  const claimedNewSlot = await InterviewSlot.findOneAndUpdate(
    {
      _id: newSlotId,
      status: 'available',
      startTime: { $gt: new Date() },
      $expr: { $lt: ['$bookedCount', '$capacity'] },
    },
    [
      {
        $set: {
          bookedCount: { $add: ['$bookedCount', 1] },
          status: {
            $cond: {
              if: { $gte: [{ $add: ['$bookedCount', 1] }, '$capacity'] },
              then: 'booked',
              else: '$status',
            },
          },
        },
      },
    ],
    { new: true }
  );

  if (!claimedNewSlot) {
    return res.status(409).json({
      success: false,
      message: 'The target interview slot is fully booked or no longer available.',
    });
  }

  // Step 2: Transition old booking atomically
  const updatedOldBooking = await InterviewBooking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'confirmed',
    },
    {
      $set: {
        status: 'rescheduled',
        rescheduledTo: newSlotId,
      },
    },
    { new: true }
  );

  if (!updatedOldBooking) {
    // Compensating rollback: release claimed capacity on new slot
    await InterviewSlot.findByIdAndUpdate(newSlotId, {
      $inc: { bookedCount: -1 },
      $set: { status: 'available' },
    });

    return res.status(400).json({
      success: false,
      message: 'This booking has already been cancelled or modified by another request.',
    });
  }

  // Step 3: Create new confirmed booking (protected against duplicate-key 11000)
  let newBooking;
  try {
    newBooking = await InterviewBooking.create({
      candidate: updatedOldBooking.candidate,
      slot: newSlotId,
      status: 'confirmed',
      notes: notes !== undefined ? notes : booking.notes,
    });
  } catch (err) {
    // Compensating rollback: release new slot capacity and revert old booking status
    await InterviewSlot.findByIdAndUpdate(newSlotId, {
      $inc: { bookedCount: -1 },
      $set: { status: 'available' },
    });

    await InterviewBooking.findByIdAndUpdate(bookingId, {
      $set: {
        status: 'confirmed',
        rescheduledTo: null,
      },
    });

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'The candidate already has an active booking for the target interview slot.',
      });
    }

    throw err;
  }

  // Step 4: Release previous slot capacity strictly using updatedOldBooking.slot
  await InterviewSlot.findByIdAndUpdate(updatedOldBooking.slot, {
    $inc: { bookedCount: -1 },
    $set: { status: 'available' },
  });

  const populatedNewBooking = await InterviewBooking.findById(newBooking._id)
    .populate('slot')
    .populate('candidate', 'email role');

  // Step 5: WINNING BRANCH ONLY: Notifications & emails (fire-and-forget, non-blocking)
  if (populatedNewBooking.candidate) {
    emailService
      .sendBookingRescheduleEmail(
        populatedNewBooking.candidate,
        updatedOldBooking.slot,
        claimedNewSlot,
        newBooking
      )
      .catch((err) => {
        console.error('[Admin Booking Reschedule] Failed to send reschedule email:', err.message);
      });
  }

  notificationService
    .createNotification({
      userId: updatedOldBooking.candidate,
      type: 'booking_rescheduled',
      message: `Your interview booking was rescheduled by an administrator to a new slot on ${new Date(claimedNewSlot.startTime).toUTCString()}.`,
    })
    .catch((err) => {
      console.error('[Admin Notification] Failed to send booking reschedule notification:', err.message);
    });

  res.status(200).json({
    success: true,
    message: 'Booking rescheduled successfully on candidate behalf',
    data: {
      newBooking: populatedNewBooking,
      previousBooking: updatedOldBooking,
    },
  });
});

module.exports = {
  bookSlot,
  getCandidateBookings,
  cancelBooking,
  rescheduleBooking,
  getAdminBookings,
  adminCancelBooking,
  adminRescheduleBooking,
};
