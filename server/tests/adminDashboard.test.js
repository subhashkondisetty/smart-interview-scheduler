const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const InterviewBooking = require('../models/InterviewBooking');
const cronService = require('../services/cronService');

describe('Admin Dashboard Aggregation API (GET /api/admin/dashboard)', () => {
  const secret = 'admin_dashboard_jwt_secret_1234567890123456';
  let originalSecret;

  const adminId = '507f1f77bcf86cd799439001';
  const candidateId = '507f1f77bcf86cd799439002';

  let adminToken;
  let candidateToken;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = '1h';

    adminToken = jwt.sign(
      { id: adminId, email: 'admin@test.com', role: 'admin' },
      secret,
      { expiresIn: '1h' }
    );
    candidateToken = jwt.sign(
      { id: candidateId, email: 'candidate@test.com', role: 'candidate' },
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
      if (idStr === adminId) {
        return {
          _id: adminId,
          email: 'admin@test.com',
          role: 'admin',
          isActive: true,
        };
      }
      if (idStr === candidateId) {
        return {
          _id: candidateId,
          email: 'candidate@test.com',
          role: 'candidate',
          isActive: true,
        };
      }
      return null;
    });

    jest.spyOn(cronService, 'autoExpireElapsedAttempts').mockResolvedValue({
      success: true,
      modifiedCount: 0,
    });
  });

  // 1. Dashboard Aggregate Shape & Correctness against Seeded Data
  test('1. Aggregate shape & correctness: returns totalCandidates, totalInterviewsScheduled, interviewStats, bookingStats, assessmentStats, and recent activity feeds', async () => {
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000);

    const mockBookings = [
      {
        _id: '707f1f77bcf86cd799439011',
        status: 'confirmed',
        slot: {
          _id: '807f1f77bcf86cd799439011',
          title: 'Frontend Mock Interview',
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 45 * 60 * 1000),
          durationMinutes: 45,
        },
      },
      {
        _id: '707f1f77bcf86cd799439012',
        status: 'confirmed',
        slot: {
          _id: '807f1f77bcf86cd799439012',
          title: 'Backend Mock Interview',
          startTime: pastDate,
          endTime: new Date(pastDate.getTime() + 60 * 60 * 1000),
          durationMinutes: 60,
        },
      },
      {
        _id: '707f1f77bcf86cd799439013',
        status: 'cancelled',
        slot: {
          _id: '807f1f77bcf86cd799439013',
          title: 'DevOps Mock Interview',
          startTime: futureDate,
        },
      },
      {
        _id: '707f1f77bcf86cd799439014',
        status: 'rescheduled',
        slot: {
          _id: '807f1f77bcf86cd799439014',
          title: 'System Design Mock Interview',
          startTime: futureDate,
        },
      },
    ];

    const mockCompletedAttempts = [
      { score: 18, percentage: 90 },
      { score: 14, percentage: 70 },
    ];

    const mockRecentRegistrations = [
      { _id: '507f1f77bcf86cd799439002', email: 'candidate@test.com', createdAt: new Date(Date.now() - 1000) },
    ];

    const mockRecentBookings = [
      {
        _id: '707f1f77bcf86cd799439011',
        status: 'confirmed',
        candidate: { email: 'candidate@test.com' },
        slot: { title: 'Frontend Mock Interview', startTime: futureDate },
        createdAt: new Date(Date.now() - 2000),
      },
    ];

    const mockRecentAttempts = [
      {
        _id: '907f1f77bcf86cd799439001',
        status: 'completed',
        score: 18,
        percentage: 90,
        candidateId: { email: 'candidate@test.com' },
        assessmentId: { title: 'JavaScript Mastery' },
        createdAt: new Date(Date.now() - 3000),
      },
    ];

    jest.spyOn(User, 'countDocuments').mockResolvedValue(5);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRecentRegistrations),
    });

    jest.spyOn(Assessment, 'countDocuments').mockImplementation(async (filter) => {
      if (filter && filter.isPublished === true) return 3;
      return 4;
    });

    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(8);
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockImplementation(async () => {
          if (filter && filter.status === 'completed') {
            return mockCompletedAttempts;
          }
          return mockRecentAttempts;
        }),
      };
      return chain;
    });

    jest.spyOn(InterviewBooking, 'find').mockImplementation(() => {
      let isSorted = false;
      const chain = {
        sort: jest.fn().mockImplementation(() => {
          isSorted = true;
          return chain;
        }),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockImplementation(async () => {
          return isSorted ? mockRecentBookings : mockBookings;
        }),
      };
      return chain;
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;

    // Total Candidates
    expect(data.totalCandidates).toBe(5);

    // Total Scheduled Interviews & Breakdowns
    expect(data.totalInterviewsScheduled).toBe(2);
    expect(data.interviewStats).toEqual({
      totalScheduled: 2,
      upcoming: 1,
      completed: 1,
    });

    // Booking Breakdown
    expect(data.bookingStats).toEqual({
      total: 4,
      upcoming: 1,
      completed: 1,
      cancelled: 1,
      rescheduled: 1,
    });

    // Assessment Stats
    expect(data.assessmentStats).toEqual({
      publishedCount: 3,
      totalAssessments: 4,
      totalAttempts: 8,
      completedAttempts: 2,
      averageScore: 16,
      averagePercentage: 80,
    });

    // Recent Activity Feed
    expect(Array.isArray(data.recentActivityFeed)).toBe(true);
    expect(data.recentActivityFeed.length).toBe(3);
    expect(data.recentRegistrations.length).toBe(1);
    expect(data.recentBookings.length).toBe(1);
    expect(data.recentAttempts.length).toBe(1);
  });

  // 2. Mutually-Exclusive Bucketing Invariant (Architectural Decision #19)
  test('2. Mutually-exclusive bucketing invariant: upcoming + completed + cancelled + rescheduled strictly equals total bookings', async () => {
    const futureDate = new Date(Date.now() + 10 * 3600 * 1000);
    const pastDate = new Date(Date.now() - 10 * 3600 * 1000);

    const mockBookings = [
      { _id: 'b1', status: 'confirmed', slot: { startTime: futureDate } },
      { _id: 'b2', status: 'confirmed', slot: { startTime: futureDate } },
      { _id: 'b3', status: 'confirmed', slot: { startTime: pastDate } },
      { _id: 'b4', status: 'completed', slot: { startTime: pastDate } },
      { _id: 'b5', status: 'cancelled', slot: { startTime: futureDate } },
      { _id: 'b6', status: 'cancelled', slot: { startTime: pastDate } },
      { _id: 'b7', status: 'rescheduled', slot: { startTime: futureDate } },
    ];

    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockBookings),
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { bookingStats, interviewStats } = res.body.data;

    expect(bookingStats.total).toBe(7);
    expect(bookingStats.upcoming).toBe(2);
    expect(bookingStats.completed).toBe(2);
    expect(bookingStats.cancelled).toBe(2);
    expect(bookingStats.rescheduled).toBe(1);

    // Strict invariant check
    const sumBuckets =
      bookingStats.upcoming +
      bookingStats.completed +
      bookingStats.cancelled +
      bookingStats.rescheduled;
    expect(sumBuckets).toBe(bookingStats.total);

    // Active pipeline invariant
    expect(interviewStats.totalScheduled).toBe(bookingStats.upcoming + bookingStats.completed);
    expect(interviewStats.upcoming).toBe(bookingStats.upcoming);
    expect(interviewStats.completed).toBe(bookingStats.completed);
  });

  // 3. Temporal Partitioning of Confirmed Bookings
  test('3. Confirmed booking temporal partitioning: partitions confirmed bookings based on slot startTime relative to current time', async () => {
    const futureDate = new Date(Date.now() + 50000);
    const pastDate = new Date(Date.now() - 50000);

    const mockBookings = [
      { _id: 'b1', status: 'confirmed', slot: { startTime: futureDate } },
      { _id: 'b2', status: 'confirmed', slot: { startTime: pastDate } },
    ];

    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockBookings),
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { bookingStats, interviewStats } = res.body.data;

    expect(bookingStats.upcoming).toBe(1);
    expect(bookingStats.completed).toBe(1);
    expect(interviewStats.upcoming).toBe(1);
    expect(interviewStats.completed).toBe(1);
    expect(bookingStats.cancelled).toBe(0);
    expect(bookingStats.rescheduled).toBe(0);
  });

  // 4. Orphaned Booking / Null-Slot Resilience
  test('4. Orphaned booking resilience: booking with null/unpopulated slot returns 200 OK without crashing and falls back to completed', async () => {
    const futureDate = new Date(Date.now() + 50000);

    const mockBookings = [
      // Normal confirmed booking with valid slot
      { _id: 'b1', status: 'confirmed', slot: { startTime: futureDate } },
      // Orphaned confirmed booking whose slot was deleted (slot is null)
      { _id: 'b2', status: 'confirmed', slot: null },
      // Orphaned confirmed booking whose slot is missing startTime
      { _id: 'b3', status: 'confirmed', slot: {} },
    ];

    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockBookings),
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    // Endpoint must not crash with TypeError: Cannot read properties of null
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { bookingStats, interviewStats } = res.body.data;
    expect(bookingStats.total).toBe(3);
    // b1 is upcoming
    expect(bookingStats.upcoming).toBe(1);
    // b2 and b3 safely fall back to completed
    expect(bookingStats.completed).toBe(2);
    // Total invariant holds
    expect(
      bookingStats.upcoming +
      bookingStats.completed +
      bookingStats.cancelled +
      bookingStats.rescheduled
    ).toBe(bookingStats.total);
    expect(interviewStats.totalScheduled).toBe(3);
  });

  // 5. Activity Feed Assembly & Sorting
  test('5. Activity feed assembly: merges candidate registrations, interview bookings, and assessment attempts sorted descending by timestamp', async () => {
    const t1 = new Date('2026-09-01T10:00:00Z');
    const t2 = new Date('2026-09-01T12:00:00Z');
    const t3 = new Date('2026-09-01T14:00:00Z');

    const mockRecentRegistrations = [
      { _id: 'u1', email: 'reg@test.com', createdAt: t1 },
    ];

    const mockRecentBookings = [
      {
        _id: 'b1',
        status: 'confirmed',
        candidate: { email: 'booker@test.com' },
        slot: { title: 'Arch Review' },
        createdAt: t3,
      },
    ];

    const mockRecentAttempts = [
      {
        _id: 'a1',
        status: 'completed',
        score: 10,
        percentage: 100,
        candidateId: { email: 'tester@test.com' },
        assessmentId: { title: 'Security 101' },
        createdAt: t2,
      },
    ];

    jest.spyOn(User, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRecentRegistrations),
    });

    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockImplementation(async () => {
          if (filter && filter.status === 'completed') return [];
          return mockRecentAttempts;
        }),
      };
      return chain;
    });

    jest.spyOn(InterviewBooking, 'find').mockImplementation(() => {
      let isSorted = false;
      const chain = {
        sort: jest.fn().mockImplementation(() => {
          isSorted = true;
          return chain;
        }),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockImplementation(async () => {
          return isSorted ? mockRecentBookings : [];
        }),
      };
      return chain;
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const feed = res.body.data.recentActivityFeed;
    expect(feed.length).toBe(3);

    // Strictly descending by timestamp: t3 (booking) -> t2 (attempt) -> t1 (registration)
    expect(feed[0].type).toBe('interview_booking');
    expect(feed[0].id).toBe('b1');
    expect(new Date(feed[0].timestamp)).toEqual(t3);

    expect(feed[1].type).toBe('assessment_attempt');
    expect(feed[1].id).toBe('a1');
    expect(new Date(feed[1].timestamp)).toEqual(t2);

    expect(feed[2].type).toBe('candidate_registered');
    expect(feed[2].id).toBe('u1');
    expect(new Date(feed[2].timestamp)).toEqual(t1);
  });

  // 6. Activity Feed Limit Customization
  test('6. Activity feed limit: respects ?limit=N parameter, defaulting to 10 and clamping at 50', async () => {
    let capturedUserLimit = null;
    let capturedBookingLimit = null;
    let capturedAttemptLimit = null;

    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockImplementation(() => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation((val) => {
          capturedUserLimit = val;
          return chain;
        }),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      return chain;
    });

    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation((val) => {
          capturedAttemptLimit = val;
          return chain;
        }),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      return chain;
    });

    jest.spyOn(InterviewBooking, 'find').mockImplementation(() => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation((val) => {
          capturedBookingLimit = val;
          return chain;
        }),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      return chain;
    });

    // Custom limit = 5
    const resCustom = await request(app)
      .get('/api/admin/dashboard?limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resCustom.status).toBe(200);
    expect(capturedUserLimit).toBe(5);
    expect(capturedBookingLimit).toBe(5);
    expect(capturedAttemptLimit).toBe(5);

    // Excessive limit clamped to 50
    await request(app)
      .get('/api/admin/dashboard?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(capturedUserLimit).toBe(50);

    // Invalid / missing limit defaults to 10
    await request(app)
      .get('/api/admin/dashboard?limit=invalid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(capturedUserLimit).toBe(10);
  });

  // 7. Zero State / Empty Platform Handling
  test('7. Empty platform handling: returns zero for all counts, averages 0, and empty arrays with zero errors', async () => {
    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.totalCandidates).toBe(0);
    expect(data.totalInterviewsScheduled).toBe(0);
    expect(data.interviewStats).toEqual({ totalScheduled: 0, upcoming: 0, completed: 0 });
    expect(data.bookingStats).toEqual({ total: 0, upcoming: 0, completed: 0, cancelled: 0, rescheduled: 0 });
    expect(data.assessmentStats).toEqual({
      publishedCount: 0,
      totalAssessments: 0,
      totalAttempts: 0,
      completedAttempts: 0,
      averageScore: 0,
      averagePercentage: 0,
    });
    expect(data.recentActivityFeed).toEqual([]);
    expect(data.recentRegistrations).toEqual([]);
    expect(data.recentBookings).toEqual([]);
    expect(data.recentAttempts).toEqual([]);
  });

  // 8. On-Access Expiry Sweep Invocation
  test('8. On-access expiry sweep: invokes cronService.autoExpireElapsedAttempts before calculating statistics', async () => {
    const sweepSpy = jest.spyOn(cronService, 'autoExpireElapsedAttempts').mockResolvedValue({
      success: true,
      modifiedCount: 2,
    });

    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(sweepSpy).toHaveBeenCalledTimes(1);
  });

  // 9. Role & Auth Protection
  test('9. Role & auth protection: admin returns 200, candidate returns 403 Forbidden, missing token returns 401 Unauthorized', async () => {
    // 9a. Missing token -> 401
    const resNoToken = await request(app).get('/api/admin/dashboard');
    expect(resNoToken.status).toBe(401);

    // 9b. Candidate role -> 403 Forbidden
    const resCandidate = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(resCandidate.status).toBe(403);

    // 9c. Admin role -> 200 OK
    jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(Assessment, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AssessmentAttempt, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const resAdmin = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAdmin.status).toBe(200);
  });
});
