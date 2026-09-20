/**
 * Validator for question creation.
 */
const validateCreateQuestion = (req, res, next) => {
  const { text, options, correctOptionIndex, explanation, marks, topic, difficulty } = req.body;
  const errors = [];

  if (!text || typeof text !== 'string' || !text.trim()) {
    errors.push('Question text is required');
  }

  if (!Array.isArray(options) || options.length < 2) {
    errors.push('Question must have an options array with at least 2 options');
  } else {
    for (let i = 0; i < options.length; i++) {
      if (typeof options[i] !== 'string' || !options[i].trim()) {
        errors.push(`Option at index ${i} must be a non-empty string`);
      }
    }
  }

  if (
    correctOptionIndex === undefined ||
    typeof correctOptionIndex !== 'number' ||
    !Number.isInteger(correctOptionIndex) ||
    correctOptionIndex < 0
  ) {
    errors.push('correctOptionIndex must be a non-negative integer');
  } else if (Array.isArray(options) && (correctOptionIndex < 0 || correctOptionIndex >= options.length)) {
    errors.push(`correctOptionIndex (${correctOptionIndex}) is out of bounds for options length (${options.length})`);
  }

  if (marks !== undefined) {
    if (typeof marks !== 'number' || !Number.isInteger(marks) || marks < 1) {
      errors.push('marks must be an integer of at least 1');
    }
  }

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    errors.push('Topic is required');
  }

  if (
    difficulty !== undefined &&
    !['beginner', 'intermediate', 'advanced'].includes(difficulty)
  ) {
    errors.push('Difficulty must be beginner, intermediate, or advanced');
  }

  if (explanation !== undefined && typeof explanation !== 'string') {
    errors.push('Explanation must be a string');
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
 * Validator for question updates.
 */
const validateUpdateQuestion = (req, res, next) => {
  const { text, options, correctOptionIndex, explanation, marks, topic, difficulty } = req.body;
  const errors = [];

  if (text !== undefined && (typeof text !== 'string' || !text.trim())) {
    errors.push('Question text cannot be empty');
  }

  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      errors.push('options must be an array with at least 2 options');
    } else {
      for (let i = 0; i < options.length; i++) {
        if (typeof options[i] !== 'string' || !options[i].trim()) {
          errors.push(`Option at index ${i} must be a non-empty string`);
        }
      }
    }
  }

  if (correctOptionIndex !== undefined) {
    if (
      typeof correctOptionIndex !== 'number' ||
      !Number.isInteger(correctOptionIndex) ||
      correctOptionIndex < 0
    ) {
      errors.push('correctOptionIndex must be a non-negative integer');
    }
  }

  if (marks !== undefined) {
    if (typeof marks !== 'number' || !Number.isInteger(marks) || marks < 1) {
      errors.push('marks must be an integer of at least 1');
    }
  }

  if (topic !== undefined && (typeof topic !== 'string' || !topic.trim())) {
    errors.push('Topic cannot be empty');
  }

  if (
    difficulty !== undefined &&
    !['beginner', 'intermediate', 'advanced'].includes(difficulty)
  ) {
    errors.push('Difficulty must be beginner, intermediate, or advanced');
  }

  if (explanation !== undefined && typeof explanation !== 'string') {
    errors.push('Explanation must be a string');
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
  validateCreateQuestion,
  validateUpdateQuestion,
};
