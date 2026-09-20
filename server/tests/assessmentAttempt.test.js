const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const emailService = require('../services/emailService');

describe('AssessmentAttempt API & Scoring Engine', () => {
  const secret = 'attempt_test_jwt_secret_12345678901234567890';
  let originalSecret;

  const candidateAId = '507f1f77bcf86cd799439011';
  const candidateBId = '507f1f77bcf86cd799439022';
  const adminId = '507f1f77bcf86cd799439033';
  const assessmentId = '607f1f77bcf86cd799439044';
  const attemptId = '707f1f77bcf86cd799439055';

  const q1Id = '807f1f77bcf86cd799439001';
  const q2Id = '807f1f77bcf86cd799439002';
  const q3Id = '807f1f77bcf86cd799439003';

  let tokenA;
  let tokenB;

  const mockAssessment = {
    _id: assessmentId,
    title: 'Data Structures & Algorithms',
    description: 'Comprehensive DSA test',
    difficulty: 'intermediate',
    durationMinutes: 30,
    passingPercentage: 60,
    maxAttempts: 3,
    isPublished: true,
    createdBy: adminId,
  };

  const mockQuestions = [
    {
      _id: q1Id,
      assessmentId,
      text: 'What is the time complexity of binary search?',
      options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'],
      correctOptionIndex: 1,
      marks: 2,
      topic: 'Algorithms',
    },
    {
      _id: q2Id,
      assessmentId,
      text: 'Which data structure follows LIFO?',
      options: ['Stack', 'Queue', 'Array', 'Heap'],
      correctOptionIndex: 0,
      marks: 3,
      topic: 'Data Structures',
    },
    {
      _id: q3Id,
      assessmentId,
      text: 'What is Dijkstra algorithm used for?',
      options: ['Sorting', 'String search', 'Shortest path', 'Hashing'],
      correctOptionIndex: 2,
      marks: 1,
      topic: 'Algorithms',
    },
  ];

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
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Default mock user lookup
    jest.spyOn(User, 'findById').mockImplementation(async (id) => {
      const idStr = id.toString();
      if (idStr === candidateAId) {
        return {
          id: candidateAId,
          _id: candidateAId,
          email: 'candidateA@test.com',
          role: 'candidate',
          isActive: true,
        };
      }
      if (idStr === candidateBId) {
        return {
          id: candidateBId,
          _id: candidateBId,
          email: 'candidateB@test.com',
          role: 'candidate',
          isActive: true,
        };
      }
      return null;
    });
  });

  // 1. Normal submit + score correctness
  test('1. Normal submit: computes score, percentage, passed status, and topic breakdown server-side', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue({
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    const emailSpy = jest
      .spyOn(emailService, 'sendAssessmentCompletionEmail')
      .mockResolvedValue({ success: true, messageId: 'msg-complete-1' });

    let savedAttempt = null;
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      savedAttempt = {
        _id: attemptId,
        candidateId: candidateAId,
        assessmentId,
        ...update.$set,
      };
      return savedAttempt;
    });

    const payload = {
      answers: [
        { questionId: q1Id, selectedOptionIndex: 1 }, // Correct (+2)
        { questionId: q2Id, selectedOptionIndex: 0 }, // Correct (+3)
        { questionId: q3Id, selectedOptionIndex: 0 }, // Incorrect (0)
      ],
    };

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attempt.score).toBe(5);
    expect(res.body.data.attempt.totalMarks).toBe(6);
    expect(res.body.data.attempt.percentage).toBe(83.33);
    expect(res.body.data.attempt.passed).toBe(true);
    expect(res.body.data.attempt.status).toBe('completed');

    // Topic breakdown assertions
    const topics = res.body.data.attempt.topicBreakdown;
    const algoTopic = topics.find((t) => t.topic === 'Algorithms');
    const dsTopic = topics.find((t) => t.topic === 'Data Structures');
    expect(algoTopic.score).toBe(2);
    expect(algoTopic.totalMarks).toBe(3);
    expect(algoTopic.percentage).toBe(66.67);
    expect(dsTopic.score).toBe(3);
    expect(dsTopic.totalMarks).toBe(3);
    expect(dsTopic.percentage).toBe(100);

    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'candidateA@test.com' }),
      mockAssessment,
      expect.objectContaining({ score: 5, totalMarks: 6, percentage: 83.33, passed: true })
    );
  });

  // 2. Submit after expiry rejected
  test('2. Submit after expiry rejected: marks attempt as expired and rejects with 400', async () => {
    const pastExpiry = new Date(Date.now() - 5000); // Expired 5 seconds ago
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue({
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: pastExpiry,
    });

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    const findOneAndUpdateSpy = jest
      .spyOn(AssessmentAttempt, 'findOneAndUpdate')
      .mockResolvedValue({
        _id: attemptId,
        status: 'expired',
        endTime: pastExpiry,
      });

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/time limit has expired/i);
    expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
      { _id: attemptId, status: 'in_progress' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'expired',
          endTime: pastExpiry,
        }),
      }),
      { new: true }
    );
  });

  // 3. Submitting already expired attempt
  test('3. Submitting already expired attempt: rejected with 400', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue({
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'expired',
      expiresAt: new Date(Date.now() - 60000),
    });

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already finalized or expired/i);
  });

  // 4. Attempt-limit enforcement
  test('4. Attempt-limit enforcement: starting beyond maxAttempts returns 400', async () => {
    jest.spyOn(Assessment, 'findOne').mockResolvedValue({
      ...mockAssessment,
      maxAttempts: 2,
    });

    jest.spyOn(AssessmentAttempt, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
    jest.spyOn(AssessmentAttempt, 'findOne').mockResolvedValue(null); // No active in_progress
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(2); // Already 2 attempts

    const res = await request(app)
      .post(`/api/candidate/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Maximum attempts limit \(2\) reached/i);
  });

  // 5. Forged "score" payload ignored
  test('5. Forged "score" payload in body is completely ignored by the backend', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue({
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(emailService, 'sendAssessmentCompletionEmail').mockResolvedValue({ success: true });

    let capturedSet = null;
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      capturedSet = update.$set;
      return {
        _id: attemptId,
        candidateId: candidateAId,
        assessmentId,
        ...update.$set,
      };
    });

    const forgedPayload = {
      answers: [
        { questionId: q1Id, selectedOptionIndex: 1 }, // Correct (+2 marks)
      ],
      score: 9999, // FORGED
      percentage: 100, // FORGED
      passed: true, // FORGED
    };

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(forgedPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.attempt.score).toBe(2); // Computed strictly on backend
    expect(res.body.data.attempt.totalMarks).toBe(6);
    expect(res.body.data.attempt.percentage).toBe(33.33);
    expect(res.body.data.attempt.passed).toBe(false);
    expect(capturedSet.score).toBe(2);
    expect(capturedSet.score).not.toBe(9999);
  });

  // 6. Concurrent start race condition
  test('6. Concurrent start race condition: two simultaneous start requests produce exactly one attempt document without 500 error', async () => {
    jest.spyOn(Assessment, 'findOne').mockResolvedValue(mockAssessment);
    jest.spyOn(AssessmentAttempt, 'updateMany').mockResolvedValue({ modifiedCount: 0 });

    let inMemoryAttempt = null;
    let createCallCount = 0;
    let findCount = 0;

    // Both parallel requests see null on initial findOne checks before create
    jest.spyOn(AssessmentAttempt, 'findOne').mockImplementation(async (filter) => {
      findCount++;
      if (findCount <= 2) {
        return null;
      }
      return inMemoryAttempt;
    });

    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);

    // Simulate MongoDB unique partial index enforcement
    jest.spyOn(AssessmentAttempt, 'create').mockImplementation(async (docData) => {
      createCallCount++;
      if (inMemoryAttempt) {
        // Unique partial index collision: duplicate key error 11000
        const err = new Error('E11000 duplicate key error collection: assessmentattempts');
        err.code = 11000;
        throw err;
      }
      inMemoryAttempt = {
        _id: attemptId,
        ...docData,
      };
      return inMemoryAttempt;
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/candidate/assessments/${assessmentId}/start`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(),
      request(app)
        .post(`/api/candidate/assessments/${assessmentId}/start`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).not.toContain(500);
    expect(statuses).toContain(201); // First request creates attempt
    expect(statuses).toContain(200); // Second request catches 11000 and returns active attempt

    expect(createCallCount).toBe(2);
    // Exactly 1 attempt object was created in DB
    expect(inMemoryAttempt).toBeDefined();
    expect(inMemoryAttempt._id).toBe(attemptId);
  });

  // 7. Concurrent submit race condition
  test('7. Concurrent submit race condition: two near-simultaneous submit requests result in exactly one 200 and one 400', async () => {
    const activeAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(activeAttempt);
    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    const emailSpy = jest
      .spyOn(emailService, 'sendAssessmentCompletionEmail')
      .mockResolvedValue({ success: true });

    let currentStatus = 'in_progress';

    // Atomic findOneAndUpdate simulation
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      if (filter.status === 'in_progress' && currentStatus === 'in_progress') {
        currentStatus = 'completed';
        return {
          ...activeAttempt,
          ...update.$set,
          status: 'completed',
        };
      }
      return null; // Status is no longer in_progress
    });

    const payload = {
      answers: [{ questionId: q1Id, selectedOptionIndex: 1 }],
    };

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/candidate/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payload),
      request(app)
        .post(`/api/candidate/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payload),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);

    // Only 1 completion email was triggered
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  // 8. Duplicate & foreign question IDs payload test
  test('8. Duplicate & foreign question IDs payload cannot inflate score or affect total marks', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue({
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(emailService, 'sendAssessmentCompletionEmail').mockResolvedValue({ success: true });

    let saved = null;
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      saved = update.$set;
      return { _id: attemptId, ...update.$set };
    });

    const foreignQId = '907f1f77bcf86cd799439099';
    const payload = {
      answers: [
        { questionId: q1Id, selectedOptionIndex: 1 }, // Real Q1 correct (+2)
        { questionId: q1Id, selectedOptionIndex: 1 }, // Duplicate Q1 submission
        { questionId: foreignQId, selectedOptionIndex: 0 }, // Foreign questionId
      ],
    };

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.attempt.score).toBe(2); // Only Q1 counted once
    expect(res.body.data.attempt.totalMarks).toBe(6); // Strictly official total marks
    expect(res.body.data.attempt.percentage).toBe(33.33);

    // Verify stored answers only contain official assessment questions
    const storedAnswers = saved.answers;
    expect(storedAnswers.length).toBe(3); // q1, q2, q3
    const q1Ans = storedAnswers.find((a) => a.questionId.toString() === q1Id);
    expect(q1Ans.isCorrect).toBe(true);
    expect(q1Ans.marksAwarded).toBe(2);
  });

  // 9. Ownership enforcement
  test('9. Ownership enforcement: Candidate B cannot submit or view Candidate A attempt', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: attemptId,
        candidateId: candidateAId, // Owned by Candidate A
        assessmentId: mockAssessment,
        status: 'in_progress',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }),
      // When findById is called without populate:
      _id: attemptId,
      candidateId: candidateAId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    // Attempt submit by Candidate B
    const submitRes = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ answers: [] });

    expect(submitRes.status).toBe(403);
    expect(submitRes.body.success).toBe(false);
    expect(submitRes.body.message).toMatch(/not authorized/i);

    // Attempt get details by Candidate B
    const getRes = await request(app)
      .get(`/api/candidate/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.success).toBe(false);
  });

  // 10. Unpublished assessment rejection
  test('10. Unpublished assessment rejection: candidate cannot start unpublished assessment', async () => {
    jest.spyOn(Assessment, 'findOne').mockResolvedValue(null); // isPublished: true yields null

    const res = await request(app)
      .post(`/api/candidate/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found or is not currently published/i);
  });

  // 11. Out-of-range option index handling
  test('11. Out-of-range option index handling: option indices < 0 or >= options.length are stored as unanswered (null)', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue({
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(emailService, 'sendAssessmentCompletionEmail').mockResolvedValue({ success: true });

    let saved = null;
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      saved = update.$set;
      return { _id: attemptId, ...update.$set };
    });

    const payload = {
      answers: [
        { questionId: q1Id, selectedOptionIndex: -1 }, // Negative index
        { questionId: q2Id, selectedOptionIndex: 99 }, // Index way beyond options.length (options has 4 items)
      ],
    };

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.attempt.score).toBe(0);

    const q1Ans = saved.answers.find((a) => a.questionId.toString() === q1Id);
    const q2Ans = saved.answers.find((a) => a.questionId.toString() === q2Id);

    // Stored answers explicitly recorded as unanswered (null) with 0 marks
    expect(q1Ans.selectedOptionIndex).toBeNull();
    expect(q1Ans.isCorrect).toBe(false);
    expect(q1Ans.marksAwarded).toBe(0);

    expect(q2Ans.selectedOptionIndex).toBeNull();
    expect(q2Ans.isCorrect).toBe(false);
    expect(q2Ans.marksAwarded).toBe(0);
  });

  // 12. Active attempt resumption
  test('12. Active attempt resumption: starting when candidate already has active in_progress attempt resumes it with 200', async () => {
    jest.spyOn(Assessment, 'findOne').mockResolvedValue(mockAssessment);

    const activeAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 20 * 60 * 1000), // Active 20 mins remaining
    };

    jest.spyOn(AssessmentAttempt, 'findOne').mockResolvedValue(activeAttempt);
    const createSpy = jest.spyOn(AssessmentAttempt, 'create');

    const res = await request(app)
      .post(`/api/candidate/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/active assessment attempt in progress/i);
    expect(res.body.data.attempt._id).toBe(attemptId);
    expect(createSpy).not.toHaveBeenCalled();
  });

  // 13. Invalid assessment ID on start
  test('13. Invalid assessment ID on start: returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/candidate/assessments/invalid-id-123/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid assessment id/i);
  });

  // 14. Invalid attempt ID on submit
  test('14. Invalid attempt ID on submit: returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/candidate/attempts/invalid-attempt-id/submit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid attempt id/i);
  });

  // 15. Attempt not found on submit
  test('15. Attempt not found on submit: returns 404 Not Found', async () => {
    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/assessment attempt not found/i);
  });

  // 16. Active attempt auto-finalization on start
  test('16. Active attempt auto-finalization on start: stale in-progress attempt is auto-finalized and new attempt is started', async () => {
    jest.spyOn(Assessment, 'findOne').mockResolvedValue(mockAssessment);
    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    const expiredAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
      answers: [],
    };

    // First findOne returns the expired in_progress attempt
    jest.spyOn(AssessmentAttempt, 'findOne').mockResolvedValue(expiredAttempt);
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue({
      ...expiredAttempt,
      status: 'expired',
    });
    // countDocuments returns 1 (the 1 expired attempt)
    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(1);

    const newAttempt = {
      _id: '707f1f77bcf86cd799439066',
      candidateId: candidateAId,
      assessmentId,
      attemptNumber: 2,
      status: 'in_progress',
    };
    jest.spyOn(AssessmentAttempt, 'create').mockResolvedValue(newAttempt);

    const res = await request(app)
      .post(`/api/candidate/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attempt.attemptNumber).toBe(2);
  });

  // 17. Concurrent start race condition: catches duplicate-key error 11000 and resolves to concurrent active attempt
  test('17. Concurrent start race condition: catches duplicate-key code 11000 from partial unique index and returns active attempt', async () => {
    jest.spyOn(Assessment, 'findOne').mockResolvedValue(mockAssessment);

    // Initial pre-flight check found nothing (race condition simulation)
    jest.spyOn(AssessmentAttempt, 'findOne')
      .mockResolvedValueOnce(null) // pre-flight check at line 43
      .mockResolvedValueOnce({ // catch block lookup at line 96
        _id: attemptId,
        candidateId: candidateAId,
        assessmentId,
        status: 'in_progress',
        attemptNumber: 1,
      });

    jest.spyOn(AssessmentAttempt, 'countDocuments').mockResolvedValue(0);

    // Simulate create collision on partial unique index
    const dupErr = new Error('E11000 duplicate key error');
    dupErr.code = 11000;
    jest.spyOn(AssessmentAttempt, 'create').mockRejectedValue(dupErr);

    const res = await request(app)
      .post(`/api/candidate/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/active assessment attempt in progress/i);
    expect(res.body.data.attempt._id).toBe(attemptId);
  });

  // 18. Atomic status transition guard on submit: returns 400 when attempt has already been finalized/submitted
  test('18. Atomic status transition guard on submit: returns 400 when attempt has already been submitted or expired by concurrent request', async () => {
    const inProgressAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 20 * 60000),
      answers: [],
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(inProgressAttempt);
    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    // findOneAndUpdate matches 0 documents because competing process already finalized/submitted it
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already been submitted or expired/i);
  });

  // 19. Submit attempt fails with 404 if underlying assessment is not found
  test('19. Submit attempt fails with 404 if underlying assessment is deleted/missing', async () => {
    const inProgressAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() + 20 * 60000),
      answers: [],
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(inProgressAttempt);
    jest.spyOn(Assessment, 'findById').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/candidate/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/underlying assessment not found/i);
  });

  // 20. Candidate attempt history endpoint (GET /api/candidate/attempts)
  test('20. Candidate attempt history: retrieves attempts list with optional assessmentId filter and on-access expiry', async () => {
    const attemptsList = [
      {
        _id: attemptId,
        candidateId: candidateAId,
        assessmentId: mockAssessment,
        status: 'completed',
        score: 5,
        totalMarks: 6,
        percentage: 83.33,
        passed: true,
      },
    ];

    // On-access expiry check returns empty list of elapsed attempts
    jest.spyOn(AssessmentAttempt, 'find')
      .mockResolvedValueOnce([]) // elapsedAttempts
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(attemptsList),
        }),
      });

    const res = await request(app)
      .get(`/api/candidate/attempts?assessmentId=${assessmentId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data.attempts[0]._id).toBe(attemptId);
  });

  // 21. Get attempt by ID unauthorized access (GET /api/candidate/attempts/:attemptId)
  test('21. Get attempt by ID returns 403 Forbidden when candidate attempts to view another candidate attempt', async () => {
    const attemptOwnedByB = {
      _id: attemptId,
      candidateId: candidateBId,
      assessmentId: mockAssessment,
      status: 'completed',
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(attemptOwnedByB),
    });

    const res = await request(app)
      .get(`/api/candidate/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized to view this assessment attempt/i);
  });

  // 22. GET /api/candidate/attempts on-access expiry sweep
  test('22. Candidate attempt history: on-access expiry sweep finalizes stale in-progress attempts', async () => {
    const staleAttempt = {
      _id: '707f1f77bcf86cd799439077',
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() - 60000),
      answers: [],
    };

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(AssessmentAttempt, 'find')
      .mockResolvedValueOnce([staleAttempt]) // elapsedAttempts found
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([{ ...staleAttempt, status: 'expired' }]),
        }),
      });

    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue({
      ...staleAttempt,
      status: 'expired',
    });

    const res = await request(app)
      .get('/api/candidate/attempts')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
  });

  // 23. GET /api/candidate/attempts/:attemptId input validation and not-found handling
  test('23. Get attempt by ID returns 400 on malformed ID and 404 when attempt does not exist', async () => {
    const resBad = await request(app)
      .get('/api/candidate/attempts/bad-id-123')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resBad.status).toBe(400);
    expect(resBad.body.message).toMatch(/invalid attempt id/i);

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    const resNotFound = await request(app)
      .get(`/api/candidate/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.message).toMatch(/assessment attempt not found/i);
  });

  // 24. GET /api/candidate/attempts/:attemptId on-access expiry
  test('24. Get attempt by ID triggers on-access expiry when viewing stale in-progress attempt', async () => {
    const staleAttempt = {
      _id: attemptId,
      candidateId: candidateAId,
      assessmentId,
      status: 'in_progress',
      expiresAt: new Date(Date.now() - 60000),
      answers: [],
    };

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(staleAttempt),
    });

    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue({
      ...staleAttempt,
      status: 'expired',
    });

    const res = await request(app)
      .get(`/api/candidate/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 25. GET /api/candidate/attempts/:attemptId/result input validation and not-found handling
  test('25. Get attempt result returns 400 on malformed ID and 404 when attempt not found', async () => {
    const resBad = await request(app)
      .get('/api/candidate/attempts/bad-id-123/result')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resBad.status).toBe(400);
    expect(resBad.body.message).toMatch(/invalid attempt id/i);

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    const resNotFound = await request(app)
      .get(`/api/candidate/attempts/${attemptId}/result`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.message).toMatch(/assessment attempt not found/i);
  });

  // 26. GET /api/candidate/assessments/history on-access expiry sweep
  test('26. Candidate assessment history: on-access expiry sweep finalizes stale in-progress attempts', async () => {
    const staleAttempt = {
      _id: '707f1f77bcf86cd799439077',
      candidateId: candidateAId,
      assessmentId: mockAssessment,
      status: 'in_progress',
      expiresAt: new Date(Date.now() - 60000),
      answers: [],
      attemptNumber: 1,
      createdAt: new Date(),
    };

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(AssessmentAttempt, 'find')
      .mockResolvedValueOnce([staleAttempt]) // elapsedAttempts found
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([{ ...staleAttempt, status: 'expired' }]),
        }),
      });

    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue({
      ...staleAttempt,
      status: 'expired',
    });

    const res = await request(app)
      .get('/api/candidate/assessments/history')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
  });
});
