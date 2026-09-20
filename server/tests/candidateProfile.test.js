const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');

describe('Candidate Profile API (GET/PUT /api/candidate/profile & Ownership Enforcement)', () => {
  const secret = 'profile_test_jwt_secret_12345678901234567890';
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

  describe('GET /api/candidate/profile', () => {
    test('should fetch candidate own profile successfully', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const profileDoc = {
        _id: '607f1f77bcf86cd799439011',
        user: { _id: candidateAId, email: 'candidateA@test.com', role: 'candidate' },
        fullName: 'Candidate A',
        profileCompletionPercentage: 20,
      };

      jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(profileDoc),
      });

      const res = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.fullName).toBe('Candidate A');
      expect(res.body.data.profile.user._id).toBe(candidateAId);
    });

    test('should create default profile if one does not exist yet', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      jest.spyOn(CandidateProfile, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const createdDoc = { _id: '607f1f77bcf86cd799439011', user: candidateAId };
      jest.spyOn(CandidateProfile, 'create').mockResolvedValue(createdDoc);
      jest.spyOn(CandidateProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...createdDoc,
          fullName: '',
          profileCompletionPercentage: 0,
          user: { _id: candidateAId, email: 'candidateA@test.com' },
        }),
      });

      const res = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.user._id).toBe(candidateAId);
    });

    test('should return 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/candidate/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return 403 when non-candidate accesses endpoint', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: adminId,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
      });

      const res = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/candidate/profile', () => {
    test('should update candidate profile and recalculate completion percentage', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const profileInstance = new CandidateProfile({
        user: candidateAId,
        fullName: 'Initial Name',
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(profileInstance);
      jest.spyOn(profileInstance, 'save').mockImplementation(async function () {
        this.profileCompletionPercentage = this.calculateCompletion();
        return this;
      });

      jest.spyOn(CandidateProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockImplementation(() => ({
          ...profileInstance.toJSON(),
          user: { _id: candidateAId, email: 'candidateA@test.com' },
        })),
      });

      const updateData = {
        fullName: 'Alice Developer',
        phone: '+1234567890',
        headline: 'Senior MERN Stack Engineer',
        bio: 'Passionate about building scalable cloud-native architectures.',
        skills: ['React', 'Node.js', 'MongoDB', 'TypeScript'],
        education: [
          {
            institution: 'Tech University',
            degree: 'B.S. in Computer Science',
            graduationYear: 2024,
          },
        ],
        githubUrl: 'https://github.com/alicedev',
      };

      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.fullName).toBe('Alice Developer');
      expect(res.body.data.profile.profileCompletionPercentage).toBeGreaterThan(50);
    });

    test('should automatically create profile if one does not exist yet when updating', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CandidateProfile.prototype, 'save').mockImplementation(async function () {
        this._id = '607f1f77bcf86cd799439011';
        return this;
      });

      jest.spyOn(CandidateProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockImplementation(() => ({
          _id: '607f1f77bcf86cd799439011',
          user: { _id: candidateAId, email: 'candidateA@test.com' },
          fullName: 'Created On Update',
        })),
      });

      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ fullName: 'Created On Update' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.fullName).toBe('Created On Update');
    });

    test('should fail validation with 400 when invalid payload is sent', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          githubUrl: 'not-a-valid-url',
          skills: 'this-should-be-an-array',
          yearsOfExperience: -5,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('githubUrl must be a valid HTTP/HTTPS URL');
      expect(res.body.errors).toContain('skills must be an array of strings');
      expect(res.body.errors).toContain('yearsOfExperience must be a non-negative number');
    });

    test('should successfully update targetRole with valid enum values (including Data Scientist/ML Engineer)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const existingProfile = new CandidateProfile({
        user: candidateAId,
        fullName: 'Alice Developer',
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(existingProfile);
      jest.spyOn(existingProfile, 'save').mockResolvedValue(existingProfile);
      jest.spyOn(CandidateProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockImplementation(() => ({
          ...existingProfile.toJSON(),
          targetRole: 'Data Scientist/ML Engineer',
          user: { _id: candidateAId, email: 'candidateA@test.com' },
        })),
      });

      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetRole: 'Data Scientist/ML Engineer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.targetRole).toBe('Data Scientist/ML Engineer');
      expect(existingProfile.targetRole).toBe('Data Scientist/ML Engineer');
    });

    test('should normalize empty string targetRole to null', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const existingProfile = new CandidateProfile({
        user: candidateAId,
        fullName: 'Alice Developer',
        targetRole: 'Backend Developer',
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(existingProfile);
      jest.spyOn(existingProfile, 'save').mockResolvedValue(existingProfile);
      jest.spyOn(CandidateProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockImplementation(() => ({
          ...existingProfile.toJSON(),
          targetRole: null,
          user: { _id: candidateAId, email: 'candidateA@test.com' },
        })),
      });

      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetRole: '' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(existingProfile.targetRole).toBeNull();
    });

    test('should reject invalid targetRole with 400 Bad Request', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetRole: 'Astronaut & Deep Space Pilot' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('targetRole must be one of')])
      );
    });

    test('CandidateProfile Mongoose schema validates targetRole enum values', () => {
      const allowedRoles = [
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'Mobile Developer',
        'Data Scientist/ML Engineer',
        'DevOps Engineer',
        'QA/SDET',
        'Other',
      ];

      for (const role of allowedRoles) {
        const doc = new CandidateProfile({ user: candidateAId, targetRole: role });
        const err = doc.validateSync(['targetRole']);
        expect(err).toBeUndefined();
      }

      // Null and undefined must be valid (optional)
      const docNull = new CandidateProfile({ user: candidateAId, targetRole: null });
      expect(docNull.validateSync(['targetRole'])).toBeUndefined();

      const docUndefined = new CandidateProfile({ user: candidateAId });
      expect(docUndefined.validateSync(['targetRole'])).toBeUndefined();

      // Invalid role must fail Mongoose validation
      const docInvalid = new CandidateProfile({ user: candidateAId, targetRole: 'Invalid Role' });
      const errInvalid = docInvalid.validateSync(['targetRole']);
      expect(errInvalid).toBeDefined();
      expect(errInvalid.errors.targetRole).toBeDefined();
    });
  });

  describe('Ownership Violation Enforcement', () => {
    test('Candidate A cannot read Candidate B profile, even when injecting candidate B ID in query or body', async () => {
      // User A is authenticated
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      // DB returns Candidate A's profile when queried for candidateAId
      const profileA = {
        _id: '607f1f77bcf86cd799439011',
        user: { _id: candidateAId, email: 'candidateA@test.com' },
        fullName: 'Candidate A Only',
        profileCompletionPercentage: 40,
      };

      const findOneMock = jest.fn().mockImplementation((query) => {
        expect(query.user).toBe(candidateAId); // Guarantees lookup only ever searches for req.user._id
        expect(query.user).not.toBe(candidateBId);
        return {
          populate: jest.fn().mockResolvedValue(profileA),
        };
      });

      jest.spyOn(CandidateProfile, 'findOne').mockImplementation(findOneMock);

      // Attempt attack: Candidate A tries to access Candidate B by query param
      const res = await request(app)
        .get(`/api/candidate/profile?user=${candidateBId}&id=607f1f77bcf86cd799439099`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.fullName).toBe('Candidate A Only');
      expect(res.body.data.profile.user._id).toBe(candidateAId);
      expect(res.body.data.profile.user._id).not.toBe(candidateBId);
    });

    test('Candidate A cannot overwrite Candidate B profile, even when injecting candidate B user in body', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const profileA = new CandidateProfile({
        user: candidateAId,
        fullName: 'Candidate A Initial',
      });

      const findOneMock = jest.fn().mockImplementation((query) => {
        expect(query.user).toBe(candidateAId);
        return profileA;
      });

      jest.spyOn(CandidateProfile, 'findOne').mockImplementation(findOneMock);
      jest.spyOn(profileA, 'save').mockResolvedValue(profileA);
      jest.spyOn(CandidateProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          ...profileA.toJSON(),
          user: { _id: candidateAId, email: 'candidateA@test.com' },
        }),
      });

      // Attempt attack: Candidate A tries to reassign profile to Candidate B
      const res = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user: candidateBId, // Maliciously injected field
          _id: '607f1f77bcf86cd799439022',
          fullName: 'Hacked Name',
        });

      expect(res.status).toBe(200);
      // Profile's user must strictly remain candidateAId
      expect(profileA.user.toString()).toBe(candidateAId);
      expect(profileA.user.toString()).not.toBe(candidateBId);
      expect(res.body.data.profile.user._id).toBe(candidateAId);
    });
  });
});
