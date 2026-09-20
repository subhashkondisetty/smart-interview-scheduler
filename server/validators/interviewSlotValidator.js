/**
 * Validation middleware for creating an interview slot.
 */
const validateCreateSlot = (req, res, next) => {
  const { startTime, durationMinutes, capacity, title, interviewerName, description, meetingLink } = req.body;
  const errors = [];

  if (!startTime) {
    errors.push('Start time is required');
  } else {
    const parsedDate = new Date(startTime);
    if (isNaN(parsedDate.getTime())) {
      errors.push('Start time must be a valid date/time');
    } else if (parsedDate <= new Date()) {
      errors.push('Start time cannot be in the past');
    }
  }

  if (durationMinutes !== undefined) {
    if (
      typeof durationMinutes !== 'number' ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 300
    ) {
      errors.push('Duration must be an integer between 15 and 300 minutes');
    }
  }

  if (capacity !== undefined) {
    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) {
      errors.push('Capacity must be an integer of at least 1');
    }
  }

  if (title !== undefined && typeof title !== 'string') {
    errors.push('Title must be a string');
  }

  if (interviewerName !== undefined && typeof interviewerName !== 'string') {
    errors.push('Interviewer name must be a string');
  }

  if (description !== undefined && (typeof description !== 'string' || description.length > 2000)) {
    errors.push('Description must be a string with a maximum of 2000 characters');
  }

  if (meetingLink !== undefined && (typeof meetingLink !== 'string' || meetingLink.length > 500)) {
    errors.push('Meeting link must be a string with a maximum of 500 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
};

/**
 * Validation middleware for updating an interview slot.
 */
const validateUpdateSlot = (req, res, next) => {
  const { startTime, durationMinutes, capacity, title, interviewerName, status, description, meetingLink } = req.body;
  const errors = [];

  if (startTime !== undefined) {
    const parsedDate = new Date(startTime);
    if (isNaN(parsedDate.getTime())) {
      errors.push('Start time must be a valid date/time');
    } else if (parsedDate <= new Date()) {
      errors.push('Start time cannot be in the past');
    }
  }

  if (durationMinutes !== undefined) {
    if (
      typeof durationMinutes !== 'number' ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 300
    ) {
      errors.push('Duration must be an integer between 15 and 300 minutes');
    }
  }

  if (capacity !== undefined) {
    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) {
      errors.push('Capacity must be an integer of at least 1');
    }
  }

  if (status !== undefined) {
    if (!['available', 'booked', 'cancelled', 'completed'].includes(status)) {
      errors.push('Status must be available, booked, cancelled, or completed');
    }
  }

  if (title !== undefined && typeof title !== 'string') {
    errors.push('Title must be a string');
  }

  if (interviewerName !== undefined && typeof interviewerName !== 'string') {
    errors.push('Interviewer name must be a string');
  }

  if (description !== undefined && (typeof description !== 'string' || description.length > 2000)) {
    errors.push('Description must be a string with a maximum of 2000 characters');
  }

  if (meetingLink !== undefined && (typeof meetingLink !== 'string' || meetingLink.length > 500)) {
    errors.push('Meeting link must be a string with a maximum of 500 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
};

module.exports = {
  validateCreateSlot,
  validateUpdateSlot,
};
