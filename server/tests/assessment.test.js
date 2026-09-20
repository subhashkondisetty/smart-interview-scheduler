const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');

describe('Assessment API & Publishing Visibility Rules', () => {
  const secret = 'assessment_test_jwt_secret_12345678901234567890';
  let originalSecret;

  const adminId = '507f1f77bcf86cd799439011';
  const candidateId = '507f1f77bcf86cd799439022';

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

  describe('Admin CRUD Operations', () => {
    test('POST /api/admin/assessments: admin creates an assessment successfully', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const assessmentDoc = {
        _id: '607f1f77bcf86cd799439011',
        title: 'Data Structures & Algorithms Mock',
        description: 'Covers Trees, Graphs, and DP',
        difficulty: 'intermediate',
        durationMinutes: 45,
        passingPercentage: 70,
        maxAttempts: 3,
        isPublished: false,
        createdBy: adminId,
      };

      jest.spyOn(Assessment, 'create').mockResolvedValue(assessmentDoc);

      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Data Structures & Algorithms Mock',
          description: 'Covers Trees, Graphs, and DP',
          difficulty: 'intermediate',
          durationMinutes: 45,
          passingPercentage: 70,
          maxAttempts: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.title).toBe('Data Structures & Algorithms Mock');
      expect(res.body.data.assessment.isPublished).toBe(false);
    });

    test('POST /api/admin/assessments: rejects candidate with 403', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateId,
        email: 'candidate@test.com',
        role: 'candidate',
        isActive: true,
      });

      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ title: 'Unauthorized' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/admin/assessments: validation fails on invalid passing percentage or duration', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '', // Missing title
          durationMinutes: 2, // Less than 5 min
          passingPercentage: 150, // More than 100%
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Title is required');
      expect(res.body.errors).toContain('Duration must be an integer between 5 and 180 minutes');
      expect(res.body.errors).toContain('Passing percentage must be a number between 0 and 100');
    });

    test('PUT /api/admin/assessments/:id: admin updates assessment fields', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const assessmentDoc = new Assessment({
        _id: '607f1f77bcf86cd799439011',
        title: 'Original Title',
        difficulty: 'beginner',
        createdBy: adminId,
      });

      jest.spyOn(Assessment, 'findById').mockResolvedValue(assessmentDoc);
      jest.spyOn(assessmentDoc, 'save').mockResolvedValue(assessmentDoc);

      const res = await request(app)
        .put('/api/admin/assessments/607f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title',
          difficulty: 'advanced',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(assessmentDoc.title).toBe('Updated Title');
      expect(assessmentDoc.difficulty).toBe('advanced');
    });

    test('PATCH /api/admin/assessments/:id/publish: toggles published status', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const assessmentDoc = new Assessment({
        _id: '607f1f77bcf86cd799439011',
        title: 'Draft Assessment',
        isPublished: false,
        createdBy: adminId,
      });

      jest.spyOn(Assessment, 'findById').mockResolvedValue(assessmentDoc);
      jest.spyOn(assessmentDoc, 'save').mockResolvedValue(assessmentDoc);

      // Toggle from false to true
      const res = await request(app)
        .patch('/api/admin/assessments/607f1f77bcf86cd799439011/publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.isPublished).toBe(true);
      expect(assessmentDoc.isPublished).toBe(true);
    });

    test('DELETE /api/admin/assessments/:id: admin deletes assessment', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const assessmentDoc = {
        _id: '607f1f77bcf86cd799439011',
        title: 'To Delete',
      };

      jest.spyOn(Assessment, 'findById').mockResolvedValue(assessmentDoc);
      jest.spyOn(Assessment, 'findByIdAndDelete').mockResolvedValue(assessmentDoc);

      const res = await request(app)
        .delete('/api/admin/assessments/607f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Assessment deleted successfully');
    });
  });

  describe('Candidate Discovery & Published-Only Visibility Rule', () => {
    test('GET /api/assessments: returns only published assessments and filters out unpublished drafts', async () => {
      const publishedAssessment = {
        _id: '607f1f77bcf86cd799439011',
        title: 'Published Core Java Mock',
        isPublished: true,
      };

      const findMock = jest.fn().mockImplementation((filter) => {
        // Enforce published-only filter in database query
        expect(filter.isPublished).toBe(true);
        return {
          select: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([publishedAssessment]),
          }),
        };
      });

      jest.spyOn(Assessment, 'find').mockImplementation(findMock);

      const res = await request(app).get('/api/assessments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data.assessments[0].title).toBe('Published Core Java Mock');
      expect(res.body.data.assessments[0].isPublished).toBe(true);
    });

    test('GET /api/assessments/:id: returns 404 when requested assessment is unpublished', async () => {
      const findOneMock = jest.fn().mockImplementation((query) => {
        expect(query.isPublished).toBe(true);
        return {
          select: jest.fn().mockResolvedValue(null), // Unpublished returns null to candidate
        };
      });

      jest.spyOn(Assessment, 'findOne').mockImplementation(findOneMock);

      const res = await request(app).get('/api/assessments/607f1f77bcf86cd799439099');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Assessment not found or is currently unpublished/i);
    });

    test('GET /api/assessments/:id: returns published assessment details', async () => {
      const publishedDoc = {
        _id: '607f1f77bcf86cd799439011',
        title: 'React.js & State Management Assessment',
        isPublished: true,
        durationMinutes: 30,
        passingPercentage: 65,
      };

      jest.spyOn(Assessment, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(publishedDoc),
      });

      const res = await request(app).get('/api/assessments/607f1f77bcf86cd799439011');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.title).toBe('React.js & State Management Assessment');
    });
  });
});
