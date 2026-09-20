const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');

describe('Question API & Candidate Response Answer Sanitization', () => {
  const secret = 'question_test_jwt_secret_12345678901234567890';
  let originalSecret;

  const adminId = '507f1f77bcf86cd799439011';
  const candidateId = '507f1f77bcf86cd799439022';
  const assessmentId = '607f1f77bcf86cd799439033';

  let adminToken;
  let candidateToken;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = '1h';

    adminToken = jwt.sign({ id: adminId, email: 'admin@test.com', role: 'admin' }, secret, {
      expiresIn: '1h',
    });
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

  describe('Admin Question CRUD Operations', () => {
    test('POST /api/admin/assessments/:assessmentId/questions: admin creates question', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      jest.spyOn(Assessment, 'findById').mockResolvedValue({
        _id: assessmentId,
        title: 'Node.js & Backend Architecture',
      });

      const questionDoc = {
        _id: '707f1f77bcf86cd799439011',
        assessmentId,
        text: 'What is the event loop in Node.js?',
        options: ['Multi-threaded queue', 'Single-threaded event loop mechanism', 'Database engine', 'Compiler'],
        correctOptionIndex: 1,
        explanation: 'Node.js uses a single-threaded event loop via libuv to handle async I/O.',
        marks: 2,
        topic: 'Node.js Internals',
        difficulty: 'intermediate',
      };

      jest.spyOn(Question, 'create').mockResolvedValue(questionDoc);

      const res = await request(app)
        .post(`/api/admin/assessments/${assessmentId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'What is the event loop in Node.js?',
          options: ['Multi-threaded queue', 'Single-threaded event loop mechanism', 'Database engine', 'Compiler'],
          correctOptionIndex: 1,
          explanation: 'Node.js uses a single-threaded event loop via libuv to handle async I/O.',
          marks: 2,
          topic: 'Node.js Internals',
          difficulty: 'intermediate',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question.text).toBe('What is the event loop in Node.js?');
      expect(res.body.data.question.correctOptionIndex).toBe(1);
      expect(res.body.data.question.explanation).toContain('libuv');
    });

    test('POST /api/admin/assessments/:assessmentId/questions: validates options array and correctOptionIndex bounds', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      jest.spyOn(Assessment, 'findById').mockResolvedValue({ _id: assessmentId });

      const res = await request(app)
        .post(`/api/admin/assessments/${assessmentId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Sample Question',
          options: ['Only One Option'], // Needs at least 2 options
          correctOptionIndex: 5, // Out of bounds
          topic: 'General',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Question must have an options array with at least 2 options');
    });

    test('GET /api/admin/assessments/:assessmentId/questions: admin receives full question payload including correct answer', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      jest.spyOn(Assessment, 'findById').mockResolvedValue({ _id: assessmentId });

      const questionsList = [
        {
          _id: '707f1f77bcf86cd799439011',
          assessmentId,
          text: 'Question 1',
          options: ['Option A', 'Option B'],
          correctOptionIndex: 0,
          explanation: 'Because option A is correct',
          marks: 1,
          topic: 'JavaScript',
        },
      ];

      jest.spyOn(Question, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue(questionsList),
      });

      const res = await request(app)
        .get(`/api/admin/assessments/${assessmentId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.questions[0].correctOptionIndex).toBe(0);
      expect(res.body.data.questions[0].explanation).toBe('Because option A is correct');
    });

    test('DELETE /api/admin/assessments/:assessmentId/questions/:questionId: admin deletes question', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      jest.spyOn(Question, 'findOneAndDelete').mockResolvedValue({
        _id: '707f1f77bcf86cd799439011',
      });

      const res = await request(app)
        .delete(`/api/admin/assessments/${assessmentId}/questions/707f1f77bcf86cd799439011`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Question deleted successfully');
    });

    test('admin routes reject candidate tokens with 403', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateId,
        email: 'candidate@test.com',
        role: 'candidate',
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/admin/assessments/${assessmentId}/questions`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Candidate Question Discovery & Strict Answer Sanitization', () => {
    test('GET /api/assessments/:id/questions: strictly strips correctOptionIndex and explanation from raw JSON response', async () => {
      // 1. Mock assessment lookup: Assessment is published
      jest.spyOn(Assessment, 'findOne').mockResolvedValue({
        _id: assessmentId,
        title: 'Published System Design Mock',
        isPublished: true,
      });

      // 2. Raw database question objects containing sensitive correctOptionIndex and explanation
      const dbQuestions = [
        new Question({
          _id: '707f1f77bcf86cd799439001',
          assessmentId,
          text: 'Which protocol is connection-oriented?',
          options: ['UDP', 'TCP', 'ICMP', 'DNS'],
          correctOptionIndex: 1, // SENSITIVE - MUST BE STRIPPED
          explanation: 'TCP guarantees delivery via 3-way handshake.', // SENSITIVE - MUST BE STRIPPED
          marks: 2,
          topic: 'Networking',
          difficulty: 'intermediate',
        }),
        new Question({
          _id: '707f1f77bcf86cd799439002',
          assessmentId,
          text: 'What is CAP theorem?',
          options: ['Consistency, Availability, Partition Tolerance', 'Caching, API, Performance', 'Concurrency, Atomicity, Persistence'],
          correctOptionIndex: 0, // SENSITIVE - MUST BE STRIPPED
          explanation: 'A distributed system can only provide 2 of 3 guarantees.', // SENSITIVE - MUST BE STRIPPED
          marks: 3,
          topic: 'Distributed Systems',
          difficulty: 'advanced',
        }),
      ];

      const selectMock = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(dbQuestions),
      });

      jest.spyOn(Question, 'find').mockReturnValue({ select: selectMock });

      const res = await request(app).get(`/api/assessments/${assessmentId}/questions`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.questions).toHaveLength(2);

      // Deep inspection of the RAW JSON payload for total absence of correctOptionIndex and explanation
      const rawJson = JSON.stringify(res.body);

      // Assert that neither key name exists anywhere in the raw serialized payload
      expect(rawJson).not.toContain('"correctOptionIndex"');
      expect(rawJson).not.toContain('"explanation"');
      expect(rawJson).not.toContain('3-way handshake');
      expect(rawJson).not.toContain('distributed system can only provide');

      // Assert on individual object properties
      for (const question of res.body.data.questions) {
        expect(question).not.toHaveProperty('correctOptionIndex');
        expect(question).not.toHaveProperty('explanation');
        expect(question.correctOptionIndex).toBeUndefined();
        expect(question.explanation).toBeUndefined();

        // Ensure safe public fields are preserved
        expect(question).toHaveProperty('_id');
        expect(question).toHaveProperty('text');
        expect(question).toHaveProperty('options');
        expect(question.options).toHaveLength(question.options.length);
        expect(question).toHaveProperty('marks');
        expect(question).toHaveProperty('topic');
      }
    });

    test('GET /api/assessments/:id/questions: returns 404 when assessment is unpublished', async () => {
      // Unpublished assessment returns null
      jest.spyOn(Assessment, 'findOne').mockResolvedValue(null);

      const res = await request(app).get(`/api/assessments/${assessmentId}/questions`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Assessment not found or is currently unpublished/i);
    });
  });
});
