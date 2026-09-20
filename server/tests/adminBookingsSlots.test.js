const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const InterviewSlot = require('../models/InterviewSlot');
const InterviewBooking = require('../models/InterviewBooking');
const Notification = require('../models/Notification');

describe('Admin Interview Slot & Booking Management Suite', () => {
  let mongod;
  let adminToken;
  let candidateTokenA;
  let candidateTokenB;
  let adminUser;
  let candidateUserA;
  let candidateUserB;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Seed Admin
    adminUser = await User.create({
      email: 'admin_slots@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });
    adminToken = adminUser.generateAuthToken();

    // Seed Candidate A
    candidateUserA = await User.create({
      email: 'candidate_a@test.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });
    candidateTokenA = candidateUserA.generateAuthToken();

    // Seed Candidate B
    candidateUserB = await User.create({
      email: 'candidate_b@test.com',
      password: 'password123',
      role: 'candidate',
      isActive: true,
    });
    candidateTokenB = candidateUserB.generateAuthToken();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  afterEach(async () => {
    await InterviewBooking.deleteMany({});
    await InterviewSlot.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('Slot Validator: description and meetingLink', () => {
    test('rejects non-string description with 400', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'System Design Mock',
          startTime: futureDate,
          durationMinutes: 45,
          capacity: 1,
          description: 12345, // invalid
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Description must be a string with a maximum of 2000 characters');
    });

    test('rejects non-string meetingLink with 400', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'System Design Mock',
          startTime: futureDate,
          durationMinutes: 45,
          capacity: 1,
          meetingLink: true, // invalid
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Meeting link must be a string with a maximum of 500 characters');
    });

    test('accepts valid string description and meetingLink on POST and PUT', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const createRes = await request(app)
        .post('/api/admin/interview-slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'System Design Mock',
          interviewerName: 'Sarah Chen',
          startTime: futureDate,
          durationMinutes: 60,
          capacity: 2,
          description: 'Technical deep-dive into distributed messaging systems.',
          meetingLink: 'https://meet.google.com/xyz-test-link',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.slot.description).toBe('Technical deep-dive into distributed messaging systems.');
      expect(createRes.body.data.slot.meetingLink).toBe('https://meet.google.com/xyz-test-link');

      const slotId = createRes.body.data.slot._id;

      // Direct MongoDB check
      const savedInDb = await InterviewSlot.findById(slotId);
      expect(savedInDb.description).toBe('Technical deep-dive into distributed messaging systems.');
      expect(savedInDb.meetingLink).toBe('https://meet.google.com/xyz-test-link');

      // Update via PUT
      const updateRes = await request(app)
        .put(`/api/admin/interview-slots/${slotId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description for advanced candidates.',
          meetingLink: 'https://zoom.us/j/1234567890',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.slot.description).toBe('Updated description for advanced candidates.');
      expect(updateRes.body.data.slot.meetingLink).toBe('https://zoom.us/j/1234567890');

      const updatedInDb = await InterviewSlot.findById(slotId);
      expect(updatedInDb.description).toBe('Updated description for advanced candidates.');
      expect(updatedInDb.meetingLink).toBe('https://zoom.us/j/1234567890');
    });
  });

  describe('Slot Deletion Cascade: Two-Candidate Atomic Transition & Distinct Notifications', () => {
    test('cancelling slot with two active confirmed bookings transitions both bookings to cancelled and delivers distinct notifications', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const slot = await InterviewSlot.create({
        title: 'Full-Stack Architecture Session',
        interviewerName: 'Lead Architect',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 60 * 60000),
        durationMinutes: 60,
        capacity: 2,
        bookedCount: 2,
        status: 'booked',
        createdBy: adminUser._id,
      });

      // Seed 2 active confirmed bookings
      const bookingA = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: slot._id,
        status: 'confirmed',
      });

      const bookingB = await InterviewBooking.create({
        candidate: candidateUserB._id,
        slot: slot._id,
        status: 'confirmed',
      });

      // Admin cancels the slot via DELETE
      const res = await request(app)
        .delete(`/api/admin/interview-slots/${slot._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cancelledBookingsCount).toBe(2);

      // Verify slot in DB
      const updatedSlot = await InterviewSlot.findById(slot._id);
      expect(updatedSlot.status).toBe('cancelled');
      expect(updatedSlot.bookedCount).toBe(0);

      // Verify both bookings in DB
      const updatedBookingA = await InterviewBooking.findById(bookingA._id);
      expect(updatedBookingA.status).toBe('cancelled');
      expect(updatedBookingA.cancelledAt).toBeDefined();

      const updatedBookingB = await InterviewBooking.findById(bookingB._id);
      expect(updatedBookingB.status).toBe('cancelled');
      expect(updatedBookingB.cancelledAt).toBeDefined();

      // Verify notifications delivered to Candidate A and Candidate B with distinct wording
      const notificationsA = await Notification.find({ userId: candidateUserA._id });
      expect(notificationsA.length).toBe(1);
      expect(notificationsA[0].type).toBe('booking_cancelled');
      expect(notificationsA[0].message).toContain('Full-Stack Architecture Session');
      expect(notificationsA[0].message).toContain('was cancelled because the session was cancelled by an administrator');

      const notificationsB = await Notification.find({ userId: candidateUserB._id });
      expect(notificationsB.length).toBe(1);
      expect(notificationsB[0].type).toBe('booking_cancelled');
      expect(notificationsB[0].message).toContain('Full-Stack Architecture Session');
      expect(notificationsB[0].message).toContain('was cancelled because the session was cancelled by an administrator');
    });

    test('hard deletes slot if it has 0 bookings', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const slot = await InterviewSlot.create({
        title: 'Empty Slot',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
        createdBy: adminUser._id,
      });

      const res = await request(app)
        .delete(`/api/admin/interview-slots/${slot._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Interview slot deleted successfully');

      const inDb = await InterviewSlot.findById(slot._id);
      expect(inDb).toBeNull();
    });
  });

  describe('Concurrency Race: Candidate cancelBooking vs Admin Slot Deletion Cascade', () => {
    test('concurrent candidate cancel and admin slot cascade on same booking: booking cancelled once, exactly one notification dispatched', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const slot = await InterviewSlot.create({
        title: 'Concurrency Test Slot',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 1,
        status: 'booked',
        createdBy: adminUser._id,
      });

      const booking = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: slot._id,
        status: 'confirmed',
      });

      // Fire candidate self-cancel and admin slot deletion concurrently
      const [resCandidate, resAdmin] = await Promise.all([
        request(app)
          .patch(`/api/candidate/bookings/${booking._id}/cancel`)
          .set('Authorization', `Bearer ${candidateTokenA}`),
        request(app)
          .delete(`/api/admin/interview-slots/${slot._id}`)
          .set('Authorization', `Bearer ${adminToken}`),
      ]);

      // At least one operation succeeded
      expect(resCandidate.status === 200 || resAdmin.status === 200).toBe(true);

      // Verify DB booking is cancelled
      const finalBooking = await InterviewBooking.findById(booking._id);
      expect(finalBooking.status).toBe('cancelled');

      // Candidate A received exactly ONE notification (no duplicates)
      const notifs = await Notification.find({ userId: candidateUserA._id, type: 'booking_cancelled' });
      expect(notifs.length).toBe(1);
    });
  });

  describe('Admin Booking Management: adminCancelBooking', () => {
    test('admin successfully cancels candidate booking, releases capacity, and dispatches notification', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const slot = await InterviewSlot.create({
        title: 'Frontend Technical Interview',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 1,
        status: 'booked',
        createdBy: adminUser._id,
      });

      const booking = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: slot._id,
        status: 'confirmed',
      });

      const res = await request(app)
        .patch(`/api/admin/bookings/${booking._id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.status).toBe('cancelled');

      // Slot capacity released
      const updatedSlot = await InterviewSlot.findById(slot._id);
      expect(updatedSlot.bookedCount).toBe(0);
      expect(updatedSlot.status).toBe('available');

      // Notification delivered to candidate
      const notifs = await Notification.find({ userId: candidateUserA._id, type: 'booking_cancelled' });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain('was cancelled by an administrator');
    });

    test('returns 400 when attempting to cancel an already cancelled booking', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const slot = await InterviewSlot.create({
        title: 'Frontend Technical Interview',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
        createdBy: adminUser._id,
      });

      const booking = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: slot._id,
        status: 'cancelled',
      });

      const res = await request(app)
        .patch(`/api/admin/bookings/${booking._id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cannot cancel a cancelled booking');
    });

    test('returns 403 when non-admin calls admin cancel endpoint', async () => {
      const res = await request(app)
        .patch('/api/admin/bookings/507f1f77bcf86cd799439011/cancel')
        .set('Authorization', `Bearer ${candidateTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin Booking Management: adminRescheduleBooking', () => {
    test('admin successfully reschedules booking to new slot with capacity updates and notification', async () => {
      const futureDate1 = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const futureDate2 = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const oldSlot = await InterviewSlot.create({
        title: 'Round 1 Slot',
        startTime: futureDate1,
        endTime: new Date(futureDate1.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 1,
        status: 'booked',
        createdBy: adminUser._id,
      });

      const newSlot = await InterviewSlot.create({
        title: 'Round 2 Slot',
        startTime: futureDate2,
        endTime: new Date(futureDate2.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 0,
        status: 'available',
        createdBy: adminUser._id,
      });

      const oldBooking = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: oldSlot._id,
        status: 'confirmed',
        notes: 'Initial booking notes',
      });

      const res = await request(app)
        .patch(`/api/admin/bookings/${oldBooking._id}/reschedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newSlotId: newSlot._id.toString(),
          notes: 'Rescheduled by HR team',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newBooking.status).toBe('confirmed');
      expect(res.body.data.newBooking.notes).toBe('Rescheduled by HR team');
      expect(res.body.data.previousBooking.status).toBe('rescheduled');

      // Database assertions
      const updatedOldSlot = await InterviewSlot.findById(oldSlot._id);
      expect(updatedOldSlot.bookedCount).toBe(0);
      expect(updatedOldSlot.status).toBe('available');

      const updatedNewSlot = await InterviewSlot.findById(newSlot._id);
      expect(updatedNewSlot.bookedCount).toBe(1);
      expect(updatedNewSlot.status).toBe('booked');

      // Notification assertion
      const notifs = await Notification.find({ userId: candidateUserA._id, type: 'booking_rescheduled' });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain('was rescheduled by an administrator');
    });

    test('returns 400 if trying to reschedule to the identical slot', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const slot = await InterviewSlot.create({
        title: 'Identical Slot',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 1,
        status: 'booked',
        createdBy: adminUser._id,
      });

      const booking = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: slot._id,
        status: 'confirmed',
      });

      const res = await request(app)
        .patch(`/api/admin/bookings/${booking._id}/reschedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newSlotId: slot._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('New slot must be different from current slot.');
    });

    test('returns 409 if target slot is fully booked', async () => {
      const futureDate1 = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const futureDate2 = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const oldSlot = await InterviewSlot.create({
        title: 'Old Slot',
        startTime: futureDate1,
        endTime: new Date(futureDate1.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 1,
        status: 'booked',
        createdBy: adminUser._id,
      });

      const fullSlot = await InterviewSlot.create({
        title: 'Full Slot',
        startTime: futureDate2,
        endTime: new Date(futureDate2.getTime() + 45 * 60000),
        durationMinutes: 45,
        capacity: 1,
        bookedCount: 1,
        status: 'booked',
        createdBy: adminUser._id,
      });

      const booking = await InterviewBooking.create({
        candidate: candidateUserA._id,
        slot: oldSlot._id,
        status: 'confirmed',
      });

      const res = await request(app)
        .patch(`/api/admin/bookings/${booking._id}/reschedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newSlotId: fullSlot._id.toString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('The target interview slot is fully booked or no longer available.');
    });

    test('returns 403 when non-admin calls admin reschedule endpoint', async () => {
      const res = await request(app)
        .patch('/api/admin/bookings/507f1f77bcf86cd799439011/reschedule')
        .set('Authorization', `Bearer ${candidateTokenA}`)
        .send({
          newSlotId: '607f1f77bcf86cd799439099',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
