const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');
const InterviewBooking = require('../models/InterviewBooking');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Notification = require('../models/Notification');
const scoringService = require('../services/scoringService');

describe('Candidate Dashboard Aggregation API (GET /api/candidate/dashboard)', () => {
  const secret = 'candidate_dashboard_jwt_secret_1234567890123456';
  let originalSecret;

  const candidateAId = '507f1f77bcf86cd799439011';
  const candidateBId = '507f1f77bcf86cd799439022';
  const adminId = '507f1f77bcf86cd799439033';

  let tokenA;
  let tokenB;
  let adminToken;

  const assessment1Id = '607f1f77bcf86cd799439041';
  const assessment2Id = '607f1f77bcf86cd799439042';

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

  // 1. Dashboard Aggregate Shape & Correctness against Seeded Data
  test('1. Aggregate shape & correctness: returns profile %, next upcoming interview, recent attempts, average score, unread notifications, and pending actions', async () => {
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000); // Tomorrow
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000); // Yesterday

    const mockProfile = {
      _id: '707f1f77bcf86cd799439001',
      user: candidateAId,
      fullName: 'Alice Candidate',
      profileCompletionPercentage: 85,
      resume: {
        url: '/api/candidate/profile/resume',
        fileName: 'resume.pdf',
        originalName: 'resume.pdf',
      },
    };

    const mockBookings = [
      {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        status: 'confirmed',
        slot: {
          _id: '807f1f77bcf86cd799439011',
          startTime: pastDate,
          durationMinutes: 45,
        },
      },
      {
        _id: '707f1f77bcf86cd799439012',
        candidate: candidateAId,
        status: 'confirmed',
        slot: {
          _id: '807f1f77bcf86cd799439012',
          startTime: futureDate,
          durationMinutes: 60,
        },
      },
    ];

    const mockAttempts = [
      {
        _id: '907f1f77bcf86cd799439021',
        candidateId: candidateAId,
        assessmentId: { _id: assessment1Id, title: 'Node.js Assessment' },
        score: 10,
        percentage: 100,
        status: 'completed',
        createdAt: new Date(Date.now() - 1000),
      },
      {
        _id: '907f1f77bcf86cd799439022',
        candidateId: candidateAId,
        assessmentId: { _id: assessment2Id, title: 'React Assessment' },
        score: 8,
        percentage: 80,
        status: 'completed',
        createdAt: new Date(Date.now() - 2000),
      },
    ];

    // Mock AssessmentAttempt.find
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      // On-access expiry check
      if (filter.status === 'in_progress') {
        return Promise.resolve([]);
      }
      // Completed scores for average
      if (filter.status === 'completed') {
        return {
          lean: jest.fn().mockResolvedValue([
            { score: 10, percentage: 100 },
            { score: 8, percentage: 80 },
          ]),
        };
      }
      // Recent attempts query
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockAttempts),
            }),
          }),
        }),
      };
    });

    // Mock AssessmentAttempt.findOne for active in-progress attempt
    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    // Mock CandidateProfile.findOne
    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProfile),
    });

    // Mock InterviewBooking.find
    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBookings),
      }),
    });

    // Mock Notification.countDocuments
    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(3);

    const res = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profileCompletionPercentage).toBe(85);
    // Picks the future interview slot, ignoring the past one
    expect(res.body.data.nextUpcomingInterview._id).toBe('707f1f77bcf86cd799439012');
    expect(res.body.data.recentAttempts.length).toBe(2);
    // Average score: (10 + 8) / 2 = 9
    expect(res.body.data.averageScore).toBe(9);
    // Average percentage: (100 + 80) / 2 = 90
    expect(res.body.data.averagePercentage).toBe(90);
    expect(res.body.data.unreadNotificationsCount).toBe(3);
    // Profile is 85% (< 100%), so 'Incomplete profile' is in pendingActions
    expect(res.body.data.pendingActions).toContain('Incomplete profile');
    // Resume is present, so 'No resume uploaded' is NOT in pendingActions
    expect(res.body.data.pendingActions).not.toContain('No resume uploaded');
  });

  // 2. Pending Actions Evaluation
  test('2. Pending actions evaluation: handles missing resume, incomplete profile, and in-progress assessment', async () => {
    // 2a. Incomplete profile with no resume
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.status === 'in_progress') return Promise.resolve([]);
      if (filter.status === 'completed') return { lean: jest.fn().mockResolvedValue([]) };
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      };
    });

    // Active in-progress attempt exists
    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '907f1f77bcf86cd799439099',
          status: 'in_progress',
          assessmentId: { title: 'Python Basics' },
        }),
      }),
    });

    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        user: candidateAId,
        profileCompletionPercentage: 40,
        resume: { url: '' }, // No resume
      }),
    });

    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });

    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);

    const res1 = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.pendingActions).toContain('Incomplete profile');
    expect(res1.body.data.pendingActions).toContain('No resume uploaded');
    expect(res1.body.data.pendingActions).toContain('In-progress assessment pending completion');

    // 2b. Complete profile (100%) with resume uploaded and no active attempt
    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });

    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        user: candidateAId,
        profileCompletionPercentage: 100,
        resume: { url: '/api/candidate/profile/resume', fileName: 'cv.pdf' },
      }),
    });

    const res2 = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.pendingActions).toEqual([]);
  });

  // 3. Upcoming Interview Selection & Exclusions
  test('3. Upcoming interview selection: selects earliest future slot, ignores past and cancelled bookings', async () => {
    const nearFuture = new Date(Date.now() + 2 * 3600 * 1000); // in 2 hours
    const farFuture = new Date(Date.now() + 48 * 3600 * 1000); // in 2 days

    const mockBookings = [
      {
        _id: 'bookingFar',
        status: 'confirmed',
        slot: { startTime: farFuture, durationMinutes: 30 },
      },
      {
        _id: 'bookingNear',
        status: 'confirmed',
        slot: { startTime: nearFuture, durationMinutes: 30 },
      },
    ];

    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.status === 'in_progress') return Promise.resolve([]);
      if (filter.status === 'completed') return { lean: jest.fn().mockResolvedValue([]) };
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });

    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockBookings) }),
    });

    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);

    const res = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // Earliest future slot selected
    expect(res.body.data.nextUpcomingInterview._id).toBe('bookingNear');
  });

  // 4. Average Score & Percentage Calculation across Completed Attempts
  test('4. Average score calculation: returns 0 when no completed attempts exist, computes accurate average when present', async () => {
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.status === 'in_progress') return Promise.resolve([]);
      if (filter.status === 'completed') {
        return {
          lean: jest.fn().mockResolvedValue([
            { score: 7, percentage: 70 },
            { score: 9, percentage: 90 },
            { score: 5, percentage: 50 },
          ]),
        };
      }
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);

    const res = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // (7 + 9 + 5) / 3 = 7.0
    expect(res.body.data.averageScore).toBe(7);
    // (70 + 90 + 50) / 3 = 70.0
    expect(res.body.data.averagePercentage).toBe(70);
  });

  // 5. Recent Attempts Cap (Max 5 items)
  test('5. Recent attempts cap: limits recent attempts to 5 items', async () => {
    let limitValue = null;
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.status === 'in_progress') return Promise.resolve([]);
      if (filter.status === 'completed') return { lean: jest.fn().mockResolvedValue([]) };
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockImplementation((val) => {
            limitValue = val;
            return {
              populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
            };
          }),
        }),
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);

    const res = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(limitValue).toBe(5);
  });

  // 6. On-Access Expiry Sweep & Genuine Scoring
  test('6. On-access expiry sweep: stale in-progress attempts are finalized via finalizeExpiredAttempt before aggregating stats', async () => {
    const staleAttempt = {
      _id: '907f1f77bcf86cd799439088',
      candidateId: candidateAId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired 5 mins ago
    };

    const finalizeExpiredSpy = jest
      .spyOn(scoringService, 'finalizeExpiredAttempt')
      .mockResolvedValue({
        ...staleAttempt,
        status: 'expired',
        score: 0,
        totalMarks: 10,
      });

    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.status === 'in_progress') {
        return Promise.resolve([staleAttempt]);
      }
      if (filter.status === 'completed') return { lean: jest.fn().mockResolvedValue([]) };
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(InterviewBooking, 'find').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);

    const res = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(finalizeExpiredSpy).toHaveBeenCalledWith(staleAttempt);
  });

  // 7. Role & Auth Protection
  test('7. Role & auth protection: candidate returns 200, admin returns 403 Forbidden, missing token returns 401 Unauthorized', async () => {
    // 7a. Missing token -> 401
    const resNoToken = await request(app).get('/api/candidate/dashboard');
    expect(resNoToken.status).toBe(401);

    // 7b. Admin role -> 403
    const resAdmin = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAdmin.status).toBe(403);
  });

  // 8. Ownership Isolation between Candidate A and Candidate B
  test('8. Ownership isolation: candidate dashboard queries are strictly scoped to authenticated user ID', async () => {
    let capturedProfileUser = null;
    let capturedBookingCandidate = null;
    let capturedAttemptCandidate = null;
    let capturedNotificationUser = null;

    jest.spyOn(CandidateProfile, 'findOne').mockImplementation((filter) => {
      capturedProfileUser = filter.user;
      return { lean: jest.fn().mockResolvedValue(null) };
    });

    jest.spyOn(InterviewBooking, 'find').mockImplementation((filter) => {
      capturedBookingCandidate = filter.candidate;
      return {
        populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      };
    });

    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      capturedAttemptCandidate = filter.candidateId;
      if (filter.status === 'in_progress') return Promise.resolve([]);
      if (filter.status === 'completed') return { lean: jest.fn().mockResolvedValue([]) };
      return {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });

    jest.spyOn(Notification, 'countDocuments').mockImplementation((filter) => {
      capturedNotificationUser = filter.userId;
      return Promise.resolve(0);
    });

    const res = await request(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    // Schema-verified field names and candidate B isolation
    expect(capturedProfileUser).toBe(candidateBId);
    expect(capturedBookingCandidate).toBe(candidateBId);
    expect(capturedAttemptCandidate).toBe(candidateBId);
    expect(capturedNotificationUser).toBe(candidateBId);
  });
});
