const mongoose = require('mongoose');

const validateBroadcastNotification = (req, res, next) => {
  const { message, candidateId, userIds } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Message is required and cannot be empty',
    });
  }

  if (candidateId !== undefined) {
    if (typeof candidateId !== 'string' || !mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid candidate ID format',
      });
    }
  }

  if (userIds !== undefined) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipient userIds cannot be empty when specified',
      });
    }
    const hasInvalid = ids.some(
      (id) => !id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)
    );
    if (hasInvalid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format in recipient list',
      });
    }
  }

  next();
};

const validateNotificationId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification ID format',
    });
  }

  next();
};

module.exports = {
  validateBroadcastNotification,
  validateNotificationId,
};
