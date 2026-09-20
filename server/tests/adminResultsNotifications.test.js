const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Notification = require('../models/Notification');

describe('Admin Candidate Results & Notifications Test Suite', () => {
  let mongod;
  let adminToken;
  let candidateToken;
  let adminUser;
  let candidateUserA;
  let candidateUserB;
  let inactiveCandidate;
  let assessmentA;
  let assessmentB;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Seed Admin
    adminUser = await User.create({
      email: 'admin_results@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });
    adminToken = adminUser.generateAuthToken();

    // Seed Candidate A (Active, Profiled)
    candidateUserA = await User.create({
      email: 'candidate_a@test.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });
    candidateToken = candidateUserA.generateAuthToken();

    await CandidateProfile.create({
      user: candidateUserA._id,
      fullName: 'Alice Walker',
      headline: 'Senior Cloud Architect (Node.js)',
      skills: ['Node.js', 'C++', 'Distributed Systems'],
      experienceLevel: 'senior',
    });

    // Seed Candidate B (Active, Unprofiled)
    candidateUserB = await User.create({
      email: 'candidate_b@test.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });

    // Seed Inactive Candidate (Deactivated account)
    inactiveCandidate = await User.create({
      email: 'inactive_candidate@test.com',
      password: 'password123',
      role: 'candidate',
      isActive: false,
    });

    // Seed Assessments
    assessmentA = await Assessment.create({
      title: 'Distributed Systems & Microservices',
      description: 'Kafka and Saga event choreography',
      difficulty: 'advanced',
      durationMinutes: 45,
      passingPercentage: 70,
      maxAttempts: 3,
      isPublished: true,
      createdBy: adminUser._id,
    });

    assessmentB = await Assessment.create({
      title: 'Frontend React Architecture',
      description: 'SSR Hydration and Virtual DOM internals',
      difficulty: 'intermediate',
      durationMinutes: 30,
      passingPercentage: 60,
      maxAttempts: 2,
      isPublished: true,
      createdBy: adminUser._id,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    await AssessmentAttempt.deleteMany({});
    await Notification.deleteMany({});
  });

  // ==========================================================================
  // 1. RBAC GUARDS
  // ==========================================================================
  describe('1. RBAC Route Guards', () => {
    test('GET /api/admin/results: rejects unauthenticated (401) and candidate (403)', async () => {
      const unauth = await request(app).get('/api/admin/results');
      expect(unauth.status).toBe(401);

      const forbidden = await request(app)
        .get('/api/admin/results')
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(forbidden.status).toBe(403);

      const allowed = await request(app)
        .get('/api/admin/results')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(allowed.status).toBe(200);
    });

    test('GET /api/admin/results/:id: rejects candidate (403)', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const forbidden = await request(app)
        .get(`/api/admin/results/${fakeId}`)
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(forbidden.status).toBe(403);
    });

    test('GET /api/admin/notifications: rejects candidate (403)', async () => {
      const forbidden = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(forbidden.status).toBe(403);
    });

    test('POST /api/admin/notifications/broadcast: rejects candidate (403)', async () => {
      const forbidden = await request(app)
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ message: 'Unauthorized broadcast test' });
      expect(forbidden.status).toBe(403);
    });
  });

  // ==========================================================================
  // 2. CANDIDATE RESULTS AGGREGATION & FILTERING
  // ==========================================================================
  describe('2. Candidate Results Aggregation, Filtering & Metrics', () => {
    let attempt1, attempt2, attempt3;

    beforeEach(async () => {
      const now = new Date();

      // Attempt 1: Candidate A, Assessment A, Completed, 80%, Passed
      attempt1 = await AssessmentAttempt.create({
        candidateId: candidateUserA._id,
        assessmentId: assessmentA._id,
        attemptNumber: 1,
        startTime: new Date(now - 30 * 60 * 1000),
        endTime: now,
        expiresAt: new Date(now + 15 * 60 * 1000),
        status: 'completed',
        score: 8,
        totalMarks: 10,
        percentage: 80,
        passed: true,
        topicBreakdown: [
          { topic: 'Kafka', score: 4, totalMarks: 5, percentage: 80, correctCount: 2, totalQuestions: 2 },
          { topic: 'Saga', score: 4, totalMarks: 5, percentage: 80, correctCount: 2, totalQuestions: 2 },
        ],
        answers: [
          { questionId: new mongoose.Types.ObjectId(), topic: 'Kafka', selectedOptionIndex: 1, isCorrect: true, marksAwarded: 4 },
          { questionId: new mongoose.Types.ObjectId(), topic: 'Saga', selectedOptionIndex: 0, isCorrect: true, marksAwarded: 4 },
        ],
      });

      // Attempt 2: Candidate B, Assessment A, Completed, 40%, Failed
      attempt2 = await AssessmentAttempt.create({
        candidateId: candidateUserB._id,
        assessmentId: assessmentA._id,
        attemptNumber: 1,
        startTime: new Date(now - 40 * 60 * 1000),
        endTime: now,
        expiresAt: new Date(now + 5 * 60 * 1000),
        status: 'completed',
        score: 4,
        totalMarks: 10,
        percentage: 40,
        passed: false,
        topicBreakdown: [
          { topic: 'Kafka', score: 4, totalMarks: 5, percentage: 80, correctCount: 2, totalQuestions: 2 },
          { topic: 'Saga', score: 0, totalMarks: 5, percentage: 0, correctCount: 0, totalQuestions: 2 },
        ],
        answers: [
          { questionId: new mongoose.Types.ObjectId(), topic: 'Kafka', selectedOptionIndex: 1, isCorrect: true, marksAwarded: 4 },
          { questionId: new mongoose.Types.ObjectId(), topic: 'Saga', selectedOptionIndex: 2, isCorrect: false, marksAwarded: 0 },
        ],
      });

      // Attempt 3: Candidate A, Assessment B, Expired, 0%, Failed
      attempt3 = await AssessmentAttempt.create({
        candidateId: candidateUserA._id,
        assessmentId: assessmentB._id,
        attemptNumber: 1,
        startTime: new Date(now - 60 * 60 * 1000),
        endTime: new Date(now - 30 * 60 * 1000),
        expiresAt: new Date(now - 30 * 60 * 1000),
        status: 'expired',
        score: 0,
        totalMarks: 10,
        percentage: 0,
        passed: false,
      });
    });

    test('GET /api/admin/results: returns attempts enriched with candidate, profile, and assessment joins', async () => {
      const res = await request(app)
        .get('/api/admin/results')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBe(3);

      // Verify Attempt 1 join fields
      const resAttempt1 = res.body.data.results.find((r) => r._id === attempt1._id.toString());
      expect(resAttempt1).toBeDefined();
      expect(resAttempt1.candidate.email).toBe('candidate_a@test.com');
      expect(resAttempt1.candidate.fullName).toBe('Alice Walker');
      expect(resAttempt1.candidate.experienceLevel).toBe('senior');
      expect(resAttempt1.assessment.title).toBe('Distributed Systems & Microservices');
      expect(resAttempt1.assessment.difficulty).toBe('advanced');
      expect(resAttempt1.score).toBe(8);
      expect(resAttempt1.passed).toBe(true);

      // Verify metrics
      expect(res.body.data.metrics.totalAttempts).toBe(3);
      expect(res.body.data.metrics.completedCount).toBe(2);
      expect(res.body.data.metrics.passedCount).toBe(1);
      expect(res.body.data.metrics.passRate).toBe(33); // 1 of 3 = 33%
      expect(res.body.data.metrics.averagePercentage).toBe(60); // (80 + 40) / 2 = 60%
    });

    test('Filter by status and passed: correctly filters results by status and outcome', async () => {
      // Filter status=completed
      const completedRes = await request(app)
        .get('/api/admin/results?status=completed')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(completedRes.body.data.results.length).toBe(2);

      // Filter status=expired
      const expiredRes = await request(app)
        .get('/api/admin/results?status=expired')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(expiredRes.body.data.results.length).toBe(1);
      expect(expiredRes.body.data.results[0]._id).toBe(attempt3._id.toString());

      // Filter passed=true
      const passedRes = await request(app)
        .get('/api/admin/results?passed=true')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(passedRes.body.data.results.length).toBe(1);
      expect(passedRes.body.data.results[0]._id).toBe(attempt1._id.toString());

      // Filter passed=false
      const failedRes = await request(app)
        .get('/api/admin/results?passed=false')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(failedRes.body.data.results.length).toBe(2);
    });

    test('Filter by assessmentId and candidateId: isolates specific assessment or candidate', async () => {
      // Filter by assessmentB
      const assessBRes = await request(app)
        .get(`/api/admin/results?assessmentId=${assessmentB._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(assessBRes.body.data.results.length).toBe(1);
      expect(assessBRes.body.data.results[0].assessment.title).toBe('Frontend React Architecture');

      // Filter by Candidate B
      const candBRes = await request(app)
        .get(`/api/admin/results?candidateId=${candidateUserB._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(candBRes.body.data.results.length).toBe(1);
      expect(candBRes.body.data.results[0].candidate.email).toBe('candidate_b@test.com');
    });

    test('ReDoS-Safe Search: literal matching across candidate email, profile name, and test title', async () => {
      // Search by candidate name
      const nameRes = await request(app)
        .get('/api/admin/results?search=Alice%20Walker')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(nameRes.body.data.results.length).toBe(2); // 2 attempts by Alice

      // Search by candidate email
      const emailRes = await request(app)
        .get('/api/admin/results?search=candidate_b')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(emailRes.body.data.results.length).toBe(1);

      // Search with regex special characters 'Microservices'
      const titleRes = await request(app)
        .get('/api/admin/results?search=Microservices')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(titleRes.body.data.results.length).toBe(2);

      // Search with potential ReDoS pattern executes safely
      const t0 = Date.now();
      const redosRes = await request(app)
        .get('/api/admin/results?search=((a%2B)%2B)%2B%24')
        .set('Authorization', `Bearer ${adminToken}`);
      const duration = Date.now() - t0;
      expect(redosRes.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    test('GET /api/admin/results/:id: returns comprehensive attempt report and topic breakdown', async () => {
      const res = await request(app)
        .get(`/api/admin/results/${attempt1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const detail = res.body.data.result;
      expect(detail.candidate.fullName).toBe('Alice Walker');
      expect(detail.candidate.email).toBe('candidate_a@test.com');
      expect(detail.assessment.title).toBe('Distributed Systems & Microservices');
      expect(detail.score).toBe(8);
      expect(detail.percentage).toBe(80);
      expect(detail.topicBreakdown.length).toBe(2);
      expect(detail.answers.length).toBe(2);
    });

    test('GET /api/admin/results/:id: returns 404 for nonexistent attempt and 400 for invalid ID', async () => {
      const badId = await request(app)
        .get('/api/admin/results/invalid-mongo-id')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(badId.status).toBe(400);

      const notFound = await request(app)
        .get(`/api/admin/results/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(notFound.status).toBe(404);
    });
  });

  // ==========================================================================
  // 3. ADMIN NOTIFICATIONS & RECIPIENT VALIDATION INVARIANTS
  // ==========================================================================
  describe('3. Admin Notifications & Strict Recipient Validation', () => {
    test('Broadcast to all candidates: role="candidate" dispatches to all active candidates', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'System upgrade scheduled for candidates',
          role: 'candidate',
          type: 'admin_broadcast',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipientCount).toBe(2); // Candidate A and Candidate B (inactive excluded)

      const notifs = await Notification.find({ type: 'admin_broadcast' });
      expect(notifs.length).toBe(2);
      const recipientIds = notifs.map((n) => n.userId.toString());
      expect(recipientIds).toContain(candidateUserA._id.toString());
      expect(recipientIds).toContain(candidateUserB._id.toString());
      expect(recipientIds).not.toContain(inactiveCandidate._id.toString());
      expect(recipientIds).not.toContain(adminUser._id.toString());
    });

    test('STRICT RECIPIENT VALIDATION: targeted userIds with mixed accounts only sends to active candidates', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      // Mixed array:
      // 1. Candidate A (Valid, Active candidate)
      // 2. Admin User (Non-candidate account)
      // 3. Inactive Candidate (Deactivated candidate)
      // 4. Non-existent ID
      const mixedUserIds = [
        candidateUserA._id.toString(),
        adminUser._id.toString(),
        inactiveCandidate._id.toString(),
        nonExistentId,
      ];

      const res = await request(app)
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'Personal interview reminder for Candidate A',
          userIds: mixedUserIds,
          type: 'reminder',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipientCount).toBe(1); // ONLY Candidate A matches active candidate!

      // Assert in MongoDB: EXACTLY ONE notification created, strictly for candidate A
      const notifs = await Notification.find({ type: 'reminder' });
      expect(notifs.length).toBe(1);
      expect(notifs[0].userId.toString()).toBe(candidateUserA._id.toString());
      expect(notifs[0].message).toBe('Personal interview reminder for Candidate A');
    });

    test('ZERO CANDIDATE REJECTION: rejecting when no IDs resolve to an active candidate', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const invalidUserIds = [
        adminUser._id.toString(),          // Admin (not candidate)
        inactiveCandidate._id.toString(),  // Inactive (not active)
        nonExistentId,                     // Non-existent
      ];

      const res = await request(app)
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'This should fail validation',
          userIds: invalidUserIds,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No active candidate accounts found/i);

      // Verify zero notifications persisted
      const count = await Notification.countDocuments({});
      expect(count).toBe(0);
    });

    test('Validator checks: rejects empty message or malformed ObjectId in userIds', async () => {
      const emptyMsg = await request(app)
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: '   ', role: 'candidate' });
      expect(emptyMsg.status).toBe(400);

      const malformedId = await request(app)
        .post('/api/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'Valid message', userIds: ['not-a-mongo-id'] });
      expect(malformedId.status).toBe(400);
      expect(malformedId.body.message).toMatch(/Invalid user ID format/i);
    });

    test('GET /api/admin/notifications: returns paginated platform audit feed with recipient population', async () => {
      // Seed notifications
      await Notification.create([
        {
          userId: candidateUserA._id,
          type: 'admin_broadcast',
          message: 'Important platform announcement',
          isRead: false,
        },
        {
          userId: candidateUserB._id,
          type: 'booking_confirmed',
          message: 'Interview booking confirmed',
          isRead: true,
        },
      ]);

      const res = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(2);

      // Verify recipient population
      const notif1 = res.body.data.notifications.find((n) => n.type === 'admin_broadcast');
      expect(notif1.userId.email).toBe('candidate_a@test.com');
      expect(notif1.userId.role).toBe('candidate');

      // Filter by type
      const broadcastOnly = await request(app)
        .get('/api/admin/notifications?type=admin_broadcast')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(broadcastOnly.body.data.notifications.length).toBe(1);
      expect(broadcastOnly.body.data.notifications[0].type).toBe('admin_broadcast');

      // Search by message text
      const searchRes = await request(app)
        .get('/api/admin/notifications?search=announcement')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(searchRes.body.data.notifications.length).toBe(1);
    });
  });
});
