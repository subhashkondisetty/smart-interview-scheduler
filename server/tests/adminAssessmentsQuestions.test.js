const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');

describe('Admin Assessment & Question Management Test Suite', () => {
  let mongod;
  let adminToken;
  let candidateToken;
  let adminUser;
  let candidateUser;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Seed Admin
    adminUser = await User.create({
      email: 'admin_assessments@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });
    adminToken = adminUser.generateAuthToken();

    // Seed Candidate
    candidateUser = await User.create({
      email: 'candidate_assessments@test.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });
    candidateToken = candidateUser.generateAuthToken();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    await AssessmentAttempt.deleteMany({});
    await Question.deleteMany({});
    await Assessment.deleteMany({});
  });

  describe('1. RBAC Guards for Assessments & Questions', () => {
    test('GET /api/admin/assessments: rejects unauthenticated (401) and candidate (403)', async () => {
      const unauthRes = await request(app).get('/api/admin/assessments');
      expect(unauthRes.status).toBe(401);

      const candidateRes = await request(app)
        .get('/api/admin/assessments')
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(candidateRes.status).toBe(403);

      const adminRes = await request(app)
        .get('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
    });

    test('GET /api/admin/assessments/:id/questions: rejects candidate with 403', async () => {
      const assessment = await Assessment.create({
        title: 'RBAC Test Assessment',
        difficulty: 'intermediate',
        durationMinutes: 30,
        passingPercentage: 60,
        maxAttempts: 3,
        createdBy: adminUser._id,
      });

      const res = await request(app)
        .get(`/api/admin/assessments/${assessment._id}/questions`)
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Assessment CRUD & Validation Rules', () => {
    test('POST /api/admin/assessments: creates assessment successfully with default draft status', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Distributed Systems & Cloud Architecture',
          description: 'Comprehensive test on Raft, Paxos, and horizontal scaling.',
          difficulty: 'advanced',
          durationMinutes: 45,
          passingPercentage: 70,
          maxAttempts: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.title).toBe('Distributed Systems & Cloud Architecture');
      expect(res.body.data.assessment.isPublished).toBe(false);
      expect(res.body.data.assessment.maxAttempts).toBe(2);

      const inDb = await Assessment.findById(res.body.data.assessment._id);
      expect(inDb).not.toBeNull();
      expect(inDb.passingPercentage).toBe(70);
    });

    test('POST /api/admin/assessments: validates required fields and boundary limits', async () => {
      // Empty title
      const emptyTitleRes = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '', durationMinutes: 30 });
      expect(emptyTitleRes.status).toBe(400);
      expect(emptyTitleRes.body.errors).toContain('Title is required');

      // Duration out of bounds (< 5 or > 180)
      const durationRes = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Valid Title', durationMinutes: 2 });
      expect(durationRes.status).toBe(400);
      expect(durationRes.body.errors).toContain('Duration must be an integer between 5 and 180 minutes');

      // Passing percentage out of bounds (> 100)
      const passingRes = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Valid Title', durationMinutes: 30, passingPercentage: 110 });
      expect(passingRes.status).toBe(400);
      expect(passingRes.body.errors).toContain('Passing percentage must be a number between 0 and 100');
    });

    test('PUT /api/admin/assessments/:id: updates assessment fields', async () => {
      const assessment = await Assessment.create({
        title: 'Original Title',
        difficulty: 'beginner',
        durationMinutes: 20,
        passingPercentage: 50,
        maxAttempts: 1,
        createdBy: adminUser._id,
      });

      const res = await request(app)
        .put(`/api/admin/assessments/${assessment._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title',
          difficulty: 'advanced',
          passingPercentage: 75,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.title).toBe('Updated Title');
      expect(res.body.data.assessment.difficulty).toBe('advanced');
      expect(res.body.data.assessment.passingPercentage).toBe(75);

      const inDb = await Assessment.findById(assessment._id);
      expect(inDb.title).toBe('Updated Title');
    });

    test('PATCH /api/admin/assessments/:id/publish: toggles published status', async () => {
      const assessment = await Assessment.create({
        title: 'Draft Assessment',
        isPublished: false,
        durationMinutes: 30,
        passingPercentage: 60,
        maxAttempts: 3,
        createdBy: adminUser._id,
      });

      // Toggle to published
      const pubRes = await request(app)
        .patch(`/api/admin/assessments/${assessment._id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: true });
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.assessment.isPublished).toBe(true);

      const inDb = await Assessment.findById(assessment._id);
      expect(inDb.isPublished).toBe(true);

      // Toggle back to draft
      const unpubRes = await request(app)
        .patch(`/api/admin/assessments/${assessment._id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: false });
      expect(unpubRes.status).toBe(200);
      expect(unpubRes.body.data.assessment.isPublished).toBe(false);
    });

    test('GET /api/admin/assessments: enriches assessments with questionCount and attemptCount', async () => {
      const assessment = await Assessment.create({
        title: 'Count Test Assessment',
        isPublished: true,
        durationMinutes: 30,
        passingPercentage: 60,
        maxAttempts: 3,
        createdBy: adminUser._id,
      });

      // Add 2 questions
      await Question.create([
        {
          assessmentId: assessment._id,
          text: 'Q1?',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          marks: 5,
          topic: 'General',
        },
        {
          assessmentId: assessment._id,
          text: 'Q2?',
          options: ['A', 'B'],
          correctOptionIndex: 1,
          marks: 5,
          topic: 'General',
        },
      ]);

      // Add 1 attempt
      await AssessmentAttempt.create({
        candidateId: candidateUser._id,
        assessmentId: assessment._id,
        attemptNumber: 1,
        startTime: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60000),
        status: 'in_progress',
      });

      const res = await request(app)
        .get('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const matched = res.body.data.assessments.find((a) => a._id === assessment._id.toString());
      expect(matched).toBeDefined();
      expect(matched.questionCount).toBe(2);
      expect(matched.attemptCount).toBe(1);
    });
  });

  describe('3. Mid-Attempt Unpublish Immunity', () => {
    test('start attempt while published, unpublish mid-attempt, submit successfully and score normally', async () => {
      // 1. Create published assessment
      const assessment = await Assessment.create({
        title: 'Full Stack Mid-Attempt Lifecycle Evaluation',
        difficulty: 'intermediate',
        durationMinutes: 30,
        passingPercentage: 50,
        maxAttempts: 2,
        isPublished: true,
        createdBy: adminUser._id,
      });

      // 2. Add Question
      const question = await Question.create({
        assessmentId: assessment._id,
        text: 'What is Node.js libuv primarily responsible for?',
        options: [
          'Asynchronous I/O and threadpool management',
          'CSS layout rendering',
          'Database table indexing',
          'Compiling TypeScript to bytecode',
        ],
        correctOptionIndex: 0,
        marks: 10,
        topic: 'Node.js Internals',
      });

      // 3. Candidate starts attempt while assessment is published
      const startRes = await request(app)
        .post(`/api/candidate/assessments/${assessment._id}/start`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(startRes.status).toBe(201);
      expect(startRes.body.success).toBe(true);
      const attemptId = startRes.body.data.attempt._id;
      expect(startRes.body.data.attempt.status).toBe('in_progress');

      // 4. Admin unpublishes the assessment mid-attempt
      const unpubRes = await request(app)
        .patch(`/api/admin/assessments/${assessment._id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: false });

      expect(unpubRes.status).toBe(200);
      expect(unpubRes.body.data.assessment.isPublished).toBe(false);

      // Verify assessment in MongoDB is now unpublished
      const assessmentInDb = await Assessment.findById(assessment._id);
      expect(assessmentInDb.isPublished).toBe(false);

      // Verify new candidate attempts are rejected (404) because unpublished
      const blockedStartRes = await request(app)
        .post(`/api/candidate/assessments/${assessment._id}/start`)
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(blockedStartRes.status).toBe(404);

      // 5. Candidate submits their already in-progress attempt
      const submitRes = await request(app)
        .post(`/api/candidate/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          answers: [
            {
              questionId: question._id.toString(),
              selectedOptionIndex: 0, // Correct answer
            },
          ],
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.data.attempt.status).toBe('completed');
      expect(submitRes.body.data.attempt.score).toBe(10);
      expect(submitRes.body.data.attempt.totalMarks).toBe(10);
      expect(submitRes.body.data.attempt.percentage).toBe(100);
      expect(submitRes.body.data.attempt.passed).toBe(true);

      // 6. Verify attempt in MongoDB is completed and candidate can view result
      const finalizedAttempt = await AssessmentAttempt.findById(attemptId);
      expect(finalizedAttempt.status).toBe('completed');
      expect(finalizedAttempt.score).toBe(10);

      const resultViewRes = await request(app)
        .get(`/api/candidate/attempts/${attemptId}/result`)
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(resultViewRes.status).toBe(200);
      expect(resultViewRes.body.data.result.assessment.title).toBe(
        'Full Stack Mid-Attempt Lifecycle Evaluation'
      );
    });
  });

  describe('4. Attempt-Aware Assessment Deletion Guards & Cascade', () => {
    test('DELETE /api/admin/assessments/:id: blocks deletion with 400 when assessment has attempts', async () => {
      const assessment = await Assessment.create({
        title: 'Assessment with Attempts',
        durationMinutes: 30,
        passingPercentage: 60,
        maxAttempts: 3,
        createdBy: adminUser._id,
      });

      const question = await Question.create({
        assessmentId: assessment._id,
        text: 'Sample question?',
        options: ['Yes', 'No'],
        correctOptionIndex: 0,
        marks: 5,
        topic: 'General',
      });

      // Create an attempt referencing this assessment
      await AssessmentAttempt.create({
        candidateId: candidateUser._id,
        assessmentId: assessment._id,
        attemptNumber: 1,
        startTime: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60000),
        status: 'completed',
        score: 5,
        totalMarks: 5,
        percentage: 100,
        passed: true,
      });

      // Admin attempts to delete assessment
      const delRes = await request(app)
        .delete(`/api/admin/assessments/${assessment._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(400);
      expect(delRes.body.success).toBe(false);
      expect(delRes.body.message).toMatch(/Cannot delete assessment with existing candidate attempts/i);

      // Verify assessment and question were NOT deleted from MongoDB
      const assessmentAfter = await Assessment.findById(assessment._id);
      expect(assessmentAfter).not.toBeNull();

      const questionAfter = await Question.findById(question._id);
      expect(questionAfter).not.toBeNull();
    });

    test('DELETE /api/admin/assessments/:id: deletes assessment and cascade-deletes questions when zero attempts exist', async () => {
      const assessment = await Assessment.create({
        title: 'Zero Attempts Assessment to Delete',
        durationMinutes: 20,
        passingPercentage: 60,
        maxAttempts: 2,
        createdBy: adminUser._id,
      });

      const question1 = await Question.create({
        assessmentId: assessment._id,
        text: 'Cascade Question 1?',
        options: ['Alpha', 'Beta'],
        correctOptionIndex: 0,
        marks: 2,
        topic: 'Basics',
      });

      const question2 = await Question.create({
        assessmentId: assessment._id,
        text: 'Cascade Question 2?',
        options: ['Gamma', 'Delta'],
        correctOptionIndex: 1,
        marks: 2,
        topic: 'Basics',
      });

      // Admin deletes assessment with 0 attempts
      const delRes = await request(app)
        .delete(`/api/admin/assessments/${assessment._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.message).toBe('Assessment deleted successfully');

      // Verify assessment document is deleted
      const assessmentInDb = await Assessment.findById(assessment._id);
      expect(assessmentInDb).toBeNull();

      // Verify associated questions are cascade-deleted
      const remainingQuestions = await Question.find({ assessmentId: assessment._id });
      expect(remainingQuestions.length).toBe(0);
    });
  });

  describe('5. Question Management CRUD & Validation', () => {
    let testAssessment;

    beforeEach(async () => {
      testAssessment = await Assessment.create({
        title: 'Question Bank Test Assessment',
        durationMinutes: 30,
        passingPercentage: 60,
        maxAttempts: 3,
        isPublished: true,
        createdBy: adminUser._id,
      });
    });

    test('POST /api/admin/assessments/:id/questions: admin creates question with answer key and explanation', async () => {
      const res = await request(app)
        .post(`/api/admin/assessments/${testAssessment._id}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Which React hook memoizes an expensive computed calculation across re-renders?',
          options: ['useEffect', 'useMemo', 'useCallback', 'useRef'],
          correctOptionIndex: 1,
          explanation: 'useMemo caches the result of a calculation between re-renders until dependencies change.',
          marks: 4,
          topic: 'React',
          difficulty: 'intermediate',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question.correctOptionIndex).toBe(1);
      expect(res.body.data.question.explanation).toContain('useMemo');
      expect(res.body.data.question.marks).toBe(4);

      const inDb = await Question.findById(res.body.data.question._id);
      expect(inDb).not.toBeNull();
      expect(inDb.correctOptionIndex).toBe(1);
    });

    test('POST /api/admin/assessments/:id/questions: validates options array and correctOptionIndex bounds', async () => {
      // Less than 2 options
      const fewOptionsRes = await request(app)
        .post(`/api/admin/assessments/${testAssessment._id}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Invalid options count',
          options: ['Only One Option'],
          correctOptionIndex: 0,
          topic: 'General',
        });
      expect(fewOptionsRes.status).toBe(400);
      expect(fewOptionsRes.body.errors).toContain('Question must have an options array with at least 2 options');

      // Out of bounds correctOptionIndex
      const outOfBoundsRes = await request(app)
        .post(`/api/admin/assessments/${testAssessment._id}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Valid Question Text',
          options: ['Opt A', 'Opt B'],
          correctOptionIndex: 5, // Out of bounds
          topic: 'General',
        });
      expect(outOfBoundsRes.status).toBe(400);
      expect(outOfBoundsRes.body.errors.some((e) => e.includes('out of bounds'))).toBe(true);
    });

    test('PUT /api/admin/assessments/:id/questions/:qId: updates question and answer key', async () => {
      const question = await Question.create({
        assessmentId: testAssessment._id,
        text: 'Initial Question Text',
        options: ['Choice 1', 'Choice 2'],
        correctOptionIndex: 0,
        marks: 1,
        topic: 'Initial Topic',
      });

      const res = await request(app)
        .put(`/api/admin/assessments/${testAssessment._id}/questions/${question._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Updated Question Text',
          options: ['Choice 1', 'Choice 2', 'Choice 3'],
          correctOptionIndex: 2,
          marks: 3,
          topic: 'Updated Topic',
          explanation: 'Choice 3 is the newly designated correct option.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.question.text).toBe('Updated Question Text');
      expect(res.body.data.question.correctOptionIndex).toBe(2);
      expect(res.body.data.question.marks).toBe(3);

      const inDb = await Question.findById(question._id);
      expect(inDb.correctOptionIndex).toBe(2);
      expect(inDb.options.length).toBe(3);
    });

    test('DELETE /api/admin/assessments/:id/questions/:qId: deletes question', async () => {
      const question = await Question.create({
        assessmentId: testAssessment._id,
        text: 'Question to Delete',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        marks: 2,
        topic: 'Temp',
      });

      const res = await request(app)
        .delete(`/api/admin/assessments/${testAssessment._id}/questions/${question._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Question deleted successfully');

      const inDb = await Question.findById(question._id);
      expect(inDb).toBeNull();
    });

    test('SECURITY ZERO-LEAKAGE: candidate public endpoint strictly strips correctOptionIndex and explanation', async () => {
      // Create question with explicit correctOptionIndex and explanation
      await Question.create({
        assessmentId: testAssessment._id,
        text: 'Secret Answer Question',
        options: ['Public Option A', 'Public Option B'],
        correctOptionIndex: 1,
        explanation: 'Top secret explanation detailing why B is correct.',
        marks: 5,
        topic: 'Security',
      });

      // Candidate queries public endpoint
      const res = await request(app).get(`/api/assessments/${testAssessment._id}/questions`);

      expect(res.status).toBe(200);
      expect(res.body.data.questions.length).toBe(1);
      const candidateQ = res.body.data.questions[0];

      expect(candidateQ.text).toBe('Secret Answer Question');
      expect(candidateQ.options).toEqual(['Public Option A', 'Public Option B']);
      // Strict assertion: zero answer key leakage
      expect(candidateQ.correctOptionIndex).toBeUndefined();
      expect(candidateQ.explanation).toBeUndefined();
    });
  });
});
