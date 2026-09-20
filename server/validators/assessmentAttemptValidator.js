const mongoose = require('mongoose');

const validateAttemptSubmit = (req, res, next) => {
  const { answers } = req.body;

  if (answers !== undefined && !Array.isArray(answers)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed: answers must be an array',
      errors: [{ field: 'answers', message: 'Answers must be an array of question answers' }],
    });
  }

  if (Array.isArray(answers)) {
    for (let i = 0; i < answers.length; i++) {
      const item = answers[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({
          success: false,
          message: `Validation failed: answer at index ${i} must be an object`,
          errors: [{ field: `answers[${i}]`, message: 'Answer item must be an object' }],
        });
      }

      if (!item.questionId || !mongoose.Types.ObjectId.isValid(item.questionId)) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: answer at index ${i} must include a valid questionId`,
          errors: [{ field: `answers[${i}].questionId`, message: 'Valid questionId is required' }],
        });
      }
    }
  }

  next();
};

module.exports = {
  validateAttemptSubmit,
};
