const nodemailer = require('nodemailer');

/**
 * Create and return Nodemailer transporter based on environment configuration.
 */
const getTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

// PII sanitization helper for structured logging
const maskEmail = (email) =>
  email ? String(email).replace(/^(.)(.*)(@.*)$/, (_, f, m, d) => `${f}${'*'.repeat(Math.min(m.length, 5))}${d}`) : '';

/**
 * Core sendEmail utility with SMTP fallback and simulation mode
 * Dispatches HTML/text emails via Nodemailer with non-blocking error handling.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = getTransporter();

    if (!transporter) {
      console.warn(`[EmailService] SMTP credentials not fully configured. Email to ${maskEmail(to)} was simulated.`);
      return { success: false, simulated: true };
    }

    const fromAddress = process.env.EMAIL_FROM || '"Smart Interview Platform" <no-reply@smartinterview.io>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html,
    });

    console.log(`[EmailService] Email sent to ${maskEmail(to)}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Non-blocking fault tolerance: log error and return structured failure
    console.error(`[EmailService] Failed to send email to ${maskEmail(to)}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * 1. Send Registration Welcome Email
 */
const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Smart Interview Scheduler & Mock Assessment Platform!';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">Welcome to Smart Interview Platform</h2>
      <p>Hello <strong>${user.email}</strong>,</p>
      <p>Thank you for creating an account with us. You're all set to supercharge your SDE preparation with:</p>
      <ul>
        <li>Interactive Mock Assessments with automated real-time grading</li>
        <li>1-on-1 SDE Mock Interview slots with industry mentors</li>
        <li>Topic-wise performance tracking and analytics</li>
      </ul>
      <p>Log in to complete your profile and book your first mock session.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: user.email, subject, html });
};

/**
 * 2. Send Booking Confirmation Email
 */
const sendBookingConfirmationEmail = async (candidate, slot, booking) => {
  const subject = `Booking Confirmed: ${slot.title || 'Mock Interview'}`;
  const startTimeFormatted = new Date(slot.startTime).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #16a34a;">Interview Booking Confirmed</h2>
      <p>Hello <strong>${candidate.email}</strong>,</p>
      <p>Your mock interview has been scheduled successfully. Here are your session details:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Topic:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${slot.title || 'Technical Mock Interview'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Interviewer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${slot.interviewerName || 'Senior Interviewer'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date & Time:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${startTimeFormatted}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${slot.durationMinutes || 45} minutes</td></tr>
        ${slot.meetingLink ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Meeting Link:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="${slot.meetingLink}" style="color: #2563eb;">${slot.meetingLink}</a></td></tr>` : ''}
      </table>
      <p style="margin-top: 15px;">Please make sure to join 5 minutes early in a quiet environment.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: candidate.email, subject, html });
};

/**
 * 3. Send Booking Cancellation Email
 */
const sendBookingCancellationEmail = async (candidate, slot, booking, options = {}) => {
  const { cancelledByAdmin = false } = options;
  const subject = cancelledByAdmin
    ? `Booking Cancelled by Admin: ${slot ? slot.title : 'Mock Interview'}`
    : `Booking Cancelled: ${slot ? slot.title : 'Mock Interview'}`;
  const startTimeFormatted = slot
    ? new Date(slot.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    : 'Scheduled Time';

  const reasonText = cancelledByAdmin
    ? 'This session was cancelled by an administrator.'
    : 'The slot has been freed.';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #dc2626;">Interview Booking Cancelled${cancelledByAdmin ? ' by Administrator' : ''}</h2>
      <p>Hello <strong>${candidate.email}</strong>,</p>
      <p>Your mock interview session scheduled for <strong>${startTimeFormatted}</strong> has been cancelled.</p>
      <p>${reasonText} You can visit your dashboard anytime to browse and book an alternative interview slot.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: candidate.email, subject, html });
};

/**
 * 4. Send Booking Reschedule Email
 */
const sendBookingRescheduleEmail = async (candidate, oldSlot, newSlot, booking) => {
  const subject = `Booking Rescheduled: ${newSlot.title || 'Mock Interview'}`;
  const newTimeFormatted = new Date(newSlot.startTime).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #d97706;">Interview Booking Rescheduled</h2>
      <p>Hello <strong>${candidate.email}</strong>,</p>
      <p>Your mock interview has been successfully moved to the new time below:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>New Date & Time:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${newTimeFormatted}</strong></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Topic:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${newSlot.title || 'Technical Mock Interview'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Interviewer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${newSlot.interviewerName || 'Senior Interviewer'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${newSlot.durationMinutes || 45} minutes</td></tr>
      </table>
      <p>Your previous time slot has been released.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: candidate.email, subject, html });
};

/**
 * 5. Send Assessment Completion Email
 */
const sendAssessmentCompletionEmail = async (candidate, assessment, result) => {
  const subject = `Assessment Completed: ${assessment.title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">Assessment Results Ready</h2>
      <p>Hello <strong>${candidate.email}</strong>,</p>
      <p>You have completed the assessment <strong>${assessment.title}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Score:</strong> ${result.score} / ${result.totalMarks}</p>
        <p style="margin: 5px 0;"><strong>Percentage:</strong> ${result.percentage}%</p>
        <p style="margin: 5px 0;"><strong>Outcome:</strong> ${result.passed ? '<span style="color: #16a34a; font-weight: bold;">PASSED</span>' : '<span style="color: #dc2626; font-weight: bold;">NEEDS IMPROVEMENT</span>'}</p>
      </div>
      <p>Log in to your candidate dashboard to view detailed topic-wise analytics and question breakdowns.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: candidate.email, subject, html });
};

/**
 * 6. Send Interview Reminder Email (Callable function; cron/scheduler integration in Phase 5)
 */
const sendInterviewReminderEmail = async (candidate, slot, booking) => {
  const subject = `Reminder: Upcoming Mock Interview (${slot.title || 'Mock Interview'})`;
  const startTimeFormatted = new Date(slot.startTime).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">Interview Reminder</h2>
      <p>Hello <strong>${candidate.email}</strong>,</p>
      <p>This is a reminder that your mock interview is coming up soon:</p>
      <p><strong>Session:</strong> ${slot.title || 'Technical Mock Interview'}</p>
      <p><strong>Time:</strong> ${startTimeFormatted}</p>
      ${slot.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${slot.meetingLink}">${slot.meetingLink}</a></p>` : ''}
      <p>We recommend testing your camera and microphone beforehand.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: candidate.email, subject, html });
};

/**
 * 7. Send Password Reset Email
 */
const sendPasswordResetEmail = async (user, resetUrl) => {
  const subject = 'Password Reset Request - Smart Interview Platform';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4f46e5;">Password Reset Request</h2>
      <p>Hello <strong>${user.email}</strong>,</p>
      <p>We received a request to reset your password for your SmartPrep account. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset My Password</a>
      </div>
      <p style="font-size: 14px; color: #555;">This link will expire in <strong>15 minutes</strong>. If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized activity.</p>
      <p style="font-size: 12px; color: #888; word-break: break-all;">Or copy and paste this link into your browser: <br/><a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Smart Interview Scheduler &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  return sendEmail({ to: user.email, subject, html });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingRescheduleEmail,
  sendAssessmentCompletionEmail,
  sendInterviewReminderEmail,
  sendPasswordResetEmail,
  getTransporter,
};
