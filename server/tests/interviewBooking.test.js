const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const InterviewSlot = require('../models/InterviewSlot');
const InterviewBooking = require('../models/InterviewBooking');

describe('InterviewBooking API & Concurrency Control', () => {
  const secret = 'booking_test_jwt_secret_12345678901234567890';
  let originalSecret;

  const candidateAId = '507f1f77bcf86cd799439011';
  const candidateBId = '507f1f77bcf86cd799439022';
  const adminId = '507f1f77bcf86cd799439033';

  let tokenA;
  let tokenB;
  let adminToken;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = '1h';

    tokenA = jwt.sign({ id: candidateAId, email: 'candidateA@test.com', role: 'candidate' }, secret, {
      expiresIn: '1h',
    });
    tokenB = jwt.sign({ id: candidateBId, email: 'candidateB@test.com', role: 'candidate' }, secret, {
      expiresIn: '1h',
    });
    adminToken = jwt.sign({ id: adminId, email: 'admin@test.com', role: 'admin' }, secret, {
      expiresIn: '1h',
    });
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/candidate/bookings', () => {
    test('candidate books an available future slot successfully', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const futureDate = new Date(Date.now() + 24 * 3600000);
      const slotDoc = {
        _id: '607f1f77bcf86cd799439099',
        startTime: futureDate,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
      };

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotDoc);
      // No duplicate booking
      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null);

      // Atomic claim succeeds
      const updatedSlotDoc = {
        ...slotDoc,
        bookedCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue(updatedSlotDoc);

      const bookingDoc = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: slotDoc._id,
        status: 'confirmed',
        notes: 'Interested in backend roles',
      };
      jest.spyOn(InterviewBooking, 'create').mockResolvedValue(bookingDoc);
      jest.spyOn(InterviewBooking, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...bookingDoc,
          slot: slotDoc,
        }),
      });

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          slotId: '607f1f77bcf86cd799439099',
          notes: 'Interested in backend roles',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Interview slot booked successfully');
      expect(res.body.data.booking.status).toBe('confirmed');
    });

    test('returns 404 when booking a nonexistent interview slot', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          slotId: '607f1f77bcf86cd799439099',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/interview slot not found/i);
    });

    test('rejects duplicate booking if candidate already has active booking for this slot', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const slotDoc = {
        _id: '607f1f77bcf86cd799439099',
        startTime: new Date(Date.now() + 24 * 3600000),
      };
      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotDoc);

      // Candidate already booked
      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue({
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: slotDoc._id,
        status: 'confirmed',
      });

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          slotId: '607f1f77bcf86cd799439099',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already have an active booking/i);
    });

    test('rejects booking on past slot', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const pastSlotDoc = {
        _id: '607f1f77bcf86cd799439099',
        startTime: new Date(Date.now() - 3600000), // 1 hr ago
      };
      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(pastSlotDoc);

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          slotId: '607f1f77bcf86cd799439099',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot book a past/i);
    });

    test('rolls back slot capacity and returns 409 when partial unique index collision (code 11000) occurs on create', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const slotDoc = {
        _id: '607f1f77bcf86cd799439099',
        startTime: new Date(Date.now() + 24 * 3600000),
        capacity: 2,
        bookedCount: 0,
        status: 'available',
      };
      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(slotDoc);
      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null);

      // Slot claim succeeds
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue({
        ...slotDoc,
        bookedCount: 1,
      });

      const slotRollbackSpy = jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockResolvedValue({});

      // create throws 11000 duplicate key error
      jest.spyOn(InterviewBooking, 'create').mockImplementation(async () => {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      });

      const res = await request(app)
        .post('/api/candidate/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ slotId: slotDoc._id });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already have an active booking/i);
      expect(slotRollbackSpy).toHaveBeenCalledWith(slotDoc._id, {
        $inc: { bookedCount: -1 },
        status: 'available',
      });
    });
  });

  describe('Simulated Concurrent Double-Booking Race Condition (Capacity = 1)', () => {
    test('when two candidates concurrently book a slot with capacity 1, only one succeeds and other receives 409', async () => {
      // Mock User lookups for Candidate A and Candidate B
      jest.spyOn(User, 'findById').mockImplementation(async (id) => {
        if (id.toString() === candidateAId) {
          return { _id: candidateAId, email: 'candidateA@test.com', role: 'candidate', isActive: true };
        }
        return { _id: candidateBId, email: 'candidateB@test.com', role: 'candidate', isActive: true };
      });

      const slotId = '607f1f77bcf86cd799439099';
      const futureDate = new Date(Date.now() + 24 * 3600000);

      // Shared in-memory slot state with capacity: 1
      const inMemorySlot = {
        _id: slotId,
        startTime: futureDate,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
      };

      jest.spyOn(InterviewSlot, 'findById').mockResolvedValue(inMemorySlot);
      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null);

      // Atomic findOneAndUpdate simulation with capacity guard ($expr: bookedCount < capacity)
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        // Enforce the atomic condition: bookedCount must be strictly less than capacity
        if (inMemorySlot.bookedCount < inMemorySlot.capacity && inMemorySlot.status === 'available') {
          inMemorySlot.bookedCount += update.$inc ? update.$inc.bookedCount : 1;
          return {
            ...inMemorySlot,
            save: jest.fn().mockResolvedValue(true),
          };
        }
        return null; // Capacity guard triggered: slot full
      });

      jest.spyOn(InterviewBooking, 'create').mockImplementation(async (data) => ({
        _id: '707f1f77bcf86cd79943900' + data.candidate.slice(-1),
        ...data,
      }));

      jest.spyOn(InterviewBooking, 'findById').mockReturnValue({
        populate: jest.fn().mockImplementation(async () => ({
          _id: '707f1f77bcf86cd799439001',
          slot: inMemorySlot,
          status: 'confirmed',
        })),
      });

      // Fire both booking requests concurrently
      const [responseA, responseB] = await Promise.all([
        request(app)
          .post('/api/candidate/bookings')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ slotId }),
        request(app)
          .post('/api/candidate/bookings')
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ slotId }),
      ]);

      const statuses = [responseA.status, responseB.status];
      expect(statuses).toContain(201); // Exactly one succeeded
      expect(statuses).toContain(409); // The competing request was blocked by capacity guard

      // Final bookedCount must never exceed capacity
      expect(inMemorySlot.bookedCount).toBe(1);
    });
  });

  describe('GET /api/candidate/bookings & Ownership Enforcement', () => {
    test('candidate retrieves their own booking history', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const userBookings = [
        {
          _id: '707f1f77bcf86cd799439011',
          candidate: candidateAId,
          status: 'confirmed',
          slot: { _id: '607f1f77bcf86cd799439099', title: 'Frontend Mock' },
        },
      ];

      const findMock = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(userBookings),
            }),
          }),
        }),
      });

      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(userBookings.length);
      jest.spyOn(InterviewBooking, 'find').mockImplementation(findMock);

      const res = await request(app)
        .get('/api/candidate/bookings')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      // Strictly checked candidate query
      expect(findMock).toHaveBeenCalledWith({ candidate: candidateAId });
    });

    test('limit clamps at 100 even when a caller requests a larger value', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      let capturedLimit = null;
      let capturedSkip = null;

      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(200);
      jest.spyOn(InterviewBooking, 'find').mockReturnValue({
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
        .get('/api/candidate/bookings?limit=300')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedLimit).toBe(100);
      expect(capturedSkip).toBe(0);
      expect(res.body.data.pagination.limit).toBe(100);
      expect(res.body.data.pagination.page).toBe(1);
    });

    test('page=2 returns distinct second page results with correct skip offset', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const page1Bookings = [{ _id: 'b1', candidate: candidateAId, status: 'confirmed' }];
      const page2Bookings = [{ _id: 'b2', candidate: candidateAId, status: 'confirmed' }];

      let capturedSkip = null;
      let capturedLimit = null;

      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(15);
      jest.spyOn(InterviewBooking, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockImplementation((s) => {
              capturedSkip = s;
              return {
                limit: jest.fn().mockImplementation((l) => {
                  capturedLimit = l;
                  return Promise.resolve(s === 5 ? page2Bookings : page1Bookings);
                }),
              };
            }),
          }),
        }),
      });

      const res = await request(app)
        .get('/api/candidate/bookings?page=2&limit=5')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedSkip).toBe(5);
      expect(capturedLimit).toBe(5);
      expect(res.body.data.bookings).toEqual(page2Bookings);
      expect(res.body.data.bookings).not.toEqual(page1Bookings);
      expect(res.body.data.pagination.page).toBe(2);
    });

    test('pagination.totalPages and pagination.hasMore compute correctly against a known total count', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      // 120 bookings with limit of 50 -> 3 pages
      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(120);
      jest.spyOn(InterviewBooking, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Page 1
      const resPage1 = await request(app)
        .get('/api/candidate/bookings?page=1&limit=50')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.data.pagination.total).toBe(120);
      expect(resPage1.body.data.pagination.totalPages).toBe(3);
      expect(resPage1.body.data.pagination.hasMore).toBe(true);
      expect(resPage1.body.data.pagination.hasNext).toBe(true);

      // Page 3 (last page)
      const resPage3 = await request(app)
        .get('/api/candidate/bookings?page=3&limit=50')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resPage3.status).toBe(200);
      expect(resPage3.body.data.pagination.total).toBe(120);
      expect(resPage3.body.data.pagination.totalPages).toBe(3);
      expect(resPage3.body.data.pagination.hasMore).toBe(false);
      expect(resPage3.body.data.pagination.hasNext).toBe(false);
    });
  });

  describe('PATCH /api/candidate/bookings/:id/cancel', () => {
    test('candidate cancels their own booking and releases slot capacity', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const bookingInstance = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: '607f1f77bcf86cd799439099',
        status: 'confirmed',
        save: jest.fn().mockResolvedValue(true),
      };

      let findByIdCalls = 0;
      jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) => {
        findByIdCalls++;
        if (findByIdCalls === 1) {
          return Promise.resolve(bookingInstance);
        }
        return {
          populate: jest.fn().mockResolvedValue({
            ...bookingInstance,
            status: 'cancelled',
          }),
        };
      });

      jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockResolvedValue({
        ...bookingInstance,
        status: 'cancelled',
      });

      const slotUpdateMock = jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockResolvedValue({});

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439011/cancel')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.status).toBe('cancelled');
      // Slot capacity released
      expect(slotUpdateMock).toHaveBeenCalledWith(
        '607f1f77bcf86cd799439099',
        { $inc: { bookedCount: -1 }, $set: { status: 'available' } }
      );
    });

    test('Candidate A cannot cancel Candidate B booking (ownership violation returns 403)', async () => {
      // Authenticate as Candidate A
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      // Booking belongs to Candidate B
      const bookingB = {
        _id: '707f1f77bcf86cd799439022',
        candidate: candidateBId,
        slot: '607f1f77bcf86cd799439099',
        status: 'confirmed',
      };

      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(bookingB);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439022/cancel')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    test('returns 404 when booking to cancel does not exist', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });
      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439099/cancel')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/booking not found/i);
    });
  });

  describe('PATCH /api/candidate/bookings/:id/reschedule', () => {
    test('candidate reschedules to a new available slot', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const currentBooking = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: '607f1f77bcf86cd799439088',
        status: 'confirmed',
        notes: 'Original note',
      };

      jest.spyOn(InterviewBooking, 'findOne').mockResolvedValue(null); // Not already booked on new slot

      const claimedNewSlot = {
        _id: '607f1f77bcf86cd799439099',
        startTime: new Date(Date.now() + 24 * 3600000),
        bookedCount: 1,
        capacity: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue(claimedNewSlot);
      jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockResolvedValue({
        ...currentBooking,
        status: 'rescheduled',
        rescheduledTo: '607f1f77bcf86cd799439099',
      });
      const slotReleaseMock = jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockResolvedValue({});

      const newBooking = {
        _id: '707f1f77bcf86cd799439077',
        candidate: candidateAId,
        slot: '607f1f77bcf86cd799439099',
        status: 'confirmed',
      };
      jest.spyOn(InterviewBooking, 'create').mockResolvedValue(newBooking);

      jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) => {
        if (id.toString() === currentBooking._id) {
          return Promise.resolve(currentBooking);
        }
        return {
          populate: jest.fn().mockResolvedValue({
            ...newBooking,
            slot: claimedNewSlot,
          }),
        };
      });

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439011/reschedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          newSlotId: '607f1f77bcf86cd799439099',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Booking rescheduled successfully');
      // Old slot released
      expect(slotReleaseMock).toHaveBeenCalledWith('607f1f77bcf86cd799439088', {
        $inc: { bookedCount: -1 },
        $set: { status: 'available' },
      });
      // Current booking marked rescheduled
      expect(res.body.data.previousBooking.status).toBe('rescheduled');
    });

    test('returns 404 when booking to reschedule does not exist', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });
      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439099/reschedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ newSlotId: '607f1f77bcf86cd799439099' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/booking not found/i);
    });

    test('Candidate A cannot reschedule Candidate B booking (ownership violation returns 403)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });
      const bookingB = {
        _id: '707f1f77bcf86cd799439022',
        candidate: candidateBId,
        slot: '607f1f77bcf86cd799439088',
        status: 'confirmed',
      };
      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(bookingB);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439022/reschedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ newSlotId: '607f1f77bcf86cd799439099' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    test('rejects rescheduling a cancelled booking with 400', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });
      const cancelledBooking = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: '607f1f77bcf86cd799439088',
        status: 'cancelled',
      };
      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(cancelledBooking);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439011/reschedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ newSlotId: '607f1f77bcf86cd799439099' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot reschedule a cancelled booking/i);
    });

    test('rejects rescheduling to the same slot with 400', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });
      const currentBooking = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: '607f1f77bcf86cd799439088',
        status: 'confirmed',
      };
      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(currentBooking);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439011/reschedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ newSlotId: '607f1f77bcf86cd799439088' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/new slot must be different/i);
    });

    test('returns 409 when target slot is fully booked or unavailable', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });
      const currentBooking = {
        _id: '707f1f77bcf86cd799439011',
        candidate: candidateAId,
        slot: '607f1f77bcf86cd799439088',
        status: 'confirmed',
      };
      jest.spyOn(InterviewBooking, 'findById').mockResolvedValue(currentBooking);
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/candidate/bookings/707f1f77bcf86cd799439011/reschedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ newSlotId: '607f1f77bcf86cd799439099' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/target interview slot is fully booked or no longer available/i);
    });
  });

  describe('GET /api/admin/bookings (Admin Management)', () => {
    test('admin retrieves all bookings with candidate and slot populated', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const allBookings = [
        {
          _id: '707f1f77bcf86cd799439011',
          candidate: { email: 'candidateA@test.com' },
          slot: { title: 'System Design Mock' },
          status: 'confirmed',
        },
      ];

      const findMock = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(allBookings),
              }),
            }),
          }),
        }),
      });

      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(allBookings.length);
      jest.spyOn(InterviewBooking, 'find').mockImplementation(findMock);

      const res = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    test('admin retrieves bookings filtered by status, slotId, and candidateId query parameters', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      let capturedFilter = null;
      jest.spyOn(InterviewBooking, 'countDocuments').mockImplementation((filter) => {
        capturedFilter = filter;
        return Promise.resolve(0);
      });
      jest.spyOn(InterviewBooking, 'find').mockImplementation((filter) => {
        capturedFilter = filter;
        return {
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const res = await request(app)
        .get('/api/admin/bookings?status=confirmed&slotId=607f1f77bcf86cd799439099&candidateId=507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(capturedFilter).toEqual({
        status: 'confirmed',
        slot: '607f1f77bcf86cd799439099',
        candidate: '507f1f77bcf86cd799439011',
      });
    });

    test('candidate hitting admin bookings endpoint returns 403', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const res = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('limit clamps at 100 even when a caller requests a larger value', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      let capturedLimit = null;
      let capturedSkip = null;

      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(250);
      jest.spyOn(InterviewBooking, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
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
        }),
      });

      const res = await request(app)
        .get('/api/admin/bookings?limit=500')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedLimit).toBe(100);
      expect(capturedSkip).toBe(0);
      expect(res.body.data.pagination.limit).toBe(100);
      expect(res.body.data.pagination.page).toBe(1);
    });

    test('page=2 returns distinct second page results with correct skip offset', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const page1Bookings = [{ _id: 'b_p1', status: 'confirmed' }];
      const page2Bookings = [{ _id: 'b_p2', status: 'confirmed' }];

      let capturedSkip = null;
      let capturedLimit = null;

      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(30);
      jest.spyOn(InterviewBooking, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockImplementation((s) => {
                capturedSkip = s;
                return {
                  limit: jest.fn().mockImplementation((l) => {
                    capturedLimit = l;
                    return Promise.resolve(s === 10 ? page2Bookings : page1Bookings);
                  }),
                };
              }),
            }),
          }),
        }),
      });

      const res = await request(app)
        .get('/api/admin/bookings?page=2&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(capturedSkip).toBe(10);
      expect(capturedLimit).toBe(10);
      expect(res.body.data.bookings).toEqual(page2Bookings);
      expect(res.body.data.bookings).not.toEqual(page1Bookings);
      expect(res.body.data.pagination.page).toBe(2);
    });

    test('pagination.totalPages and pagination.hasMore compute correctly against a known total count', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      // 145 bookings with limit 50 -> 3 pages
      jest.spyOn(InterviewBooking, 'countDocuments').mockResolvedValue(145);
      jest.spyOn(InterviewBooking, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      // Page 1
      const resPage1 = await request(app)
        .get('/api/admin/bookings?page=1&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.data.pagination.total).toBe(145);
      expect(resPage1.body.data.pagination.totalPages).toBe(3);
      expect(resPage1.body.data.pagination.hasMore).toBe(true);
      expect(resPage1.body.data.pagination.hasNext).toBe(true);

      // Page 3 (final page)
      const resPage3 = await request(app)
        .get('/api/admin/bookings?page=3&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPage3.status).toBe(200);
      expect(resPage3.body.data.pagination.total).toBe(145);
      expect(resPage3.body.data.pagination.totalPages).toBe(3);
      expect(resPage3.body.data.pagination.hasMore).toBe(false);
      expect(resPage3.body.data.pagination.hasNext).toBe(false);
    });
  });

  describe('Cancel & Reschedule Concurrency Race Guards', () => {
    test('Test 1: concurrent double-cancel on same booking: exactly one succeeds (200), competing request receives 400, slot capacity decremented once', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const slot1Id = '607f1f77bcf86cd799439099';
      const bookingId = '707f1f77bcf86cd799439011';

      const inMemorySlot = {
        _id: slot1Id,
        bookedCount: 1,
        capacity: 1,
        status: 'booked',
      };

      const inMemoryBooking = {
        _id: bookingId,
        candidate: candidateAId,
        slot: slot1Id,
        status: 'confirmed',
      };

      jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) => {
        return {
          ...inMemoryBooking,
          populate: jest.fn().mockResolvedValue({
            ...inMemoryBooking,
            slot: inMemorySlot,
          }),
        };
      });

      // Atomic transition: only succeeds if status === 'confirmed'
      jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        if (filter._id === bookingId && filter.candidate === candidateAId && inMemoryBooking.status === 'confirmed') {
          inMemoryBooking.status = update.$set.status;
          inMemoryBooking.cancelledAt = update.$set.cancelledAt;
          return { ...inMemoryBooking };
        }
        return null; // Atomic guard triggered: already cancelled or modified
      });

      // Slot decrement: decrements capacity
      jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
        if (id.toString() === slot1Id) {
          if (update.$inc && update.$inc.bookedCount) {
            inMemorySlot.bookedCount += update.$inc.bookedCount;
          }
          if (update.$set && update.$set.status) {
            inMemorySlot.status = update.$set.status;
          }
          return { ...inMemorySlot };
        }
        return null;
      });

      // Fire both cancel requests concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/candidate/bookings/${bookingId}/cancel`)
          .set('Authorization', `Bearer ${tokenA}`),
        request(app)
          .patch(`/api/candidate/bookings/${bookingId}/cancel`)
          .set('Authorization', `Bearer ${tokenA}`),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);

      const res400 = res1.status === 400 ? res1 : res2;
      expect(res400.body.message).toMatch(/already been cancelled or modified/i);

      // Slot capacity decremented strictly once (1 -> 0)
      expect(inMemorySlot.bookedCount).toBe(0);
      expect(inMemorySlot.status).toBe('available');
      expect(inMemoryBooking.status).toBe('cancelled');
    });

    test('Test 2: concurrent reschedule to different slots: winning request reschedules and decrements old slot, losing request rolls back claimed target slot and receives 400', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const slot1Id = '607f1f77bcf86cd799439001';
      const slot2Id = '607f1f77bcf86cd799439002';
      const slot3Id = '607f1f77bcf86cd799439003';
      const bookingId = '707f1f77bcf86cd799439011';

      const futureDate = new Date(Date.now() + 24 * 3600000);

      const slots = {
        [slot1Id]: { _id: slot1Id, bookedCount: 1, capacity: 1, status: 'booked', startTime: futureDate },
        [slot2Id]: { _id: slot2Id, bookedCount: 0, capacity: 1, status: 'available', startTime: futureDate },
        [slot3Id]: { _id: slot3Id, bookedCount: 0, capacity: 1, status: 'available', startTime: futureDate },
      };

      const inMemoryBooking = {
        _id: bookingId,
        candidate: candidateAId,
        slot: slot1Id,
        status: 'confirmed',
        notes: 'Original note',
      };

      jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) => {
        if (id.toString() === bookingId) {
          return Promise.resolve({
            _id: bookingId,
            candidate: candidateAId,
            slot: slot1Id,
            status: 'confirmed',
            notes: 'Original note',
          });
        }
        return {
          populate: jest.fn().mockImplementation(async () => ({
            _id: id,
            candidate: candidateAId,
            slot: slots[slot2Id],
            status: 'confirmed',
          })),
        };
      });

      // Atomic claim on target slot
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        const slot = slots[filter._id];
        if (slot && slot.status === 'available' && slot.bookedCount < slot.capacity) {
          slot.bookedCount += 1;
          if (slot.bookedCount >= slot.capacity) {
            slot.status = 'booked';
          }
          return { ...slot };
        }
        return null;
      });

      // Atomic transition old booking: only one can transition from 'confirmed'
      jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        if (filter._id === bookingId && filter.candidate === candidateAId && inMemoryBooking.status === 'confirmed') {
          inMemoryBooking.status = update.$set.status;
          inMemoryBooking.rescheduledTo = update.$set.rescheduledTo;
          return { ...inMemoryBooking };
        }
        return null; // Atomic guard triggered: lost race
      });

      // Slot findByIdAndUpdate: handles rollback or old slot release
      jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
        const slot = slots[id.toString()];
        if (slot) {
          if (update.$inc && update.$inc.bookedCount) {
            slot.bookedCount += update.$inc.bookedCount;
          }
          if (update.$set && update.$set.status) {
            slot.status = update.$set.status;
          }
          return { ...slot };
        }
        return null;
      });

      jest.spyOn(InterviewBooking, 'create').mockImplementation(async (data) => ({
        _id: '707f1f77bcf86cd799439099',
        ...data,
      }));

      // Concurrently reschedule to Slot 2 and Slot 3
      const [res2, res3] = await Promise.all([
        request(app)
          .patch(`/api/candidate/bookings/${bookingId}/reschedule`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ newSlotId: slot2Id }),
        request(app)
          .patch(`/api/candidate/bookings/${bookingId}/reschedule`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ newSlotId: slot3Id }),
      ]);

      const statuses = [res2.status, res3.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);

      const res400 = res2.status === 400 ? res2 : res3;
      expect(res400.body.message).toMatch(/already been cancelled or modified/i);

      // Old slot decremented strictly once (1 -> 0)
      expect(slots[slot1Id].bookedCount).toBe(0);
      expect(slots[slot1Id].status).toBe('available');

      // The losing target slot had its claimed capacity rolled back (ends at 0)
      // The winning target slot ends at 1
      expect(slots[slot2Id].bookedCount + slots[slot3Id].bookedCount).toBe(1);
    });

    test('Test 3: concurrent reschedule to identical slot: duplicate-key 11000 race triggers compensating rollback and returns 409', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const slot1Id = '607f1f77bcf86cd799439001';
      const slotOld2Id = '607f1f77bcf86cd799439002';
      const targetSlotId = '607f1f77bcf86cd799439003';
      const booking1Id = '707f1f77bcf86cd799439011';
      const booking2Id = '707f1f77bcf86cd799439022';

      const futureDate = new Date(Date.now() + 24 * 3600000);

      const slots = {
        [slot1Id]: { _id: slot1Id, bookedCount: 1, capacity: 1, status: 'booked', startTime: futureDate },
        [slotOld2Id]: { _id: slotOld2Id, bookedCount: 1, capacity: 1, status: 'booked', startTime: futureDate },
        [targetSlotId]: { _id: targetSlotId, bookedCount: 0, capacity: 2, status: 'available', startTime: futureDate },
      };

      const bookings = {
        [booking1Id]: { _id: booking1Id, candidate: candidateAId, slot: slot1Id, status: 'confirmed', notes: 'Note 1' },
        [booking2Id]: { _id: booking2Id, candidate: candidateAId, slot: slotOld2Id, status: 'confirmed', notes: 'Note 2' },
      };

      jest.spyOn(InterviewBooking, 'findById').mockImplementation((id) => {
        const b = bookings[id.toString()];
        if (b) {
          return Promise.resolve({ ...b });
        }
        return {
          populate: jest.fn().mockImplementation(async () => ({
            _id: id,
            candidate: candidateAId,
            slot: slots[targetSlotId],
            status: 'confirmed',
          })),
        };
      });

      // Target slot atomic claim
      jest.spyOn(InterviewSlot, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        const slot = slots[filter._id];
        if (slot && slot.status === 'available' && slot.bookedCount < slot.capacity) {
          slot.bookedCount += 1;
          if (slot.bookedCount >= slot.capacity) {
            slot.status = 'booked';
          }
          return { ...slot };
        }
        return null;
      });

      // Old booking atomic transition
      jest.spyOn(InterviewBooking, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        const b = bookings[filter._id];
        if (b && b.status === 'confirmed') {
          b.status = update.$set.status;
          b.rescheduledTo = update.$set.rescheduledTo;
          return { ...b };
        }
        return null;
      });

      // Compensating revert on old booking
      jest.spyOn(InterviewBooking, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
        const b = bookings[id.toString()];
        if (b) {
          if (update.$set) {
            Object.assign(b, update.$set);
          }
          return { ...b };
        }
        return null;
      });

      // Compensating rollback or old slot release
      jest.spyOn(InterviewSlot, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
        const slot = slots[id.toString()];
        if (slot) {
          if (update.$inc && update.$inc.bookedCount) {
            slot.bookedCount += update.$inc.bookedCount;
          }
          if (update.$set && update.$set.status) {
            slot.status = update.$set.status;
          }
          return { ...slot };
        }
        return null;
      });

      // Track confirmed bookings on target slot to simulate partial unique index
      let targetSlotConfirmedCount = 0;
      jest.spyOn(InterviewBooking, 'create').mockImplementation(async (data) => {
        if (data.slot === targetSlotId && targetSlotConfirmedCount > 0) {
          const dupErr = new Error('E11000 duplicate key error collection: interviewbookings index: candidate_1_slot_1 dup key');
          dupErr.code = 11000;
          throw dupErr;
        }
        targetSlotConfirmedCount += 1;
        return {
          _id: '707f1f77bcf86cd799439099',
          ...data,
        };
      });

      // Concurrently reschedule both bookings to the same target slot
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/candidate/bookings/${booking1Id}/reschedule`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ newSlotId: targetSlotId }),
        request(app)
          .patch(`/api/candidate/bookings/${booking2Id}/reschedule`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ newSlotId: targetSlotId }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      const res409 = res1.status === 409 ? res1 : res2;
      expect(res409.body.message).toMatch(/already have an active booking/i);

      // Target slot ends with bookedCount = 1 (claimed 2, then losing request rolled back 1)
      expect(slots[targetSlotId].bookedCount).toBe(1);
      expect(slots[targetSlotId].status).toBe('available');

      // The losing request's booking was reverted to confirmed
      const winningId = res1.status === 200 ? booking1Id : booking2Id;
      const losingId = res1.status === 409 ? booking1Id : booking2Id;
      expect(bookings[winningId].status).toBe('rescheduled');
      expect(bookings[losingId].status).toBe('confirmed');
      expect(bookings[losingId].rescheduledTo).toBeNull();
    });
  });
});
