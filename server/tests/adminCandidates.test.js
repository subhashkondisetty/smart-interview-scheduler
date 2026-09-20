const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');
const InterviewSlot = require('../models/InterviewSlot');
const InterviewBooking = require('../models/InterviewBooking');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');

describe('Admin Candidate Management & Lifecycle Controller', () => {
  let mongod;
  let adminToken;
  let candidateToken;
  let adminUser;
  let candidateUserA;
  let candidateUserB;
  let candidateUserC;
  let assessmentDoc;
  let slotDoc;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // 1. Seed Admin
    adminUser = await User.create({
      email: 'admin_cand_test@example.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });
    adminToken = adminUser.generateAuthToken();

    // 2. Seed Candidate A (Active, Senior, with C++ in skills, booking & attempt)
    candidateUserA = await User.create({
      email: 'candidateA_test@example.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });
    candidateToken = candidateUserA.generateAuthToken();

    await CandidateProfile.create({
      user: candidateUserA._id,
      fullName: 'Alice Walker (Lead)',
      phone: '+1 555-0101',
      location: 'San Francisco, CA',
      headline: 'Principal Systems Architect (C++/Distributed)',
      skills: ['C++', 'Distributed Systems', 'Go', 'Kubernetes'],
      experienceLevel: 'lead',
      yearsOfExperience: 10,
      profileCompletionPercentage: 95,
      education: [
        {
          institution: 'Stanford University',
          degree: 'B.S.',
          fieldOfStudy: 'Computer Science',
          graduationYear: 2014,
        },
      ],
      resume: {
        url: '/uploads/resumes/alice_resume.pdf',
        fileName: 'alice_resume.pdf',
        originalName: 'Alice_Walker_CV.pdf',
        uploadedAt: new Date(),
      },
    });

    // 3. Seed Candidate B (Active, Mid, React/Node)
    candidateUserB = await User.create({
      email: 'candidateB_test@example.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });

    await CandidateProfile.create({
      user: candidateUserB._id,
      fullName: 'Bob Smith',
      phone: '+1 555-0102',
      location: 'Austin, TX',
      headline: 'Full Stack Engineer (Node.js/React)',
      skills: ['React', 'Node.js', 'TypeScript', 'MongoDB'],
      experienceLevel: 'mid',
      yearsOfExperience: 4,
      profileCompletionPercentage: 70,
    });

    // 4. Seed Candidate C (Inactive, Entry, no profile yet)
    candidateUserC = await User.create({
      email: 'candidateC_inactive@example.com',
      password: 'password123',
      role: 'candidate',
      isActive: false,
    });

    // 5. Seed Assessment & Attempt for Candidate A
    assessmentDoc = await Assessment.create({
      title: 'Distributed Systems & Architecture Evaluation',
      description: 'Comprehensive evaluation of high-concurrency systems',
      durationMinutes: 45,
      passingPercentage: 75,
      isPublished: true,
      createdBy: adminUser._id,
    });

    const now = new Date();
    await AssessmentAttempt.create({
      candidateId: candidateUserA._id,
      assessmentId: assessmentDoc._id,
      attemptNumber: 1,
      startTime: new Date(now.getTime() - 3600000),
      expiresAt: new Date(now.getTime() - 900000),
      endTime: new Date(now.getTime() - 1000000),
      status: 'completed',
      score: 85,
      totalMarks: 100,
      percentage: 85,
      answers: [],
    });

    // 6. Seed Slot & Booking for Candidate A
    slotDoc = await InterviewSlot.create({
      createdBy: adminUser._id,
      title: 'Lead Architect Technical Panel',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 90000000),
      durationMinutes: 60,
      capacity: 1,
      bookedCount: 1,
      status: 'available',
      meetingLink: 'https://meet.google.com/test-admin-cand',
    });

    await InterviewBooking.create({
      candidate: candidateUserA._id,
      slot: slotDoc._id,
      status: 'confirmed',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('1. RBAC & Access Restrictions', () => {
    test('1a. Rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/admin/candidates');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('1b. Rejects candidate token with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/candidates')
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('1c. Allows admin token with 200 OK', async () => {
      const res = await request(app)
        .get('/api/admin/candidates')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Candidate Listing, Pagination & Filters', () => {
    test('2a. Returns paginated candidate list and summary counts', async () => {
      const res = await request(app)
        .get('/api/admin/candidates?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { candidates, pagination, summary } = res.body.data;

      expect(pagination.total).toBe(3);
      expect(pagination.page).toBe(1);
      expect(candidates.length).toBe(3);

      expect(summary.total).toBe(3);
      expect(summary.active).toBe(2);
      expect(summary.inactive).toBe(1);

      // Verify unprofiled candidate C is preserved gracefully
      const candC = candidates.find((c) => c.email === 'candidatec_inactive@example.com');
      expect(candC).toBeDefined();
      expect(candC.profile.fullName).toBe('');
      expect(candC.isActive).toBe(false);
    });

    test('2b. Filters by status=active', async () => {
      const res = await request(app)
        .get('/api/admin/candidates?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { candidates, pagination } = res.body.data;
      expect(pagination.total).toBe(2);
      expect(candidates.every((c) => c.isActive === true)).toBe(true);
    });

    test('2c. Filters by status=inactive', async () => {
      const res = await request(app)
        .get('/api/admin/candidates?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { candidates, pagination } = res.body.data;
      expect(pagination.total).toBe(1);
      expect(candidates[0].email).toBe('candidatec_inactive@example.com');
      expect(candidates[0].isActive).toBe(false);
    });

    test('2d. Filters by experienceLevel=lead', async () => {
      const res = await request(app)
        .get('/api/admin/candidates?experienceLevel=lead')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { candidates } = res.body.data;
      expect(candidates.length).toBe(1);
      expect(candidates[0].email).toBe('candidatea_test@example.com');
      expect(candidates[0].profile.experienceLevel).toBe('lead');
    });
  });

  describe('3. ReDoS Defense & Regex Special Characters Search', () => {
    test('3a. Matches literal special characters (e.g. C++) without syntax error', async () => {
      const res = await request(app)
        .get('/api/admin/candidates?search=C%2B%2B') // 'C++'
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { candidates } = res.body.data;
      expect(candidates.length).toBe(1);
      expect(candidates[0].email).toBe('candidatea_test@example.com');
      expect(candidates[0].profile.skills).toContain('C++');
    });

    test('3b. Matches literal parentheses and slashes without regex grouping', async () => {
      const res = await request(app)
        .get('/api/admin/candidates?search=(Node.js/React)')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { candidates } = res.body.data;
      expect(candidates.length).toBe(1);
      expect(candidates[0].email).toBe('candidateb_test@example.com');
    });

    test('3c. Handles catastrophic backtracking ReDoS pattern safely without event-loop freeze', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .get('/api/admin/candidates?search=((a%2B)%2B)%2B%24') // '((a+)+)+$'
        .set('Authorization', `Bearer ${adminToken}`);

      const elapsed = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(res.body.data.candidates.length).toBe(0);
      // Assert prompt execution without ReDoS catastrophic backtracking
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('4. Candidate 360 Detail View & Schema Foreign Key Verification', () => {
    test('4a. Returns 404 for invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/admin/candidates/invalid-id-format')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/candidate not found/i);
    });

    test('4b. Returns 404 for non-candidate user ID', async () => {
      const res = await request(app)
        .get(`/api/admin/candidates/${adminUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/candidate not found/i);
    });

    test('4c. Returns full candidate 360 detail with populated bookings and attempts using verified candidateId', async () => {
      const res = await request(app)
        .get(`/api/admin/candidates/${candidateUserA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { candidate, bookings, attempts, stats } = res.body.data;

      // User & profile info
      expect(candidate.email).toBe('candidatea_test@example.com');
      expect(candidate.profile.fullName).toBe('Alice Walker (Lead)');
      expect(candidate.profile.headline).toContain('Principal Systems Architect');
      expect(candidate.profile.resume.fileName).toBe('alice_resume.pdf');

      // Bookings verified
      expect(bookings.length).toBe(1);
      expect(bookings[0].status).toBe('confirmed');
      expect(bookings[0].slot.title).toBe('Lead Architect Technical Panel');
      expect(bookings[0].slot.meetingLink).toBe('https://meet.google.com/test-admin-cand');

      // Attempts verified with candidateId foreign key & normalized assessment title
      expect(attempts.length).toBe(1);
      expect(attempts[0].candidateId.toString()).toBe(candidateUserA._id.toString());
      expect(attempts[0].status).toBe('completed');
      expect(attempts[0].score).toBe(85);
      expect(attempts[0].percentage).toBe(85);
      expect(attempts[0].assessment).toBeDefined();
      expect(attempts[0].assessment.title).toBe('Distributed Systems & Architecture Evaluation');

      // Stats
      expect(stats.totalBookings).toBe(1);
      expect(stats.upcomingBookings).toBe(1);
      expect(stats.totalAttempts).toBe(1);
      expect(stats.completedAttempts).toBe(1);
      expect(stats.passedAttempts).toBe(1);
    });
  });

  describe('5. Enable / Disable Account Action & Auth Enforcement', () => {
    test('5a. Returns 400 for missing or invalid status payload', async () => {
      const res = await request(app)
        .patch(`/api/admin/candidates/${candidateUserB._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ wrongField: 'active' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid status payload/i);
    });

    test('5b. Disables active candidate account (isActive = false)', async () => {
      const res = await request(app)
        .patch(`/api/admin/candidates/${candidateUserB._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isActive).toBe(false);

      // Verify directly in DB
      const updatedUser = await User.findById(candidateUserB._id);
      expect(updatedUser.isActive).toBe(false);
    });

    test('5c. Deactivated candidate is immediately rejected on authenticated endpoints with 403', async () => {
      const tokenB = candidateUserB.generateAuthToken();
      const res = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/account has been deactivated/i);
    });

    test('5d. Deactivated candidate is rejected on login with 403', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'candidateB_test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/account has been deactivated/i);
    });

    test('5e. Re-enables candidate account (isActive = true)', async () => {
      const res = await request(app)
        .patch(`/api/admin/candidates/${candidateUserB._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isActive).toBe(true);

      // Verify candidate can log in again
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'candidateB_test@example.com',
        password: 'password123',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });
  });
});
