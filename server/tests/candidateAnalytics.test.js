const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const { finalizeExpiredAttempt } = require('../services/scoringService');

describe('Candidate Analytics & Assessment Results API', () => {
  const secret = 'analytics_test_jwt_secret_12345678901234567890';
  let originalSecret;

  const candidateAId = '507f1f77bcf86cd799439011';
  const candidateBId = '507f1f77bcf86cd799439022';
  const adminId = '507f1f77bcf86cd799439033';
  const assessmentId = '607f1f77bcf86cd799439044';
  const attemptA1Id = '707f1f77bcf86cd799439051';
  const attemptA2Id = '707f1f77bcf86cd799439052';
  const attemptB1Id = '707f1f77bcf86cd799439053';

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

  // 1. Detailed Result Correctness (Completed Attempt)
  test('1. Detailed Result Correctness: returns score, percentage, correct/incorrect/unanswered counts, and calculated time taken for completed attempt', async () => {
    const startTime = new Date('2026-09-19T10:00:00Z');
    const endTime = new Date('2026-09-19T10:15:30Z'); // 930 seconds = 15.5 minutes

    const completedAttempt = {
      _id: attemptA1Id,
      candidateId: candidateAId,
      assessmentId: mockAssessment,
      attemptNumber: 1,
      status: 'completed',
      startTime,
      endTime,
      expiresAt: new Date('2026-09-19T10:30:00Z'),
      score: 5,
      totalMarks: 6,
      percentage: 83.33,
      passed: true,
      answers: [
        { questionId: q1Id, topic: 'Algorithms', selectedOptionIndex: 1, isCorrect: true, marksAwarded: 2 },
        { questionId: q2Id, topic: 'Data Structures', selectedOptionIndex: 0, isCorrect: true, marksAwarded: 3 },
        { questionId: q3Id, topic: 'Algorithms', selectedOptionIndex: 0, isCorrect: false, marksAwarded: 0 },
      ],
      topicBreakdown: [
        { topic: 'Algorithms', score: 2, totalMarks: 3, percentage: 66.67, correctCount: 1, totalQuestions: 2 },
        { topic: 'Data Structures', score: 3, totalMarks: 3, percentage: 100, correctCount: 1, totalQuestions: 1 },
      ],
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(completedAttempt),
    });

    const res = await request(app)
      .get(`/api/candidate/attempts/${attemptA1Id}/result`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const r = res.body.data.result;
    expect(r.attemptId).toBe(attemptA1Id);
    expect(r.score).toBe(5);
    expect(r.totalMarks).toBe(6);
    expect(r.percentage).toBe(83.33);
    expect(r.passed).toBe(true);
    expect(r.correctCount).toBe(2);
    expect(r.incorrectCount).toBe(1);
    expect(r.unansweredCount).toBe(0);
    expect(r.totalQuestions).toBe(3);
    expect(r.timeTakenSeconds).toBe(930);
    expect(r.timeTakenMinutes).toBe(15.5);
    expect(r.assessment.title).toBe('Data Structures & Algorithms');
    expect(r.topicBreakdown).toHaveLength(2);
  });

  // 2. Detailed Result Correctness (Expired Attempt on-access)
  test('2. Detailed Result Correctness (Expired Attempt): on-access expiry scores attempt with authentic totalMarks, score 0, and consistent endTime=expiresAt', async () => {
    const startTime = new Date(Date.now() - 35 * 60 * 1000);
    const expiresAt = new Date(Date.now() - 5 * 60 * 1000); // Expired 5 mins ago

    const rawActiveAttempt = {
      _id: attemptA1Id,
      candidateId: candidateAId,
      assessmentId,
      attemptNumber: 1,
      status: 'in_progress',
      startTime,
      expiresAt,
      answers: [],
    };

    const finalizedExpiredAttempt = {
      ...rawActiveAttempt,
      assessmentId: mockAssessment,
      status: 'expired',
      endTime: expiresAt,
      score: 0,
      totalMarks: 6,
      percentage: 0,
      passed: false,
      answers: [
        { questionId: q1Id, topic: 'Algorithms', selectedOptionIndex: null, isCorrect: false, marksAwarded: 0 },
        { questionId: q2Id, topic: 'Data Structures', selectedOptionIndex: null, isCorrect: false, marksAwarded: 0 },
        { questionId: q3Id, topic: 'Algorithms', selectedOptionIndex: null, isCorrect: false, marksAwarded: 0 },
      ],
      topicBreakdown: [
        { topic: 'Algorithms', score: 0, totalMarks: 3, percentage: 0, correctCount: 0, totalQuestions: 2 },
        { topic: 'Data Structures', score: 0, totalMarks: 3, percentage: 0, correctCount: 0, totalQuestions: 1 },
      ],
    };

    // First call returns the active attempt
    // Second call after finalizeExpiredAttempt returns the finalized populated attempt
    let callCount = 0;
    jest.spyOn(AssessmentAttempt, 'findById').mockImplementation((id) => {
      callCount++;
      return {
        populate: jest.fn().mockResolvedValue(
          callCount === 1
            ? { ...rawActiveAttempt, assessmentId: mockAssessment }
            : finalizedExpiredAttempt
        ),
      };
    });

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockResolvedValue(finalizedExpiredAttempt);

    const res = await request(app)
      .get(`/api/candidate/attempts/${attemptA1Id}/result`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const r = res.body.data.result;
    expect(r.status).toBe('expired');
    expect(r.score).toBe(0);
    expect(r.totalMarks).toBe(6);
    expect(r.percentage).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.correctCount).toBe(0);
    expect(r.unansweredCount).toBe(3);
    // timeTakenSeconds = 30 minutes * 60 = 1800s (consistent with expiresAt)
    expect(r.timeTakenSeconds).toBe(1800);
    expect(r.timeTakenMinutes).toBe(30);
  });

  // 3. Result Ownership Isolation
  test('3. Result Ownership Isolation: Candidate B cannot view Candidate A attempt result (returns 403)', async () => {
    const attemptOwnedByA = {
      _id: attemptA1Id,
      candidateId: candidateAId, // Belongs to Candidate A
      assessmentId: mockAssessment,
      status: 'completed',
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(attemptOwnedByA),
    });

    const res = await request(app)
      .get(`/api/candidate/attempts/${attemptA1Id}/result`)
      .set('Authorization', `Bearer ${tokenB}`); // Request from Candidate B

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized to view this assessment result/i);
  });

  // 4. Active In-Progress Attempt Guard on /result
  test('4. Active In-Progress Attempt Guard: accessing /result for an active, unexpired attempt returns 400', async () => {
    const futureExpiry = new Date(Date.now() + 20 * 60 * 1000); // 20 mins remaining

    const activeAttempt = {
      _id: attemptA1Id,
      candidateId: candidateAId,
      assessmentId: mockAssessment,
      status: 'in_progress',
      expiresAt: futureExpiry,
    };

    jest.spyOn(AssessmentAttempt, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(activeAttempt),
    });

    const res = await request(app)
      .get(`/api/candidate/attempts/${attemptA1Id}/result`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/still in progress/i);
  });

  // 5. Assessment History Listing & Isolation
  test('5. Assessment History Listing & Isolation: candidate receives own completed and expired history; Candidate B receives only their own', async () => {
    const candidateAHistory = [
      {
        _id: attemptA1Id,
        candidateId: candidateAId,
        assessmentId: mockAssessment,
        attemptNumber: 1,
        status: 'completed',
        score: 5,
        totalMarks: 6,
        percentage: 83.33,
        passed: true,
        startTime: new Date('2026-09-19T10:00:00Z'),
        endTime: new Date('2026-09-19T10:15:00Z'),
        createdAt: new Date('2026-09-19T10:15:00Z'),
      },
      {
        _id: attemptA2Id,
        candidateId: candidateAId,
        assessmentId: mockAssessment,
        attemptNumber: 2,
        status: 'expired',
        score: 0,
        totalMarks: 6,
        percentage: 0,
        passed: false,
        startTime: new Date('2026-09-19T11:00:00Z'),
        endTime: new Date('2026-09-19T11:30:00Z'),
        createdAt: new Date('2026-09-19T11:30:00Z'),
      },
    ];

    const candidateBHistory = [
      {
        _id: attemptB1Id,
        candidateId: candidateBId,
        assessmentId: mockAssessment,
        attemptNumber: 1,
        status: 'completed',
        score: 6,
        totalMarks: 6,
        percentage: 100,
        passed: true,
        startTime: new Date('2026-09-19T12:00:00Z'),
        endTime: new Date('2026-09-19T12:20:00Z'),
        createdAt: new Date('2026-09-19T12:20:00Z'),
      },
    ];

    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.status === 'in_progress') {
        return Promise.resolve([]);
      }
      let result = [];
      if (filter.candidateId === candidateAId) {
        result = candidateAHistory;
      } else if (filter.candidateId === candidateBId) {
        result = candidateBHistory;
      }
      return {
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(result),
        }),
      };
    });

    // Request from Candidate A
    const resA = await request(app)
      .get('/api/candidate/assessments/history')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.count).toBe(2);
    expect(resA.body.data.history[0].attemptId).toBe(attemptA1Id);
    expect(resA.body.data.history[1].attemptId).toBe(attemptA2Id);

    // Request from Candidate B
    const resB = await request(app)
      .get('/api/candidate/assessments/history')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    expect(resB.body.count).toBe(1);
    expect(resB.body.data.history[0].attemptId).toBe(attemptB1Id);
  });

  // 6. Topic-Wise Performance Aggregation & Expiry Exclusion
  test('6. Topic-Wise Performance Aggregation: computes aggregated accuracy per topic across completed attempts and strictly excludes expired attempts', async () => {
    const candidateACompletedAttempts = [
      {
        _id: attemptA1Id,
        candidateId: candidateAId,
        status: 'completed',
        topicBreakdown: [
          { topic: 'Algorithms', score: 2, totalMarks: 3, correctCount: 1, totalQuestions: 2 },
          { topic: 'Data Structures', score: 3, totalMarks: 3, correctCount: 1, totalQuestions: 1 },
        ],
      },
      {
        _id: attemptA2Id,
        candidateId: candidateAId,
        status: 'completed',
        topicBreakdown: [
          { topic: 'Algorithms', score: 1, totalMarks: 3, correctCount: 1, totalQuestions: 2 },
          { topic: 'Data Structures', score: 2, totalMarks: 3, correctCount: 1, totalQuestions: 1 },
        ],
      },
    ];

    // Verify that the query specifically filters for status: 'completed'
    let capturedFilter = null;
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      capturedFilter = filter;
      if (filter.candidateId === candidateAId && filter.status === 'completed') {
        return candidateACompletedAttempts;
      }
      return [];
    });

    const res = await request(app)
      .get('/api/candidate/performance/topic-wise')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(capturedFilter.status).toBe('completed'); // Strict exclusion of expired attempts

    const topics = res.body.data.topics;
    expect(topics).toHaveLength(2);

    const algo = topics.find((t) => t.topic === 'Algorithms');
    const ds = topics.find((t) => t.topic === 'Data Structures');

    // Algorithms: score = 2+1=3, totalMarks = 3+3=6 -> accuracy = 50%
    expect(algo.score).toBe(3);
    expect(algo.totalMarks).toBe(6);
    expect(algo.accuracy).toBe(50);
    expect(algo.correctCount).toBe(2);
    expect(algo.totalQuestions).toBe(4);
    expect(algo.questionAccuracy).toBe(50);

    // Data Structures: score = 3+2=5, totalMarks = 3+3=6 -> accuracy = 83.33%
    expect(ds.score).toBe(5);
    expect(ds.totalMarks).toBe(6);
    expect(ds.accuracy).toBe(83.33);
    expect(ds.correctCount).toBe(2);
    expect(ds.totalQuestions).toBe(2);
    expect(ds.questionAccuracy).toBe(100);
  });

  // 7. Topic-Wise Performance Ownership Isolation
  test('7. Topic-Wise Performance Ownership Isolation: Candidate B only sees aggregates from their own attempts', async () => {
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((filter) => {
      if (filter.candidateId === candidateBId && filter.status === 'completed') {
        return [
          {
            _id: attemptB1Id,
            candidateId: candidateBId,
            status: 'completed',
            topicBreakdown: [
              { topic: 'System Design', score: 4, totalMarks: 5, correctCount: 1, totalQuestions: 1 },
            ],
          },
        ];
      }
      return [];
    });

    const res = await request(app)
      .get('/api/candidate/performance/topic-wise')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data.topics[0].topic).toBe('System Design');
    expect(res.body.data.topics[0].accuracy).toBe(80);
  });

  // 8. Concurrent finalizeExpiredAttempt Race Guard
  test('8. Concurrent finalizeExpiredAttempt Race Guard: simultaneous calls on the same attempt execute exactly one atomic update', async () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000);
    const rawAttempt = {
      _id: attemptA1Id,
      candidateId: candidateAId,
      assessmentId,
      attemptNumber: 1,
      status: 'in_progress',
      expiresAt: pastExpiry,
      answers: [],
    };

    jest.spyOn(Assessment, 'findById').mockResolvedValue(mockAssessment);
    jest.spyOn(Question, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockQuestions),
    });

    let currentStatus = 'in_progress';
    let atomicUpdateCount = 0;

    const finalizedDoc = {
      ...rawAttempt,
      status: 'expired',
      endTime: pastExpiry,
      score: 0,
      totalMarks: 6,
      percentage: 0,
      passed: false,
    };

    // Atomic findOneAndUpdate simulation
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      if (filter.status === 'in_progress' && currentStatus === 'in_progress') {
        currentStatus = 'expired';
        atomicUpdateCount++;
        return finalizedDoc;
      }
      return null; // Losing concurrent call matches 0 documents
    });

    jest.spyOn(AssessmentAttempt, 'findById').mockResolvedValue(finalizedDoc);

    // Call finalizeExpiredAttempt simultaneously from two simulated call sites
    const [result1, result2] = await Promise.all([
      finalizeExpiredAttempt(rawAttempt),
      finalizeExpiredAttempt(rawAttempt),
    ]);

    // Exactly one atomic update executed
    expect(atomicUpdateCount).toBe(1);

    // Both callers received the exact same consistent finalized document
    expect(result1.status).toBe('expired');
    expect(result2.status).toBe('expired');
    expect(result1.score).toBe(0);
    expect(result2.score).toBe(0);
    expect(result1.totalMarks).toBe(6);
    expect(result2.totalMarks).toBe(6);
  });
});
