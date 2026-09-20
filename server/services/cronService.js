const cron = require('node-cron');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const { finalizeExpiredAttempt } = require('./scoringService');

let expiryCronTask = null;

/**
 * Auto-expires any assessment attempt that is still marked 'in_progress'
 * but whose expiry time has passed.
 * Formally scores each elapsed attempt and sets endTime strictly to expiresAt.
 * Used by scheduled cron and callable on-access.
 */
const autoExpireElapsedAttempts = async () => {
  const now = new Date();
  const elapsedAttempts = await AssessmentAttempt.find({
    status: 'in_progress',
    expiresAt: { $lt: now },
  });

  let modifiedCount = 0;
  for (const attempt of elapsedAttempts) {
    const finalized = await finalizeExpiredAttempt(attempt);
    if (finalized && finalized.status === 'expired') {
      modifiedCount++;
    }
  }

  return {
    success: true,
    modifiedCount,
  };
};

/**
 * Start recurring cron job to clean up abandoned / elapsed attempts every 2 minutes.
 * Suppressed in test environments to avoid open handles.
 */
const startExpiryCron = () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (expiryCronTask) {
    return expiryCronTask;
  }

  expiryCronTask = cron.schedule('*/2 * * * *', async () => {
    try {
      const { modifiedCount } = await autoExpireElapsedAttempts();
      if (modifiedCount > 0) {
        console.log(`[CronService] Auto-expired ${modifiedCount} elapsed assessment attempt(s).`);
      }
    } catch (error) {
      console.error(`[CronService] Failed to auto-expire attempts: ${error.message}`);
    }
  });

  return expiryCronTask;
};

/**
 * Stop cron job gracefully during server shutdown.
 */
const stopExpiryCron = () => {
  if (expiryCronTask) {
    expiryCronTask.stop();
    expiryCronTask = null;
  }
};

module.exports = {
  autoExpireElapsedAttempts,
  startExpiryCron,
  stopExpiryCron,
};
