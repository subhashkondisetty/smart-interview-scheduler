const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');
const { uploadDir } = require('../middleware/upload');

describe('Candidate Resume Upload, Deletion, Retrieval & Ownership', () => {
  const secret = 'resume_test_jwt_secret_12345678901234567890';
  let originalSecret;
  let originalMaxMb;

  const candidateAId = '507f1f77bcf86cd799439011';
  const candidateBId = '507f1f77bcf86cd799439022';

  let tokenA;
  let tokenB;
  const createdTestFiles = [];

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    originalMaxMb = process.env.MAX_FILE_SIZE_MB;
    process.env.JWT_SECRET = secret;
    process.env.MAX_FILE_SIZE_MB = '2'; // 2 MB test threshold

    tokenA = jwt.sign({ id: candidateAId, email: 'candidateA@test.com', role: 'candidate' }, secret, {
      expiresIn: '1h',
    });
    tokenB = jwt.sign({ id: candidateBId, email: 'candidateB@test.com', role: 'candidate' }, secret, {
      expiresIn: '1h',
    });
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.MAX_FILE_SIZE_MB = originalMaxMb;

    // Clean up any files created during test in uploads/resumes
    for (const filename of createdTestFiles) {
      const fullPath = path.join(uploadDir, filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          // ignore cleanup errors
        }
      }
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/candidate/profile/resume', () => {
    test('should upload a valid PDF resume and update profile completion percentage', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const profileDoc = new CandidateProfile({
        user: candidateAId,
        fullName: 'Candidate A',
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(profileDoc);
      jest.spyOn(profileDoc, 'save').mockImplementation(async function () {
        this.profileCompletionPercentage = this.calculateCompletion();
        return this;
      });

      const pdfBuffer = Buffer.from('%PDF-1.4 sample test pdf content');

      const res = await request(app)
        .post('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', pdfBuffer, {
          filename: 'my_resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Resume uploaded successfully');
      expect(res.body.data.resume.originalName).toBe('my_resume.pdf');
      expect(res.body.data.resume.fileName).toMatch(/^resume-[a-f0-9-]+\.pdf$/);
      expect(res.body.data.profileCompletionPercentage).toBeGreaterThan(0);

      // Verify file was written to disk and track for cleanup
      const uploadedFilePath = path.join(uploadDir, res.body.data.resume.fileName);
      expect(fs.existsSync(uploadedFilePath)).toBe(true);
      createdTestFiles.push(res.body.data.resume.fileName);
    });

    test('should reject invalid file types (e.g. .png / image/png)', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const imageBuffer = Buffer.from('fake image content');

      const res = await request(app)
        .post('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', imageBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Only PDF, DOC, and DOCX files are allowed/i);
    });

    test('should delete old resume on replace when new resume is uploaded', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      // Create dummy existing file on disk
      const oldFileName = `resume-old-file-${Date.now()}.pdf`;
      const oldFilePath = path.join(uploadDir, oldFileName);
      fs.writeFileSync(oldFilePath, 'dummy old pdf content');
      createdTestFiles.push(oldFileName);

      const profileDoc = new CandidateProfile({
        user: candidateAId,
        resume: {
          url: '/api/candidate/profile/resume',
          fileName: oldFileName,
          originalName: 'old_resume.pdf',
          uploadedAt: new Date(),
        },
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(profileDoc);
      jest.spyOn(profileDoc, 'save').mockImplementation(async function () {
        this.profileCompletionPercentage = this.calculateCompletion();
        return this;
      });

      const newPdfBuffer = Buffer.from('%PDF-1.4 new resume content');

      const res = await request(app)
        .post('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', newPdfBuffer, {
          filename: 'updated_resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check old file was deleted from disk
      expect(fs.existsSync(oldFilePath)).toBe(false);

      // Track new file
      createdTestFiles.push(res.body.data.resume.fileName);
    });

    test('should reject oversized file exceeding MAX_FILE_SIZE_MB', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      // Temporarily set limit to 1MB and attach 1.2MB buffer
      process.env.MAX_FILE_SIZE_MB = '1';
      const oversizedBuffer = Buffer.alloc(Math.floor(1.2 * 1024 * 1024), 'a');

      const res = await request(app)
        .post('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', oversizedBuffer, {
          filename: 'huge_resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/File size exceeds the allowed limit of 1MB/i);

      process.env.MAX_FILE_SIZE_MB = '2';
    });
  });

  describe('GET /api/candidate/profile/resume (Retrieval)', () => {
    test('should download candidate resume when present', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const testFileName = `resume-retrieval-${Date.now()}.pdf`;
      const testFilePath = path.join(uploadDir, testFileName);
      fs.writeFileSync(testFilePath, '%PDF-1.4 retrieval test content');
      createdTestFiles.push(testFileName);

      const profileDoc = {
        user: candidateAId,
        resume: {
          fileName: testFileName,
          originalName: 'my_downloadable_resume.pdf',
          url: '/api/candidate/profile/resume',
        },
      };

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(profileDoc);

      const res = await request(app)
        .get('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/my_downloadable_resume\.pdf/);
    });

    test('should return 404 when candidate has no resume', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('should return 404 when resume file is missing from disk', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const profileDoc = {
        _id: '607f1f77bcf86cd799439011',
        user: candidateAId,
        resume: {
          fileName: 'nonexistent-resume-file.pdf',
          originalName: 'missing.pdf',
          url: '/api/candidate/profile/resume',
        },
      };

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(profileDoc);

      const res = await request(app)
        .get('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/file not found on server/i);
    });
  });

  describe('DELETE /api/candidate/profile/resume', () => {
    test('should delete candidate resume file from disk and clear DB fields', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const testFileName = `resume-delete-${Date.now()}.pdf`;
      const testFilePath = path.join(uploadDir, testFileName);
      fs.writeFileSync(testFilePath, '%PDF-1.4 delete test content');

      const profileDoc = new CandidateProfile({
        user: candidateAId,
        resume: {
          fileName: testFileName,
          originalName: 'to_be_deleted.pdf',
          url: '/api/candidate/profile/resume',
        },
      });

      jest.spyOn(CandidateProfile, 'findOne').mockResolvedValue(profileDoc);
      jest.spyOn(profileDoc, 'save').mockImplementation(async function () {
        this.profileCompletionPercentage = this.calculateCompletion();
        return this;
      });

      const res = await request(app)
        .delete('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(fs.existsSync(testFilePath)).toBe(false);
      expect(profileDoc.resume.url).toBe('');
      expect(profileDoc.resume.fileName).toBe('');
    });
  });

  describe('Ownership Enforcement on Resume Operations', () => {
    test('Candidate A cannot delete Candidate B resume', async () => {
      // Authenticate as Candidate A
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: candidateAId,
        email: 'candidateA@test.com',
        role: 'candidate',
        isActive: true,
      });

      const bFileName = `resume-b-${Date.now()}.pdf`;
      const bFilePath = path.join(uploadDir, bFileName);
      fs.writeFileSync(bFilePath, '%PDF-1.4 candidate B private resume');
      createdTestFiles.push(bFileName);

      // In DB, Candidate A has no resume
      const profileA = new CandidateProfile({
        user: candidateAId,
        resume: { fileName: '', url: '' },
      });

      const findOneMock = jest.fn().mockImplementation((query) => {
        expect(query.user).toBe(candidateAId); // Verification that query strictly searches candidateAId
        expect(query.user).not.toBe(candidateBId);
        return profileA;
      });

      jest.spyOn(CandidateProfile, 'findOne').mockImplementation(findOneMock);

      const res = await request(app)
        .delete('/api/candidate/profile/resume')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Candidate B's file on disk must NOT be touched or deleted
      expect(fs.existsSync(bFilePath)).toBe(true);
    });
  });
});
