const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Validator for booking an interview slot.
 */
const validateBookSlot = (req, res, next) => {
  const { slotId, notes } = req.body;
  const errors = [];

  if (!slotId) {
    errors.push('slotId is required');
  } else if (!isValidObjectId(slotId)) {
    errors.push('slotId must be a valid MongoDB ObjectId');
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
    errors.push('notes must be a string with a maximum of 500 characters');
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
 * Validator for rescheduling an interview slot.
 */
const validateReschedule = (req, res, next) => {
  const { newSlotId, notes } = req.body;
  const errors = [];

  if (!newSlotId) {
    errors.push('newSlotId is required');
  } else if (!isValidObjectId(newSlotId)) {
    errors.push('newSlotId must be a valid MongoDB ObjectId');
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
    errors.push('notes must be a string with a maximum of 500 characters');
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
  validateBookSlot,
  validateReschedule,
};
