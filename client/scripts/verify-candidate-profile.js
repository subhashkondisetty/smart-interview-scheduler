import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

// 1. In-Memory Mock Backend for Candidate Profile
function startMockBackend(port = 5000) {
  let mockProfile = {
    _id: 'prof-987',
    user: {
      _id: 'cand101',
      email: 'candidate@example.com',
      role: 'candidate',
      createdAt: new Date().toISOString(),
    },
    fullName: 'Jane Candidate',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    headline: '',
    bio: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    experienceLevel: 'entry',
    yearsOfExperience: 0,
    skills: ['JavaScript'],
    education: [],
    resume: {
      url: '',
      fileName: '',
      originalName: '',
      uploadedAt: null,
    },
    // Contact: 20%, Skills: 20% -> 40%
    profileCompletionPercentage: 40,
  };

  let uploadRequestCount = 0;

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        const authHeader = req.headers.authorization || '';

        // GET /api/auth/me
        if (req.url === '/api/auth/me' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Current user profile retrieved',
              data: {
                user: {
                  _id: 'cand101',
                  email: 'candidate@example.com',
                  role: 'candidate',
                  isActive: true,
                },
              },
            })
          );
          return;
        }

        // GET /api/candidate/profile
        if (req.url === '/api/candidate/profile' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Candidate profile retrieved successfully',
              data: { profile: mockProfile },
            })
          );
          return;
        }

        // PUT /api/candidate/profile
        if (req.url === '/api/candidate/profile' && req.method === 'PUT') {
          const parsed = JSON.parse(body || '{}');
          Object.assign(mockProfile, parsed);

          // Calculate authoritative backend score
          let score = 0;
          if (mockProfile.fullName) score += 10;
          if (mockProfile.phone || mockProfile.location) score += 10;
          if (mockProfile.headline || mockProfile.bio) score += 15;
          if (Array.isArray(mockProfile.skills) && mockProfile.skills.length > 0) score += 20;
          if (Array.isArray(mockProfile.education) && mockProfile.education.some(e => e.institution || e.degree)) score += 20;
          if (mockProfile.githubUrl || mockProfile.linkedinUrl || mockProfile.portfolioUrl) score += 10;
          if (mockProfile.resume?.url) score += 15;

          mockProfile.profileCompletionPercentage = Math.min(100, score);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Candidate profile updated successfully',
              data: { profile: mockProfile },
            })
          );
          return;
        }

        // POST /api/candidate/profile/resume
        if (req.url === '/api/candidate/profile/resume' && req.method === 'POST') {
          uploadRequestCount++;
          // Parse filename from multipart or use default
          let filename = 'uploaded_resume.pdf';
          const match = body.match(/filename="([^"]+)"/);
          if (match && match[1]) filename = match[1];

          mockProfile.resume = {
            url: '/api/candidate/profile/resume',
            fileName: `resume-mock-${Date.now()}.pdf`,
            originalName: filename,
            uploadedAt: new Date().toISOString(),
          };

          // Recompute authoritative score with resume (+15%)
          let score = 0;
          if (mockProfile.fullName) score += 10;
          if (mockProfile.phone || mockProfile.location) score += 10;
          if (mockProfile.headline || mockProfile.bio) score += 15;
          if (Array.isArray(mockProfile.skills) && mockProfile.skills.length > 0) score += 20;
          if (Array.isArray(mockProfile.education) && mockProfile.education.some(e => e.institution || e.degree)) score += 20;
          if (mockProfile.githubUrl || mockProfile.linkedinUrl || mockProfile.portfolioUrl) score += 10;
          if (mockProfile.resume?.url) score += 15;

          mockProfile.profileCompletionPercentage = Math.min(100, score);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Resume uploaded successfully',
              data: {
                resume: mockProfile.resume,
                profileCompletionPercentage: mockProfile.profileCompletionPercentage,
              },
            })
          );
          return;
        }

        // DELETE /api/candidate/profile/resume
        if (req.url === '/api/candidate/profile/resume' && req.method === 'DELETE') {
          mockProfile.resume = {
            url: '',
            fileName: '',
            originalName: '',
            uploadedAt: null,
          };

          // Recompute authoritative score without resume (-15%)
          let score = 0;
          if (mockProfile.fullName) score += 10;
          if (mockProfile.phone || mockProfile.location) score += 10;
          if (mockProfile.headline || mockProfile.bio) score += 15;
          if (Array.isArray(mockProfile.skills) && mockProfile.skills.length > 0) score += 20;
          if (Array.isArray(mockProfile.education) && mockProfile.education.some(e => e.institution || e.degree)) score += 20;
          if (mockProfile.githubUrl || mockProfile.linkedinUrl || mockProfile.portfolioUrl) score += 10;

          mockProfile.profileCompletionPercentage = Math.min(100, score);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Resume deleted successfully',
              data: {
                profileCompletionPercentage: mockProfile.profileCompletionPercentage,
              },
            })
          );
          return;
        }

        // GET /api/candidate/profile/resume (Download)
        if (req.url === '/api/candidate/profile/resume' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="resume.pdf"',
          });
          res.end('%PDF-1.4 Mock resume content for verification');
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
      });
    });

    server.getUploadCount = () => uploadRequestCount;

    server.listen(port, () => {
      resolve(server);
    });
  });
}

// 2. Headless Chrome Browser Verification
async function runVerification() {
  console.log('=== [CANDIDATE PROFILE RUNTIME VERIFICATION SUITE] ===\n');

  console.log('[1/4] Starting mock backend server on http://localhost:5000...');
  const mockServer = await startMockBackend(5000);
  console.log('✓ Mock backend server running.');

  console.log('[2/4] Starting Vite dev server on http://localhost:5173...');
  const vite = await createServer({
    root: clientRoot,
    server: { port: 5173, host: 'localhost' },
  });
  await vite.listen();
  console.log('✓ Vite dev server running.\n');

  console.log('[3/4] Launching headless browser...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  let testCount = 0;
  let passedCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      console.log(`  ✓ [TEST ${testCount}] PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ [TEST ${testCount}] FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    console.log('[4/4] Executing runtime interaction tests...\n');

    // Setup candidate token
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('token', 'valid-candidate-token-xyz');
    });

    // Navigate to Candidate Profile page
    await page.goto('http://localhost:5173/candidate/profile', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="candidate-profile-page"]', { timeout: 5000 });

    // TEST 1: Initial Profile Load & Rendering
    const fullNameValue = await page.$eval('[data-testid="input-fullName"]', (el) => el.value);
    const emailReadonlyValue = await page.$eval('[data-testid="input-email-readonly"]', (el) => el.value);
    const initialScoreText = await page.$eval('[data-testid="completion-percentage"]', (el) => el.textContent.trim());
    const isDirtyVisibleInitially = await page.$('[data-testid="completion-dirty-tag"]');

    assert(
      fullNameValue === 'Jane Candidate' && emailReadonlyValue === 'candidate@example.com',
      'Initial profile inputs populated correctly with locked account email'
    );
    assert(
      initialScoreText === '40%' && isDirtyVisibleInitially === null,
      'Initial authoritative score is 40% with clean (non-dirty) state'
    );

    // TEST 2: Live Optimistic Recalculation While Editing (Overview + Headline)
    await page.evaluate(() => {
      const headlineInput = document.querySelector('[data-testid="input-headline"]');
      headlineInput.value = 'Senior Full Stack Engineer';
      headlineInput._valueTracker?.setValue('');
      headlineInput.dispatchEvent(new Event('input', { bubbles: true }));
      headlineInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="completion-percentage"]');
      return el && el.textContent.trim() === '55%';
    }, { timeout: 3000 });

    const isDirtyTagPresent = await page.$('[data-testid="completion-dirty-tag"]');
    assert(
      isDirtyTagPresent !== null,
      'Live optimistic score dynamically recalculated to 55% (+15% for headline) with dirty tag visible'
    );

    // Add education entry
    await page.click('[data-testid="btn-add-education-first"]');
    await page.waitForSelector('[data-testid="input-edu-institution-0"]', { timeout: 3000 });

    await page.evaluate(() => {
      const instInput = document.querySelector('[data-testid="input-edu-institution-0"]');
      instInput.value = 'Stanford University';
      instInput._valueTracker?.setValue('');
      instInput.dispatchEvent(new Event('input', { bubbles: true }));
      instInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="completion-percentage"]');
      return el && el.textContent.trim() === '75%';
    }, { timeout: 3000 });

    const educationScoreText = await page.$eval('[data-testid="completion-percentage"]', (el) => el.textContent.trim());
    assert(
      educationScoreText === '75%',
      'Live optimistic score dynamically recalculated to 75% (+20% for education)'
    );

    // TEST 3: Authoritative Backend Overwrite on Save (PUT /api/candidate/profile)
    await page.click('[data-testid="btn-save-profile-top"]');
    await page.waitForSelector('[data-testid="alert-success"]', { timeout: 5000 });
    const successMsg = await page.$eval('[data-testid="alert-success"]', (el) => el.textContent);
    const isDirtyAfterSave = await page.$('[data-testid="completion-dirty-tag"]');
    const scoreAfterSave = await page.$eval('[data-testid="completion-percentage"]', (el) => el.textContent.trim());

    assert(
      successMsg.includes('Candidate profile updated successfully') && isDirtyAfterSave === null,
      'Save succeeded, success alert displayed, and dirty state reset'
    );
    assert(
      scoreAfterSave === '75%',
      'Authoritative backend score of 75% retained and displayed post-save'
    );

    // TEST 4: Client-Side Pre-Flight Resume File Type Rejection
    const initialUploadCount = mockServer.getUploadCount();

    // Trigger invalid file upload using client-side File dispatch
    await page.evaluate(() => {
      const file = new File(['fake script content'], 'malicious_tool.exe', { type: 'application/x-msdownload' });
      const input = document.querySelector('[data-testid="input-upload-resume-file"]');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForSelector('[data-testid="alert-resume-error"]', { timeout: 3000 });
    const typeErrorText = await page.$eval('[data-testid="alert-resume-error"]', (el) => el.textContent);
    const postInvalidTypeCount = mockServer.getUploadCount();

    assert(
      typeErrorText.includes('Invalid file type. Only PDF, DOC, and DOCX files are allowed.') &&
      postInvalidTypeCount === initialUploadCount,
      'Invalid file type (.exe) rejected client-side with exact backend error; zero HTTP requests made'
    );

    // TEST 5: Client-Side Pre-Flight Resume File Size Rejection (>5MB)
    await page.evaluate(() => {
      // 6MB simulated buffer
      const hugeBuffer = new Uint8Array(6 * 1024 * 1024);
      const hugeFile = new File([hugeBuffer], 'large_resume.pdf', { type: 'application/pdf' });
      const input = document.querySelector('[data-testid="input-upload-resume-file"]');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(hugeFile);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="alert-resume-error"]');
      return el && el.textContent.includes('File size exceeds the allowed limit of 5MB.');
    }, { timeout: 3000 });

    const sizeErrorText = await page.$eval('[data-testid="alert-resume-error"]', (el) => el.textContent);
    const postInvalidSizeCount = mockServer.getUploadCount();

    assert(
      sizeErrorText.includes('File size exceeds the allowed limit of 5MB.') &&
      postInvalidSizeCount === initialUploadCount,
      'Oversized file (>5MB) rejected client-side with exact backend error; zero HTTP requests made'
    );

    // TEST 6: Valid Resume Upload with Progress and Authoritative Overwrite (+15%)
    await page.evaluate(() => {
      const validBuffer = new Uint8Array(10 * 1024); // 10KB
      const validFile = new File([validBuffer], 'jane_resume_2026.pdf', { type: 'application/pdf' });
      const input = document.querySelector('[data-testid="input-upload-resume-file"]');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(validFile);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForSelector('[data-testid="uploaded-resume-box"]', { timeout: 5000 });
    const resumeFilenameText = await page.$eval('.resume-filename', (el) => el.textContent);
    const scoreAfterResumeUpload = await page.$eval('[data-testid="completion-percentage"]', (el) => el.textContent.trim());

    assert(
      resumeFilenameText === 'jane_resume_2026.pdf' && scoreAfterResumeUpload === '90%',
      'Valid PDF uploaded successfully: resume box displayed and authoritative score updated to 90% (+15% resume bonus)'
    );

    // TEST 7: Resume Deletion with Authoritative Backend Overwrite (-15%)
    await page.click('[data-testid="btn-show-delete-resume"]');
    await page.waitForSelector('[data-testid="btn-confirm-delete-resume"]', { timeout: 3000 });
    await page.click('[data-testid="btn-confirm-delete-resume"]');

    await page.waitForSelector('[data-testid="resume-dropzone-box"]', { timeout: 5000 });
    const scoreAfterResumeDelete = await page.$eval('[data-testid="completion-percentage"]', (el) => el.textContent.trim());

    assert(
      scoreAfterResumeDelete === '75%',
      'Resume deleted successfully: dropzone restored and authoritative score decremented back to 75%'
    );

    console.log(`\n==================================================`);
    console.log(`All ${passedCount}/${testCount} Runtime Candidate Profile tests passed successfully (100%)!`);
    console.log(`==================================================\n`);

  } finally {
    await browser.close();
    await vite.close();
    mockServer.close();
  }
}

runVerification().catch((err) => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
