const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Notification = require('../models/Notification');
const InterviewSlot = require('../models/InterviewSlot');
const InterviewBooking = require('../models/InterviewBooking');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { finalizeExpiredAttempt } = require('../services/scoringService');

describe('Notification System & Event Pipeline', () => {
  const secret = 'notification_test_jwt_secret_12345678901234567890';
  let originalSecret;

  const candidateAId = '507f1f77bcf86cd799439011';
  const candidateBId = '507f1f77bcf86cd799439022';
  const adminId = '507f1f77bcf86cd799439033';

  let tokenA;
  let tokenB;
  let adminToken;

  const notifA1Id = '607f1f77bcf86cd799439081';
  const notifA2Id = '607f1f77bcf86cd799439082';
  const notifB1Id = '607f1f77bcf86cd799439083';

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = '1h';

    tokenA = jwt.sign(
      { id: candidateAId, email: 'candidateA@test.com', role: 'candidate' },
      secret,
      { expiresIn: '1h' }
    );
    tokenB = jwt.sign(
      { id: candidateBId, email: 'candidateB@test.com', role: 'candidate' },
      secret,
      { expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { id: adminId, email: 'admin@test.com', role: 'admin' },
      secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation(async (id) => {
      const idStr = id ? id.toString() : '';
      if (idStr === candidateAId) {
        return {
          _id: candidateAId,
          email: 'candidateA@test.com',
          role: 'candidate',
          isActive: true,
        };
      }
      if (idStr === candidateBId) {
        return {
          _id: candidateBId,
          email: 'candidateB@test.com',
          role: 'candidate',
          isActive: true,
        };
      }
      if (idStr === adminId) {
        return {
          _id: adminId,
          email: 'admin@test.com',
          role: 'admin',
          isActive: true,
        };
      }
      return null;
    });
  });

  // 1. GET /api/notifications - Paginated retrieval and unread count
  test('1. Paginated retrieval: returns paginated notifications with totalPages, hasNext, hasPrev, and unreadCount', async () => {
    const mockNotifications = [
      {
        _id: notifA1Id,
        userId: candidateAId,
        type: 'booking_confirmed',
        message: 'Interview booking confirmed',
        isRead: false,
        createdAt: new Date(),
      },
    ];

    jest.spyOn(Notification, 'countDocuments').mockImplementation(async (filter) => {
      if (filter && filter.isRead === false) return 1;
      return 1;
    });

    const mockSort = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockResolvedValue(mockNotifications);

    jest.spyOn(Notification, 'find').mockReturnValue({
      sort: mockSort,
      skip: mockSkip,
      limit: mockLimit,
    });

    const res = await request(app)
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications.length).toBe(1);
    expect(res.body.data.notifications[0].type).toBe('booking_confirmed');
    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(res.body.data.unreadCount).toBe(1);
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  // 2. GET /api/notifications filtering by isRead
  test('2. Filter by isRead: filters notifications correctly when isRead query param is provided', async () => {
    let capturedFilter = null;
    jest.spyOn(Notification, 'countDocuments').mockImplementation(async (filter) => {
      capturedFilter = filter;
      return 1;
    });

    jest.spyOn(Notification, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          _id: notifA1Id,
          userId: candidateAId,
          type: 'booking_confirmed',
          message: 'Interview booking confirmed',
          isRead: false,
        },
      ]),
    });

    const res = await request(app)
      .get('/api/notifications?isRead=false')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(capturedFilter.isRead).toBe(false);
  });

  // 3. GET /api/notifications ownership isolation
  test('3. Ownership isolation: query is strictly scoped to authenticated user ID', async () => {
    let queriedUserId = null;
    jest.spyOn(Notification, 'countDocuments').mockImplementation(async (filter) => {
      queriedUserId = filter.userId;
      return 0;
    });

    jest.spyOn(Notification, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(queriedUserId).toBe(candidateBId);
  });

  // 4. PATCH /api/notifications/:id/read marks notification as read
  test('4. Mark notification as read: updates isRead to true and returns updated notification', async () => {
    const updatedDoc = {
      _id: notifA1Id,
      userId: candidateAId,
      type: 'booking_confirmed',
      message: 'Interview booking confirmed',
      isRead: true,
    };

    jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(updatedDoc);

    const res = await request(app)
      .patch(`/api/notifications/${notifA1Id}/read`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notification.isRead).toBe(true);
    expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: notifA1Id, userId: candidateAId },
      { $set: { isRead: true } },
      { new: true }
    );
  });

  // 5. PATCH /api/notifications/:id/read anti-enumeration protection
  test('5. Anti-enumeration ownership protection: Candidate B attempting to mark Candidate A notification as read receives 404', async () => {
    // findOneAndUpdate with { _id, userId: candidateBId } returns null because it belongs to candidateAId
    jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/notifications/${notifA1Id}/read`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Notification not found');
  });

  // 6. PATCH /api/notifications/:id/read invalid ObjectId validation
  test('6. Invalid ObjectId: returns 400 Bad Request for malformed notification ID', async () => {
    const res = await request(app)
      .patch('/api/notifications/invalid-id-format/read')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid notification ID format');
  });

  // 7. PATCH /api/notifications/read-all marks all unread as read
  test('7. Mark all as read: updates all unread notifications for authenticated user to isRead: true', async () => {
    jest.spyOn(Notification, 'updateMany').mockResolvedValue({
      acknowledged: true,
      modifiedCount: 3,
    });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('All notifications marked as read');
    expect(res.body.data.modifiedCount).toBe(3);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { userId: candidateAId, isRead: false },
      { $set: { isRead: true } }
    );
  });

  // 8. POST /api/admin/notifications/broadcast - Canonical Admin Broadcast
  test('8. Admin broadcast: admin can broadcast to users; candidate role receives 403; empty message returns 400', async () => {
    // 8a. Candidate role rejected with 403
    const forbiddenRes = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Important platform announcement' });

    expect(forbiddenRes.status).toBe(403);

    // 8b. Empty message rejected with 400
    const badReqRes = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: '   ' });

    expect(badReqRes.status).toBe(400);

    // 8c. Admin broadcast success
    jest.spyOn(User, 'find').mockResolvedValue([
      { _id: candidateAId },
      { _id: candidateBId },
    ]);
    jest.spyOn(Notification, 'insertMany').mockResolvedValue([]);

    const successRes = await request(app)
      .post('/api/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Platform maintenance scheduled at midnight', role: 'candidate' });

    expect(successRes.status).toBe(201);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data.recipientCount).toBe(2);
    expect(Notification.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: candidateAId,
          type: 'admin_broadcast',
          message: 'Platform maintenance scheduled at midnight',
          isRead: false,
        }),
        expect.objectContaining({
          userId: candidateBId,
          type: 'admin_broadcast',
          message: 'Platform maintenance scheduled at midnight',
          isRead: false,
        }),
      ])
    );
  });

  // 9. Booking Event Hooks: Booking Confirmed, Cancelled, and Rescheduled
  test('9. Booking event hooks: dispatch booking_confirmed, booking_cancelled, and booking_rescheduled notifications', async () => {
    const slotId = '607f1f77bcf86cd799439091';
    const newSlotId = '607f1f77bcf86cd799439092';
    const futureDate = new Date(Date.now() + 24 * 3600000);
    const newFutureDate = new Date(Date.now() + 48 * 3600000);

    const mockSlot = {
      _id: slotId,
      startTime: futureDate,
      capacity: 1,
      bookedCount: 0,
      status: 'available',
      save: jest.fn().mockResolvedValue(true),
    };

    const mockNewSlot = {
      _id: newSlotId,
      startTime: newFutureDate,
      capacity: 1,
      bookedCount: 0,
      status: 'available',
      save: jest.fn().mockResolvedValue(true),
    };

    const createNotificationSpy = jest.spyOn(notificationService, 'createNotification');

    const makeBookingQuery = (doc) => {
      const q = Promise.resolve(doc);
      q.populate = jest.fn().mockResolvedValue(doc);
      return q;
    };

    // 9a. Book slot
    jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(mockSlot);
    jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null);
    jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue({
      ...mockSlot,
      bookedCount: 1,
    });
    jest.spyOn(InterviewBooking, 'create').mockResolvedValue({
      _id: '707f1f77bcf86cd799439001',
      candidate: candidateAId,
      slot: slotId,
      status: 'confirmed',
    });
    jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) =>
      makeBookingQuery({
        _id: id || '707f1f77bcf86cd799439001',
        candidate: candidateAId,
        slot: mockSlot,
        status: 'confirmed',
        save: jest.fn().mockResolvedValue(true),
      })
    );
    jest.spyOn(emailService, 'sendBookingConfirmationEmail').mockResolvedValue({ success: true });

    await request(app)
      .post('/api/candidate/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ slotId });

    expect(createNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: candidateAId,
        type: 'booking_confirmed',
      })
    );

    // 9b. Cancel booking
    const bookingToCancel = {
      _id: '707f1f77bcf86cd799439001',
      candidate: candidateAId,
      slot: mockSlot,
      status: 'confirmed',
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(InterviewBooking, 'findById').mockImplementation(() => makeBookingQuery(bookingToCancel));
    jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockResolvedValue({
      ...bookingToCancel,
      status: 'cancelled',
    });
    jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockResolvedValue(mockSlot);
    jest.spyOn(emailService, 'sendBookingCancellationEmail').mockResolvedValue({ success: true });

    await request(app)
      .patch('/api/candidate/bookings/707f1f77bcf86cd799439001/cancel')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(createNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: candidateAId,
        type: 'booking_cancelled',
      })
    );

    // 9c. Reschedule booking
    const bookingToReschedule = {
      _id: '707f1f77bcf86cd799439001',
      candidate: candidateAId,
      slot: mockSlot,
      status: 'confirmed',
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) => {
      if (id === '707f1f77bcf86cd799439002') {
        return makeBookingQuery({
          _id: '707f1f77bcf86cd799439002',
          candidate: candidateAId,
          slot: mockNewSlot,
          status: 'confirmed',
          save: jest.fn().mockResolvedValue(true),
        });
      }
      return makeBookingQuery(bookingToReschedule);
    });
    jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(mockNewSlot);
    jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue(mockNewSlot);
    jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockResolvedValue({
      ...bookingToReschedule,
      status: 'rescheduled',
      rescheduledTo: newSlotId,
    });
    jest.spyOn(InterviewBooking, 'create').mockResolvedValue({
      _id: '707f1f77bcf86cd799439002',
      candidate: candidateAId,
      slot: newSlotId,
      status: 'confirmed',
    });
    jest.spyOn(emailService, 'sendBookingRescheduleEmail').mockResolvedValue({ success: true });

    await request(app)
      .patch('/api/candidate/bookings/707f1f77bcf86cd799439001/reschedule')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ newSlotId });

    expect(createNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: candidateAId,
        type: 'booking_rescheduled',
      })
    );
  });

  // 10. Assessment Submit Hook: creates assessment_completed notification
  test('10. Assessment submission hook: submitting an assessment creates assessment_completed notification on winning branch', async () => {
    const assessmentId = '607f1f77bcf86cd799439055';
    const attemptId = '707f1f77bcf86cd799439066';
    const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const mockAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: futureExpiry,
    };

    const mockAssessment = {
      _id: assessmentId,
      title: 'Node.js Mastery',
      passingPercentage: 60,
    };

    const mockQuestions = [
      {
        _id: '807f1f77bcf86cd799439001',
        assessmentId,
        text: 'What is event loop?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        marks: 5,
        topic: 'Node.js',
      },
    ];

    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(mockAttempt);
    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue({
      ...mockAttempt,
      status: 'completed',
      score: 5,
      totalMarks: 5,
      percentage: 100,
      passed: true,
    });
    jest.spyOn(emailService, 'sendAssessmentCompletionEmail').mockResolvedValue({ success: true });
    const createNotificationSpy = jest.spyOn(notificationService, 'createNotification');

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        answers: [{ questionId: '807f1f77bcf86cd799439001', selectedOptionIndex: 0 }],
      });

    expect(res.status).toBe(200);
    expect(createNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: candidateAId,
        type: 'assessment_completed',
        message: expect.stringContaining('Node.js Mastery'),
      })
    );
  });

  // 11. Concurrent finalizeExpiredAttempt Race Guard: Exactly One Notification
  test('11. Concurrent finalizeExpiredAttempt race guard: simultaneous calls on the same attempt produce exactly one assessment_expired notification', async () => {
    const assessmentId = '607f1f77bcf86cd799439055';
    const attemptId = '707f1f77bcf86cd799439077';
    const pastExpiry = new Date(Date.now() - 60 * 1000);

    const rawAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      attemptNumber: 1,
      status: 'in_progress',
      expiresAt: pastExpiry,
      answers: [],
    };

    const mockAssessment = {
      _id: assessmentId,
      title: 'Fullstack Assessment',
      passingPercentage: 60,
    };

    const mockQuestions = [
      {
        _id: '807f1f77bcf86cd799439001',
        assessmentId,
        text: 'What is React?',
        options: ['Library', 'Framework'],
        correctOptionIndex: 0,
        marks: 2,
        topic: 'React',
      },
    ];

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    let currentStatus = 'in_progress';
    const finalizedDoc = {
      ...rawAttempt,
      status: 'expired',
      endTime: pastExpiry,
      score: 0,
      totalMarks: 2,
      percentage: 0,
      passed: false,
    };

    // Atomic findOneAndUpdate simulation: exactly one winner
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      if (filter.status === 'in_progress' && currentStatus === 'in_progress') {
        currentStatus = 'expired';
        return finalizedDoc;
      }
      return null; // Losing concurrent caller matches 0 documents
    });

    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(finalizedDoc);

    const createNotificationSpy = jest.spyOn(notificationService, 'createNotification');
    const notificationModelCreateSpy = jest.spyOn(Notification, 'create').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      userId: candidateAId,
      type: 'assessment_expired',
      message: 'Assessment attempt expired',
      isRead: false,
    });

    // Fire finalizeExpiredAttempt simultaneously from two callers (e.g. cron sweep and on-access check)
    const [result1, result2] = await Promise.all([
      finalizeExpiredAttempt(rawAttempt),
      finalizeExpiredAttempt(rawAttempt),
    ]);

    expect(result1.status).toBe('expired');
    expect(result2.status).toBe('expired');

    // Notification service function is dispatched STRICTLY ONCE by the winning branch of findOneAndUpdate
    expect(createNotificationSpy).toHaveBeenCalledTimes(1);
    expect(createNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: candidateAId,
        type: 'assessment_expired',
        message: expect.stringContaining('Fullstack Assessment'),
      })
    );

    // Underlying Notification document creation is executed STRICTLY ONCE in the database layer
    expect(notificationModelCreateSpy).toHaveBeenCalledTimes(1);
    expect(notificationModelCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: candidateAId,
        type: 'assessment_expired',
        isRead: false,
      })
    );
  });
});
