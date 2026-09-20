/**
 * Validate assessment creation payload.
 */
const validateCreateAssessment = (req, res, next) => {
  const {
    title,
    description,
    difficulty,
    durationMinutes,
    passingPercentage,
    maxAttempts,
  } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Title is required');
  } else if (title.trim().length > 150) {
    errors.push('Title cannot exceed 150 characters');
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  if (
    difficulty !== undefined &&
    !['beginner', 'intermediate', 'advanced'].includes(difficulty)
  ) {
    errors.push('Difficulty must be beginner, intermediate, or advanced');
  }

  if (durationMinutes !== undefined) {
    if (
      typeof durationMinutes !== 'number' ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 180
    ) {
      errors.push('Duration must be an integer between 5 and 180 minutes');
    }
  }

  if (passingPercentage !== undefined) {
    if (
      typeof passingPercentage !== 'number' ||
      passingPercentage < 0 ||
      passingPercentage > 100
    ) {
      errors.push('Passing percentage must be a number between 0 and 100');
    }
  }

  if (maxAttempts !== undefined) {
    if (
      typeof maxAttempts !== 'number' ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1
    ) {
      errors.push('Max attempts must be an integer of at least 1');
    }
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
 * Validate assessment update payload.
 */
const validateUpdateAssessment = (req, res, next) => {
  const {
    title,
    description,
    difficulty,
    durationMinutes,
    passingPercentage,
    maxAttempts,
    isPublished,
  } = req.body;
  const errors = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      errors.push('Title cannot be empty');
    } else if (title.trim().length > 150) {
      errors.push('Title cannot exceed 150 characters');
    }
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  if (
    difficulty !== undefined &&
    !['beginner', 'intermediate', 'advanced'].includes(difficulty)
  ) {
    errors.push('Difficulty must be beginner, intermediate, or advanced');
  }

  if (durationMinutes !== undefined) {
    if (
      typeof durationMinutes !== 'number' ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 180
    ) {
      errors.push('Duration must be an integer between 5 and 180 minutes');
    }
  }

  if (passingPercentage !== undefined) {
    if (
      typeof passingPercentage !== 'number' ||
      passingPercentage < 0 ||
      passingPercentage > 100
    ) {
      errors.push('Passing percentage must be a number between 0 and 100');
    }
  }

  if (maxAttempts !== undefined) {
    if (
      typeof maxAttempts !== 'number' ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1
    ) {
      errors.push('Max attempts must be an integer of at least 1');
    }
  }

  if (isPublished !== undefined && typeof isPublished !== 'boolean') {
    errors.push('isPublished must be a boolean');
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
  validateCreateAssessment,
  validateUpdateAssessment,
};
