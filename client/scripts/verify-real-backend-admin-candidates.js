import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');
const serverRoot = path.resolve(__dirname, '../../server');

// Require server modules via server's package.json context
const serverRequire = createRequire(path.join(serverRoot, 'package.json'));
const app = serverRequire('./app');
const mongoose = serverRequire('mongoose');
const User = serverRequire('./models/User');
const CandidateProfile = serverRequire('./models/CandidateProfile');
const Assessment = serverRequire('./models/Assessment');
const AssessmentAttempt = serverRequire('./models/AssessmentAttempt');
const InterviewSlot = serverRequire('./models/InterviewSlot');
const InterviewBooking = serverRequire('./models/InterviewBooking');
const { MongoMemoryServer } = serverRequire('mongodb-memory-server');
const jwt = serverRequire('jsonwebtoken');

function getChromePath() {
  const defaultPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(defaultPath)) return defaultPath;
  const x86Path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(x86Path)) return x86Path;
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const userPath = path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe');
    if (fs.existsSync(userPath)) return userPath;
  }
  return defaultPath;
}

async function runRealBackendAdminCandidatesVerification() {
  console.log('=== [ADMIN CANDIDATE MANAGEMENT REAL BACKEND VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_admin_candidates_secret_1234567890_min32';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start MongoDB in-memory engine
  console.log('[1/5] Starting real MongoDB in-memory engine...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  console.log(`✓ Real MongoDB engine running at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log('✓ Mongoose connected to real MongoDB instance.');

  // 2. Seed Real Database Documents
  console.log('[2/5] Seeding admin, candidates, profiles, assessments, attempts, and bookings...');

  const adminUser = await User.create({
    email: 'admin.candidates@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidateA = await User.create({
    email: 'alice.walker@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  await CandidateProfile.create({
    user: candidateA._id,
    fullName: 'Alice Walker',
    headline: 'Principal Systems Architect (C++/Distributed)',
    skills: ['C++', 'Distributed Systems', 'Kubernetes'],
    experienceLevel: 'lead',
    yearsOfExperience: 10,
    profileCompletionPercentage: 95,
    location: 'San Francisco, CA',
    phone: '+1 555-0101',
    bio: 'Lead architect specializing in high-throughput distributed engines.',
    githubUrl: 'https://github.com/alicewalker',
    linkedinUrl: 'https://linkedin.com/in/alicewalker',
    education: [
      {
        institution: 'Stanford University',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Science',
        graduationYear: 2014,
        gpa: '3.9',
      },
    ],
    resume: {
      url: '/uploads/resumes/alice_resume.pdf',
      fileName: 'alice_resume.pdf',
      originalName: 'Alice_Walker_CV.pdf',
      uploadedAt: new Date(),
    },
  });

  const candidateB = await User.create({
    email: 'bob.smith@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  await CandidateProfile.create({
    user: candidateB._id,
    fullName: 'Bob Smith',
    headline: 'Senior Full Stack Engineer (Node.js/React)',
    skills: ['React', 'Node.js', 'TypeScript', 'MongoDB'],
    experienceLevel: 'senior',
    yearsOfExperience: 6,
    profileCompletionPercentage: 75,
    location: 'Austin, TX',
  });

  const candidateC = await User.create({
    email: 'charlie.entry@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: false, // Inactive, unprofiled
  });

  // Seed Assessment & Completed Attempt for Candidate A
  const assessment1 = await Assessment.create({
    title: 'Distributed Systems & Architecture Evaluation',
    description: 'Deep architectural assessment for lead and staff engineering candidates.',
    difficulty: 'advanced',
    durationMinutes: 45,
    passingPercentage: 75,
    maxAttempts: 3,
    isPublished: true,
    createdBy: adminUser._id,
  });

  await AssessmentAttempt.create({
    candidateId: candidateA._id,
    assessmentId: assessment1._id,
    attemptNumber: 1,
    startTime: new Date(Date.now() - 3600000),
    expiresAt: new Date(Date.now() - 900000),
    endTime: new Date(Date.now() - 1200000),
    status: 'completed',
    score: 90,
    totalMarks: 100,
    percentage: 90,
    answers: [],
  });

  // Seed Slot & Booking for Candidate A
  const slot1 = await InterviewSlot.create({
    createdBy: adminUser._id,
    title: 'Lead Architect Technical Panel',
    interviewerName: 'Dr. Jane Smith',
    startTime: new Date(Date.now() + 86400000),
    endTime: new Date(Date.now() + 90000000),
    durationMinutes: 60,
    capacity: 1,
    bookedCount: 1,
    status: 'available',
    meetingLink: 'https://meet.google.com/test-real-panel',
  });

  await InterviewBooking.create({
    candidate: candidateA._id,
    slot: slot1._id,
    status: 'confirmed',
  });

  // Generate Tokens
  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const candidateToken = jwt.sign(
    { id: candidateA._id.toString(), email: candidateA.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log('✓ Database seeded with 1 Admin, 3 Candidates, Profiles, Attempts, and Bookings.');

  // 3. Start Real Express HTTP Server on Port 5000
  console.log('[3/5] Starting real Express HTTP server on port 5000...');
  const expressServer = app.listen(5000);
  await new Promise((resolve) => expressServer.on('listening', resolve));
  console.log('✓ Real Express API server listening on http://localhost:5000');

  // 4. Start Vite Dev Server on Port 5173
  console.log('[4/5] Launching Vite client server on port 5173...');
  const vite = await createServer({
    root: clientRoot,
    server: { port: 5173 },
  });
  await vite.listen();
  console.log('✓ Vite frontend running on http://localhost:5173');

  // 5. Launch Puppeteer Browser
  console.log('[5/5] Launching Puppeteer browser with Chrome...');
  const browser = await puppeteer.launch({
    executablePath: getChromePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('[vite]') && !text.includes('Download the React DevTools')) {
      console.log('BROWSER LOG:', text);
    }
  });

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
    // =============================================================
    // SCENARIO 1: RBAC Route Guard & Redirection
    // =============================================================
    console.log('\n--- Scenario 1: RBAC Enforcement & Route Guard ---');

    // Candidate token visits /admin/candidates -> redirect to /forbidden
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      {
        token: candidateToken,
        user: { id: candidateA._id.toString(), email: candidateA.email, role: 'candidate' },
      }
    );

    await page.goto('http://localhost:5173/admin/candidates', { waitUntil: 'networkidle0' });
    assert(
      page.url().includes('/forbidden'),
      `Candidate token redirected to /forbidden upon visiting /admin/candidates (actual URL: ${page.url()})`
    );

    // Admin token visits /admin/candidates -> successfully lands
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      {
        token: adminToken,
        user: { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' },
      }
    );

    await page.goto('http://localhost:5173/admin/candidates', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="candidates-data-table"]', { timeout: 8000 });
    assert(
      page.url().includes('/admin/candidates'),
      `Admin successfully authenticated and landed on /admin/candidates (URL: ${page.url()})`
    );

    const headingText = await page.$eval('h2', (el) => el.textContent.trim());
    assert(headingText === 'Manage Candidates', `Admin page renders "Manage Candidates" heading`);

    // =============================================================
    // SCENARIO 2: Candidate Listing, KPI Cards & Pagination
    // =============================================================
    console.log('\n--- Scenario 2: Candidate Listing, KPI Cards & Field Rendering ---');

    const totalKpi = await page.$eval('[data-testid="total-candidates-count"]', (el) => el.textContent.trim());
    assert(totalKpi === '3', `Total Candidates KPI displays 3 (received: ${totalKpi})`);

    const activeKpi = await page.$eval('[data-testid="active-candidates-count"]', (el) => el.textContent.trim());
    assert(activeKpi === '2', `Active Accounts KPI displays 2 (received: ${activeKpi})`);

    const inactiveKpi = await page.$eval('[data-testid="inactive-candidates-count"]', (el) => el.textContent.trim());
    assert(inactiveKpi === '1', `Deactivated Accounts KPI displays 1 (received: ${inactiveKpi})`);

    const rowCount = await page.$$eval('[data-testid^="candidate-row-"]', (els) => els.length);
    assert(rowCount === 3, `Data table renders 3 candidate rows (received: ${rowCount})`);

    // Verify Candidate A details in table
    const rowASelector = `[data-testid="candidate-row-${candidateA._id}"]`;
    const candAName = await page.$eval(`${rowASelector} [data-testid="candidate-display-name"]`, (el) => el.textContent.trim());
    assert(candAName === 'Alice Walker', `Candidate A row displays name "Alice Walker"`);

    const candAEmail = await page.$eval(`${rowASelector} .candidate-email`, (el) => el.textContent.trim());
    assert(candAEmail === candidateA.email, `Candidate A row displays email "${candidateA.email}"`);

    const candAStatus = await page.$eval(`[data-testid="candidate-status-badge-${candidateA._id}"]`, (el) => el.textContent.trim());
    assert(candAStatus === 'Active', `Candidate A status badge displays "Active"`);

    const candAExp = await page.$eval(`${rowASelector} .exp-badge`, (el) => el.textContent.trim());
    assert(candAExp === 'LEAD', `Candidate A experience badge displays "LEAD"`);

    const candASkills = await page.$$eval(`${rowASelector} .skill-chip`, (els) => els.map((e) => e.textContent.trim()));
    assert(candASkills.includes('C++'), `Candidate A displays "C++" skill chip`);

    // Verify Candidate C (unprofiled)
    const rowCSelector = `[data-testid="candidate-row-${candidateC._id}"]`;
    const candCName = await page.$eval(`${rowCSelector} [data-testid="candidate-display-name"]`, (el) => el.textContent.trim());
    assert(candCName === 'Unprofiled Candidate', `Candidate C (unprofiled) renders fallback "Unprofiled Candidate"`);

    const candCStatus = await page.$eval(`[data-testid="candidate-status-badge-${candidateC._id}"]`, (el) => el.textContent.trim());
    assert(candCStatus === 'Inactive', `Candidate C status badge displays "Inactive"`);

    // =============================================================
    // SCENARIO 3: ReDoS-Resistant Search & Filter Interactions
    // =============================================================
    console.log('\n--- Scenario 3: ReDoS-Resistant Search & Filters ---');

    // 3a. Search with regex special characters 'C++'
    await page.type('[data-testid="candidates-search-input"]', 'C++');
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('[data-testid^="candidate-row-"]');
      return rows.length === 1;
    }, { timeout: 5000 });

    const searchCPlusRows = await page.$$eval('[data-testid^="candidate-row-"]', (els) => els.length);
    assert(searchCPlusRows === 1, `Searching regex special characters 'C++' literally matches only Candidate A (rows: ${searchCPlusRows})`);

    // Clear search
    await page.click('.clear-search-btn');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 3, { timeout: 5000 });

    // 3b. Search with parentheses & slash '(Node.js/React)'
    await page.type('[data-testid="candidates-search-input"]', '(Node.js/React)');
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('[data-testid^="candidate-row-"]');
      return rows.length === 1;
    }, { timeout: 5000 });

    const searchNodeRows = await page.$$eval('[data-testid^="candidate-row-"]', (els) => els.length);
    assert(searchNodeRows === 1, `Searching parentheses '(Node.js/React)' literally matches only Candidate B`);

    await page.click('.clear-search-btn');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 3, { timeout: 5000 });

    // 3c. ReDoS attack pattern test
    const startTime = Date.now();
    await page.type('[data-testid="candidates-search-input"]', '((a+)+)+$');
    await page.waitForSelector('[data-testid="candidates-empty-state"]', { timeout: 5000 });
    const searchElapsed = Date.now() - startTime;
    assert(searchElapsed < 3000, `ReDoS attack pattern '((a+)+)+$' executed safely in ${searchElapsed}ms without event-loop freeze`);

    await page.click('[data-testid="candidates-empty-state"] button'); // Reset All Filters
    await page.waitForSelector('[data-testid="candidates-data-table"]', { timeout: 5000 });

    // 3d. Status Filter Active
    await page.click('[data-testid="status-filter-active"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 2, { timeout: 5000 });
    const activeRows = await page.$$eval('[data-testid^="candidate-row-"]', (els) => els.length);
    assert(activeRows === 2, `Status filter "Active" filtered to 2 active candidate rows`);

    // 3e. Status Filter Inactive
    await page.click('[data-testid="status-filter-inactive"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 1, { timeout: 5000 });
    const inactiveRows = await page.$$eval('[data-testid^="candidate-row-"]', (els) => els.length);
    assert(inactiveRows === 1, `Status filter "Inactive" filtered to 1 inactive candidate row (Charlie)`);

    // Reset status filter to All
    await page.click('[data-testid="status-filter-all"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 3, { timeout: 5000 });

    // 3f. Experience Filter
    await page.select('[data-testid="experience-filter-select"]', 'lead');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 1, { timeout: 5000 });
    const leadRows = await page.$$eval('[data-testid^="candidate-row-"]', (els) => els.length);
    assert(leadRows === 1, `Experience filter "lead" isolated Candidate A`);

    await page.select('[data-testid="experience-filter-select"]', 'all');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="candidate-row-"]').length === 3, { timeout: 5000 });

    // =============================================================
    // SCENARIO 4: Enable / Disable Candidate Account & Auth Enforcement
    // =============================================================
    console.log('\n--- Scenario 4: Account Deactivation & Reactivation Lifecycle ---');

    // Admin clicks "Disable" on Candidate A
    const disableBtnSelector = `[data-testid="toggle-status-btn-${candidateA._id}"]`;
    await page.click(disableBtnSelector);
    await page.waitForSelector('[data-testid="status-toggle-modal"]', { timeout: 5000 });
    assert(true, `Confirmation modal popped up upon clicking "Disable"`);

    const modalBodyText = await page.$eval('.modal-body', (el) => el.textContent);
    assert(
      modalBodyText.includes(candidateA.email) && modalBodyText.includes('Immediate Effect'),
      `Modal warns about immediate session invalidation for ${candidateA.email}`
    );

    // Confirm Deactivation
    await page.click('[data-testid="confirm-status-toggle-btn"]');
    await page.waitForSelector('[data-testid="toast-container"] .toast-item', { timeout: 5000 });
    const toastText = await page.$eval('.toast-message', (el) => el.textContent);
    assert(toastText.includes('deactivated'), `Toast confirmed deactivation of candidate account`);

    // Verify Candidate A status badge updated to Inactive in DOM
    await page.waitForFunction(
      (candId) => {
        const badge = document.querySelector(`[data-testid="candidate-status-badge-${candId}"]`);
        return badge && badge.textContent.trim() === 'Inactive';
      },
      {},
      candidateA._id.toString()
    );
    assert(true, `Candidate A status badge in UI dynamically updated to "Inactive"`);

    // Verify directly in MongoDB database
    const dbUserDeactivated = await User.findById(candidateA._id);
    assert(dbUserDeactivated.isActive === false, `MongoDB User document verified: isActive === false`);

    // Verify Immediate API Authentication Enforcement (Candidate Token rejected with 403)
    const apiRes = await fetch('http://localhost:5000/api/candidate/profile', {
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    assert(apiRes.status === 403, `Deactivated candidate token immediately receives 403 Forbidden on API request`);

    // Verify Immediate Login Rejection (403)
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: candidateA.email, password: 'Password123!' }),
    });
    assert(loginRes.status === 403, `Deactivated candidate login immediately rejected with 403 Forbidden`);

    // Re-enable Candidate A
    const enableBtnSelector = `[data-testid="toggle-status-btn-${candidateA._id}"]`;
    await page.click(enableBtnSelector);
    await page.waitForSelector('[data-testid="status-toggle-modal"]', { timeout: 5000 });
    await page.click('[data-testid="confirm-status-toggle-btn"]');

    await page.waitForFunction(
      (candId) => {
        const badge = document.querySelector(`[data-testid="candidate-status-badge-${candId}"]`);
        return badge && badge.textContent.trim() === 'Active';
      },
      {},
      candidateA._id.toString()
    );
    assert(true, `Candidate A status badge updated back to "Active"`);

    const dbUserReactivated = await User.findById(candidateA._id);
    assert(dbUserReactivated.isActive === true, `MongoDB User document verified: isActive === true after re-enabling`);

    // =============================================================
    // SCENARIO 5: Candidate 360 Detail View & Navigation
    // =============================================================
    console.log('\n--- Scenario 5: Candidate 360 Detail View & Data Integrity ---');

    // Click "View 360" for Candidate A
    await page.click(`[data-testid="view-candidate-btn-${candidateA._id}"]`);
    await page.waitForSelector('[data-testid="candidate-header-card"]', { timeout: 8000 });
    assert(
      page.url().includes(`/admin/candidates/${candidateA._id}`),
      `Successfully navigated to /admin/candidates/${candidateA._id} (URL: ${page.url()})`
    );

    const detailName = await page.$eval('[data-testid="detail-display-name"]', (el) => el.textContent.trim());
    assert(detailName === 'Alice Walker', `Detail header renders "Alice Walker"`);

    const detailEmail = await page.$eval('[data-testid="detail-email"]', (el) => el.textContent.trim());
    assert(detailEmail.includes(candidateA.email), `Detail header renders email "${candidateA.email}"`);

    const detailStatus = await page.$eval('[data-testid="detail-status-pill"]', (el) => el.textContent.trim());
    assert(detailStatus === 'Active Account', `Detail header renders "Active Account" pill`);

    const detailCompletion = await page.$eval('[data-testid="detail-completion-stat"]', (el) => el.textContent.trim());
    assert(detailCompletion === '100%', `Detail metric displays profile completion 100% (received: ${detailCompletion})`);

    const detailExp = await page.$eval('[data-testid="detail-experience-stat"]', (el) => el.textContent.trim());
    assert(detailExp === 'LEAD', `Detail metric displays experience tier LEAD`);

    const detailSkills = await page.$$eval('[data-testid="detail-skills-list"] .skill-chip', (els) => els.map((e) => e.textContent.trim()));
    assert(detailSkills.includes('C++') && detailSkills.includes('Distributed Systems'), `Detail view renders verified skills chips including C++`);

    const resumeText = await page.$eval('[data-testid="detail-resume-card"]', (el) => el.textContent);
    assert(resumeText.includes('Alice_Walker_CV.pdf'), `Detail resume card renders original filename "Alice_Walker_CV.pdf"`);

    // Verify populated Interview Booking
    const bookingTitle = await page.$eval('[data-testid="detail-bookings-table"] tbody tr strong', (el) => el.textContent.trim());
    assert(bookingTitle === 'Lead Architect Technical Panel', `Interview bookings table displays populated slot title "Lead Architect Technical Panel"`);

    const bookingStatus = await page.$eval('[data-testid="detail-bookings-table"] .status-pill', (el) => el.textContent.trim());
    assert(bookingStatus === 'CONFIRMED', `Interview booking status displays "CONFIRMED"`);

    // Verify populated Assessment Attempt (using verified candidateId and assessmentId)
    const attemptTitle = await page.$eval('[data-testid="detail-attempts-table"] tbody tr strong', (el) => el.textContent.trim());
    assert(
      attemptTitle === 'Distributed Systems & Architecture Evaluation',
      `Assessment history table displays real test title "Distributed Systems & Architecture Evaluation"`
    );

    const attemptScore = await page.$eval('[data-testid="detail-attempts-table"] tbody tr td:nth-child(3)', (el) => el.textContent.trim());
    assert(attemptScore === '90 / 100', `Assessment attempt displays real score "90 / 100"`);

    const attemptResult = await page.$eval('[data-testid="detail-attempts-table"] .badge-success', (el) => el.textContent.trim());
    assert(attemptResult === 'PASSED', `Assessment attempt displays result "PASSED"`);

    // Back to Candidates Navigation
    await page.click('[data-testid="back-to-candidates-link"]');
    await page.waitForSelector('[data-testid="candidates-data-table"]', { timeout: 5000 });
    assert(page.url().endsWith('/admin/candidates'), `Breadcrumb "← Back to Candidates" successfully returns to candidates list`);

    console.log('\n=================================================================');
    console.log(`✓ All ${passedCount} Real Backend Admin Candidate tests PASSED successfully!`);
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n✗ Real backend admin candidates verification encountered an error:', err);
    try {
      const currentUrl = page.url();
      console.error('URL at error:', currentUrl);
      const text = await page.evaluate(() => document.body.innerText);
      console.error('Page text at error:\n', text.slice(0, 1000));
    } catch (_) {}
    process.exitCode = 1;
  } finally {
    await browser.close();
    await vite.close();
    await new Promise((resolve) => expressServer.close(resolve));
    await mongoose.connection.close();
    await mongod.stop();
  }
}

runRealBackendAdminCandidatesVerification();
