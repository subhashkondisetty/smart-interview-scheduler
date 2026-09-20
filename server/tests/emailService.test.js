const request = require('supertest');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const app = require('../app');
const User = require('../models/User');
const InterviewSlot = require('../models/InterviewSlot');
const InterviewBooking = require('../models/InterviewBooking');
const emailService = require('../services/emailService');

describe('Email Service & Booking Notification Integration', () => {
  const secret = 'email_test_jwt_secret_12345678901234567890';
  let originalSecret;
  let originalEnv;

  const candidateId = '507f1f77bcf86cd799439011';
  let candidateToken;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    originalEnv = { ...process.env };

    process.env.JWT_SECRET = secret;
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'testuser';
    process.env.EMAIL_PASS = 'testpass';

    candidateToken = jwt.sign(
      { id: candidateId, email: 'candidate@test.com', role: 'candidate' },
      secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Direct Email Service Unit Tests', () => {
    test('sendBookingConfirmationEmail calls nodemailer sendMail with correct recipient, subject, and template content', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-12345' });
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: sendMailMock,
      });

      const candidate = { email: 'candidate@test.com' };
      const slot = {
        title: 'System Design Mock Interview',
        interviewerName: 'Staff SDE',
        startTime: new Date('2026-10-15T14:00:00.000Z'),
        durationMinutes: 60,
        meetingLink: 'https://meet.google.com/abc-defg-hij',
      };
      const booking = { _id: '707f1f77bcf86cd799439011' };

      const result = await emailService.sendBookingConfirmationEmail(candidate, slot, booking);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-12345');
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const mailOptions = sendMailMock.mock.calls[0][0];
      expect(mailOptions.to).toBe('candidate@test.com');
      expect(mailOptions.subject).toMatch(/Booking Confirmed: System Design Mock Interview/);
      expect(mailOptions.html).toContain('System Design Mock Interview');
      expect(mailOptions.html).toContain('Staff SDE');
      expect(mailOptions.html).toContain('https://meet.google.com/abc-defg-hij');
    });

    test('sendEmail handles SMTP transport errors gracefully without throwing', async () => {
      const sendMailMock = jest.fn().mockRejectedValue(new Error('SMTP Connection Refused'));
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: sendMailMock,
      });

      const result = await emailService.sendEmail({
        to: 'candidate@test.com',
        subject: 'Test subject',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP Connection Refused');
    });

    test('all email templates (welcome, cancellation, reschedule, assessment, reminder) compile and dispatch cleanly', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-ok' });
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: sendMailMock,
      });

      const user = { email: 'candidate@test.com' };
      const slot = {
        title: 'Algorithms Mock',
        interviewerName: 'Lead Engineer',
        startTime: new Date('2026-11-01T10:00:00.000Z'),
        durationMinutes: 45,
      };
      const newSlot = {
        title: 'Algorithms Mock',
        interviewerName: 'Lead Engineer',
        startTime: new Date('2026-11-02T10:00:00.000Z'),
        durationMinutes: 45,
      };

      await emailService.sendWelcomeEmail(user);
      await emailService.sendBookingCancellationEmail(user, slot, {});
      await emailService.sendBookingRescheduleEmail(user, slot, newSlot, {});
      await emailService.sendAssessmentCompletionEmail(user, { title: 'JS Core' }, { score: 8, totalMarks: 10, percentage: 80, passed: true });
      await emailService.sendInterviewReminderEmail(user, slot, {});

      expect(sendMailMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration & Fault Tolerance: Booking Creation Hooks Email', () => {
    test('mocks the mailer and asserts it is called with the right template on booking creation', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateId,
        email: 'candidate@test.com',
        role: 'candidate',
        isActive: true,
      });

      const futureDate = new Date(Date.now() + 48 * 3600000);
      const slotDoc = {
        _id: '607f1f77bcf86cd799439099',
        title: 'Distributed Systems Mock',
        interviewerName: 'Senior Architect',
        startTime: futureDate,
        durationMinutes: 60,
        meetingLink: 'https://meet.google.com/xyz-123',
        capacity: 1,
        bookedCount: 0,
        status: 'available',
      };

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotDoc);
      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null);

      const updatedSlotDoc = {
        ...slotDoc,
        bookedCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue(updatedSlotDoc);

      const bookingDoc = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateId,
        slot: slotDoc._id,
        status: 'confirmed',
      };
      jest.spyOn(InterviewBooking, 'create').mockResolvedValue(bookingDoc);
      jest.spyOn(InterviewBooking, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...bookingDoc,
          slot: slotDoc,
        }),
      });

      // Mock the mailer transporter
      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-booking-created' });
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: sendMailMock,
      });

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ slotId: '607f1f77bcf86cd799439099' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Wait a microtask tick for the non-blocking email dispatch to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const mailArgs = sendMailMock.mock.calls[0][0];
      expect(mailArgs.to).toBe('candidate@test.com');
      expect(mailArgs.subject).toMatch(/Booking Confirmed: Distributed Systems Mock/i);
      expect(mailArgs.html).toContain('Distributed Systems Mock');
      expect(mailArgs.html).toContain('Senior Architect');
      expect(mailArgs.html).toContain('https://meet.google.com/xyz-123');
    });

    test('booking succeeds even when email service completely fails (fault tolerance)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateId,
        email: 'candidate@test.com',
        role: 'candidate',
        isActive: true,
      });

      const futureDate = new Date(Date.now() + 48 * 3600000);
      const slotDoc = {
        _id: '607f1f77bcf86cd799439099',
        title: 'Backend Mock',
        startTime: futureDate,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
      };

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotDoc);
      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null);

      const updatedSlotDoc = {
        ...slotDoc,
        bookedCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue(updatedSlotDoc);

      const bookingDoc = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateId,
        slot: slotDoc._id,
        status: 'confirmed',
      };
      jest.spyOn(InterviewBooking, 'create').mockResolvedValue(bookingDoc);
      jest.spyOn(InterviewBooking, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...bookingDoc,
          slot: slotDoc,
        }),
      });

      // Mailer fails with network rejection
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: jest.fn().mockRejectedValue(new Error('Connection lost')),
      });

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ slotId: '607f1f77bcf86cd799439099' });

      // API call MUST NOT fail
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Interview slot booked successfully');
    });
  });
});
