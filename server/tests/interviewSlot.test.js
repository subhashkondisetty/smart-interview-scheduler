const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const InterviewSlot = require('../models/InterviewSlot');

describe('InterviewSlot API & Overlap Prevention (Admin CRUD + Candidate Discovery)', () => {
  const secret = 'slot_test_jwt_secret_12345678901234567890';
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
    test('POST /api/admin/interview-slots: should create a new slot for admin', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      // No overlapping slots
      jest.spyOn(InterviewSlot, 'findOne').mockResolvedValue(null);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day future

      const createdSlot = {
        _id: '607f1f77bcf86cd799439055',
        title: 'System Design Mock',
        interviewerName: 'Principal Engineer',
        startTime: new Date(futureDate),
        endTime: new Date(new Date(futureDate).getTime() + 60 * 60000),
        durationMinutes: 60,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
        createdBy: adminId,
      };

      jest.spyOn(InterviewSlot, 'create').mockResolvedValue(createdSlot);

      const res = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'System Design Mock',
          interviewerName: 'Principal Engineer',
          startTime: futureDate,
          durationMinutes: 60,
          capacity: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slot.title).toBe('System Design Mock');
      expect(res.body.data.slot.durationMinutes).toBe(60);
    });

    test('POST /api/admin/interview-slots: should reject candidate access with 403', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateId,
        email: 'candidate@test.com',
        role: 'candidate',
        isActive: true,
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          title: 'Unauthorized Slot',
          startTime: futureDate,
          durationMinutes: 45,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('PUT /api/admin/interview-slots/:id: should update slot successfully', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const slotInstance = new InterviewSlot({
        _id: '607f1f77bcf86cd799439055',
        title: 'Initial Title',
        createdBy: adminId,
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        durationMinutes: 60,
        status: 'available',
      });

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotInstance);
      jest.spyOn(InterviewSlot, 'findOne').mockResolvedValue(null); // No overlap
      jest.spyOn(slotInstance, 'save').mockResolvedValue(slotInstance);

      const res = await request(app)
        .put('/api/admin/interview-slots/607f1f77bcf86cd799439055')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Technical Interview',
          durationMinutes: 45,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(slotInstance.title).toBe('Updated Technical Interview');
      expect(slotInstance.durationMinutes).toBe(45);
    });

    test('DELETE /api/admin/interview-slots/:id: should delete unbooked slot', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const slotInstance = {
        _id: '607f1f77bcf86cd799439055',
        bookedCount: 0,
      };

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotInstance);
      jest.spyOn(InterviewSlot, 'findByIdAndDelete').mockResolvedValue(slotInstance);

      const res = await request(app)
        .delete('/api/admin/interview-slots/607f1f77bcf86cd799439055')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Interview slot deleted successfully');
    });
  });

  describe('Past-Date Rejection', () => {
    test('POST /api/admin/interview-slots: rejects past-dated start time with 400', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day in the past

      const res = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Past Mock',
          startTime: pastDate,
          durationMinutes: 45,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Start time cannot be in the past');
    });
  });

  describe('Overlap Prevention', () => {
    test('POST /api/admin/interview-slots: rejects overlapping slot for same admin with 400', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const futureBase = Date.now() + 24 * 60 * 60 * 1000;
      const requestedStart = new Date(futureBase + 30 * 60000).toISOString(); // starts 30 mins later

      // Existing slot: from futureBase to futureBase + 60 mins (overlaps with requestedStart)
      const existingSlot = {
        _id: '607f1f77bcf86cd799439088',
        createdBy: adminId,
        startTime: new Date(futureBase),
        endTime: new Date(futureBase + 60 * 60000),
        status: 'available',
      };

      jest.spyOn(InterviewSlot, 'findOne').mockResolvedValue(existingSlot);

      const res = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Conflicting Slot',
          startTime: requestedStart,
          durationMinutes: 45,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Interview slot overlaps with an existing non-cancelled slot/i);
    });
  });

  describe('GET /api/admin/interview-slots (Pagination Behavior)', () => {
    beforeEach(() => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });
    });

    test('limit clamps at 100 even when a caller requests a larger value', async () => {
      let capturedLimit = null;
      let capturedSkip = null;

      jest.spyOn(InterviewSlot, 'countDocuments').mockResolvedValue(150);
      jest.spyOn(InterviewSlot, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockImplementation((s) => {
              capturedSkip = s;
              return {
                limit: jest.fn().mockImplementation((l) => {
                  capturedLimit = l;
                  return Promise.resolve([]);
                }),
              };
            }),
          }),
        }),
      });

      const res = await request(app)
        .get('/api/admin/interview-slots?limit=250')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedLimit).toBe(100);
      expect(capturedSkip).toBe(0);
      expect(res.body.data.pagination.limit).toBe(100);
      expect(res.body.data.pagination.page).toBe(1);
    });

    test('page=2 returns distinct second page results with correct skip offset', async () => {
      const page1Slots = [{ _id: 'slot_1', title: 'Page 1 Slot' }];
      const page2Slots = [{ _id: 'slot_2', title: 'Page 2 Slot' }];

      let capturedSkip = null;
      let capturedLimit = null;

      jest.spyOn(InterviewSlot, 'countDocuments').mockResolvedValue(25);
      jest.spyOn(InterviewSlot, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockImplementation((s) => {
              capturedSkip = s;
              return {
                limit: jest.fn().mockImplementation((l) => {
                  capturedLimit = l;
                  return Promise.resolve(s === 10 ? page2Slots : page1Slots);
                }),
              };
            }),
          }),
        }),
      });

      const res = await request(app)
        .get('/api/admin/interview-slots?page=2&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedSkip).toBe(10);
      expect(capturedLimit).toBe(10);
      expect(res.body.data.slots).toEqual(page2Slots);
      expect(res.body.data.slots[0].title).toBe('Page 2 Slot');
      expect(res.body.data.slots).not.toEqual(page1Slots);
      expect(res.body.data.pagination.page).toBe(2);
    });

    test('pagination.totalPages and pagination.hasMore compute correctly against a known total count', async () => {
      // 105 items with default limit of 50 -> 3 total pages
      jest.spyOn(InterviewSlot, 'countDocuments').mockResolvedValue(105);
      jest.spyOn(InterviewSlot, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Page 1: hasMore should be true
      const resPage1 = await request(app)
        .get('/api/admin/interview-slots?page=1&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.data.pagination.total).toBe(105);
      expect(resPage1.body.data.pagination.totalPages).toBe(3);
      expect(resPage1.body.data.pagination.hasMore).toBe(true);
      expect(resPage1.body.data.pagination.hasNext).toBe(true);

      // Page 3 (final page): hasMore should be false
      const resPage3 = await request(app)
        .get('/api/admin/interview-slots?page=3&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPage3.status).toBe(200);
      expect(resPage3.body.data.pagination.total).toBe(105);
      expect(resPage3.body.data.pagination.totalPages).toBe(3);
      expect(resPage3.body.data.pagination.hasMore).toBe(false);
      expect(resPage3.body.data.pagination.hasNext).toBe(false);
    });
  });

  describe('Candidate Discovery: GET /api/interview-slots', () => {
    test('should return only available future slots', async () => {
      const now = new Date();
      const futureSlot1 = {
        _id: '607f1f77bcf86cd799439001',
        title: 'Frontend Mock',
        startTime: new Date(now.getTime() + 3600000),
        status: 'available',
        capacity: 1,
        bookedCount: 0,
      };

      const selectMock = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([futureSlot1]),
        }),
      });

      jest.spyOn(InterviewSlot, 'find').mockReturnValue({ select: selectMock });

      const res = await request(app).get('/api/interview-slots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data.slots[0].title).toBe('Frontend Mock');
    });
  });
});
