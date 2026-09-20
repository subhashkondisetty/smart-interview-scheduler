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
const Assessment = serverRequire('./models/Assessment');
const Question = serverRequire('./models/Question');
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

async function runRealBackendAdminDashboardVerification() {
  console.log('=== [ADMIN DASHBOARD REAL BACKEND INTEGRATION VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_admin_dashboard_jwt_secret_key_1234567890';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start real MongoDB in-memory engine
  console.log('[1/5] Starting real MongoDB in-memory engine...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  console.log(`✓ Real MongoDB engine running at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log('✓ Mongoose connected to real MongoDB instance.');

  // 2. Seed Real Database Documents
  console.log('[2/5] Seeding admin, candidates, assessments, slots, and bookings into MongoDB...');

  const adminUser = await User.create({
    email: 'admin.ops@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidate1 = await User.create({
    email: 'candidate.alpha@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const candidate2 = await User.create({
    email: 'candidate.beta@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const candidateToken = jwt.sign(
    { id: candidate1._id.toString(), email: candidate1.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Seed Assessments (2 published, 1 draft)
  const assessment1 = await Assessment.create({
    title: 'Cloud Native Architecture',
    description: 'Kubernetes orchestration, serverless microservices, and event streams.',
    difficulty: 'advanced',
    durationMinutes: 30,
    passingPercentage: 60,
    maxAttempts: 3,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const assessment2 = await Assessment.create({
    title: 'Data Structures Sprint',
    description: 'Heaps, graphs, and dynamic programming challenges.',
    difficulty: 'intermediate',
    durationMinutes: 25,
    passingPercentage: 70,
    maxAttempts: 2,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const assessment3 = await Assessment.create({
    title: 'Internal Engineering Draft',
    description: 'Unpublished draft assessment.',
    difficulty: 'beginner',
    durationMinutes: 15,
    passingPercentage: 50,
    maxAttempts: 1,
    isPublished: false,
    createdBy: adminUser._id,
  });

  // Seed Questions
  const q1 = await Question.create({
    assessmentId: assessment1._id,
    text: 'What is the primary role of an ingress controller in Kubernetes?',
    options: ['Manage external HTTP routing', 'Allocate RAM', 'Compile source code', 'Backup DB'],
    correctOptionIndex: 0,
    marks: 8,
    topic: 'Kubernetes',
    difficulty: 'advanced',
  });

  // Seed 3 Assessment Attempts (2 completed: 100% and 50%, 1 expired: 0%)
  const now = Date.now();
  await AssessmentAttempt.create({
    candidateId: candidate1._id,
    assessmentId: assessment1._id,
    attemptNumber: 1,
    startTime: new Date(now - 60 * 60 * 1000),
    endTime: new Date(now - 40 * 60 * 1000),
    expiresAt: new Date(now - 30 * 60 * 1000),
    status: 'completed',
    score: 8,
    totalMarks: 8,
    percentage: 100,
    passed: true,
    answers: [{ questionId: q1._id, selectedOptionIndex: 0, isCorrect: true, marksAwarded: 8 }],
  });

  await AssessmentAttempt.create({
    candidateId: candidate2._id,
    assessmentId: assessment1._id,
    attemptNumber: 1,
    startTime: new Date(now - 90 * 60 * 1000),
    endTime: new Date(now - 70 * 60 * 1000),
    expiresAt: new Date(now - 60 * 60 * 1000),
    status: 'completed',
    score: 4,
    totalMarks: 8,
    percentage: 50,
    passed: false,
    answers: [{ questionId: q1._id, selectedOptionIndex: 1, isCorrect: false, marksAwarded: 4 }],
  });

  await AssessmentAttempt.create({
    candidateId: candidate1._id,
    assessmentId: assessment2._id,
    attemptNumber: 1,
    startTime: new Date(now - 180 * 60 * 1000),
    endTime: new Date(now - 155 * 60 * 1000),
    expiresAt: new Date(now - 155 * 60 * 1000),
    status: 'expired',
    score: 0,
    totalMarks: 10,
    percentage: 0,
    passed: false,
    answers: [],
  });

  // Seed Interview Slots (1 upcoming, 1 past)
  const slotUpcoming = await InterviewSlot.create({
    title: 'Senior Systems Design Session',
    startTime: new Date(now + 24 * 3600 * 1000), // tomorrow
    endTime: new Date(now + 25 * 3600 * 1000),
    durationMinutes: 60,
    capacity: 2,
    bookedCount: 1,
    status: 'available',
    createdBy: adminUser._id,
  });

  const slotPast = await InterviewSlot.create({
    title: 'Frontend Architecture Deep-Dive',
    startTime: new Date(now - 48 * 3600 * 1000), // 2 days ago
    endTime: new Date(now - 47 * 3600 * 1000),
    durationMinutes: 60,
    capacity: 1,
    bookedCount: 1,
    status: 'available',
    createdBy: adminUser._id,
  });

  // Seed 4 Interview Bookings (1 upcoming, 1 completed, 1 cancelled, 1 rescheduled)
  await InterviewBooking.create({
    candidate: candidate1._id,
    slot: slotUpcoming._id,
    status: 'confirmed',
    notes: 'Preparing for distributed systems interview',
  });

  await InterviewBooking.create({
    candidate: candidate2._id,
    slot: slotPast._id,
    status: 'confirmed',
    notes: 'Frontend past interview session',
  });

  await InterviewBooking.create({
    candidate: candidate1._id,
    slot: slotUpcoming._id,
    status: 'cancelled',
    cancelledAt: new Date(now - 5 * 3600 * 1000),
  });

  await InterviewBooking.create({
    candidate: candidate2._id,
    slot: slotPast._id,
    status: 'rescheduled',
  });

  console.log(`✓ Seeded Admin User: ${adminUser.email}`);
  console.log(`✓ Seeded Candidates: ${candidate1.email}, ${candidate2.email}`);
  console.log(`✓ Seeded Assessments: 2 published, 1 draft (total 3)`);
  console.log(`✓ Seeded Attempts: 2 completed (100%, 50%), 1 expired (0%) => Platform Avg: 75%`);
  console.log(`✓ Seeded Bookings: 1 upcoming, 1 completed, 1 cancelled, 1 rescheduled (total 4)\n`);

  // 3. Start real Express Server
  console.log('[3/5] Starting real Express HTTP server on http://localhost:5000...');
  const expressServer = await new Promise((resolve) => {
    const s = app.listen(5000, () => resolve(s));
  });
  console.log('✓ Real Express HTTP server listening on port 5000.\n');

  // 4. Start Vite Dev Server
  console.log('[4/5] Starting Vite dev server on http://localhost:5173...');
  const vite = await createServer({
    root: clientRoot,
    server: { port: 5173, host: 'localhost' },
  });
  await vite.listen();
  console.log('✓ Vite dev server running on http://localhost:5173.\n');

  // 5. Run Puppeteer Browser Integration Suite
  console.log('[5/5] Launching headless browser to test Admin Dashboard integration...');
  const chromePath = getChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
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
    // First inject candidate credentials and attempt to access /admin/dashboard
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      {
        token: candidateToken,
        user: { id: candidate1._id.toString(), email: candidate1.email, role: 'candidate' },
      }
    );

    await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle0' });
    assert(
      page.url().includes('/forbidden'),
      `Candidate token redirected to /forbidden upon visiting /admin/dashboard (actual URL: ${page.url()})`
    );

    // Now inject admin credentials and load Admin Dashboard
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

    await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 5000 });
    assert(
      page.url().includes('/admin/dashboard'),
      `Admin successfully authenticated and landed on /admin/dashboard (URL: ${page.url()})`
    );

    const titleText = await page.$eval('[data-testid="admin-page-title"]', (el) => el.textContent.trim());
    assert(titleText === 'Operations Overview', `Admin page title rendered as "Operations Overview"`);

    // =============================================================
    // SCENARIO 2: Stat Cards Real Backend Aggregation & Direct Invariant Consumption
    // =============================================================
    console.log('\n--- Scenario 2: Stat Cards Real Backend Aggregation ---');

    // Total Candidates
    const candidatesCount = await page.$eval('[data-testid="stat-value-candidates"]', (el) => el.textContent.trim());
    assert(candidatesCount === '2', `Stat Card Total Candidates displays 2 (actual: "${candidatesCount}")`);

    // Scheduled Interviews: read directly from interviewStats.totalScheduled
    const interviewsCount = await page.$eval('[data-testid="stat-value-interviews"]', (el) => el.textContent.trim());
    assert(interviewsCount === '2', `Stat Card Scheduled Interviews displays 2 (actual: "${interviewsCount}")`);

    const interviewsSubtext = await page.$eval('[data-testid="stat-subtext-interviews"]', (el) => el.textContent.trim());
    assert(
      interviewsSubtext.includes('1 upcoming') && interviewsSubtext.includes('1 completed'),
      `Scheduled Interviews subtext reflects "1 upcoming • 1 completed" (actual: "${interviewsSubtext}")`
    );

    // Published Assessments
    const publishedCount = await page.$eval('[data-testid="stat-value-assessments"]', (el) => el.textContent.trim());
    assert(publishedCount === '2', `Stat Card Live Assessments displays 2 (actual: "${publishedCount}")`);

    // Candidate Attempts
    const attemptsCount = await page.$eval('[data-testid="stat-value-attempts"]', (el) => el.textContent.trim());
    assert(attemptsCount === '3', `Stat Card Candidate Attempts displays 3 total attempts (actual: "${attemptsCount}")`);

    // Average Score
    const avgScoreText = await page.$eval('[data-testid="stat-value-avg-score"]', (el) => el.textContent.trim());
    assert(avgScoreText === '75%', `Stat Card Avg Test Score accurately reflects 75% (actual: "${avgScoreText}")`);

    // =============================================================
    // SCENARIO 3: Simple SVG Charts Rendering & Partitioning Validation
    // =============================================================
    console.log('\n--- Scenario 3: Simple SVG Charts Rendering & Partitioning ---');

    // Donut Chart
    await page.waitForSelector('[data-testid="donut-chart"]');
    const donutCenterValue = await page.$eval('[data-testid="donut-center-value"]', (el) => el.textContent.trim());
    assert(donutCenterValue === '4', `Donut Chart center value displays total bookings count of 4 (actual: "${donutCenterValue}")`);

    // Verify segments rendered
    const upcomingSeg = await page.$('[data-testid="donut-segment-upcoming"]');
    const completedSeg = await page.$('[data-testid="donut-segment-completed"]');
    const cancelledSeg = await page.$('[data-testid="donut-segment-cancelled"]');
    const rescheduledSeg = await page.$('[data-testid="donut-segment-rescheduled"]');
    assert(
      upcomingSeg !== null && completedSeg !== null && cancelledSeg !== null && rescheduledSeg !== null,
      `Donut chart renders SVG circle segments for upcoming, completed, cancelled, and rescheduled bookings`
    );

    // Verify Donut Legend
    const legendUpcoming = await page.$eval('[data-testid="donut-legend-upcoming"] .legend-value', (el) => el.textContent.trim());
    const legendCompleted = await page.$eval('[data-testid="donut-legend-completed"] .legend-value', (el) => el.textContent.trim());
    const legendCancelled = await page.$eval('[data-testid="donut-legend-cancelled"] .legend-value', (el) => el.textContent.trim());
    const legendRescheduled = await page.$eval('[data-testid="donut-legend-rescheduled"] .legend-value', (el) => el.textContent.trim());
    assert(
      legendUpcoming === '1' && legendCompleted === '1' && legendCancelled === '1' && legendRescheduled === '1',
      `Donut legend accurately displays 1 upcoming, 1 completed, 1 cancelled, 1 rescheduled`
    );

    // Score Gauge Ring
    await page.waitForSelector('[data-testid="gauge-ring"]');
    const gaugePct = await page.$eval('[data-testid="gauge-percentage"]', (el) => el.textContent.trim());
    assert(gaugePct === '75%', `Score Gauge Ring displays platform avg score of 75% (actual: "${gaugePct}")`);

    const gaugeScorePts = await page.$eval('[data-testid="gauge-score-value"]', (el) => el.textContent.trim());
    assert(gaugeScorePts.includes('6 pts'), `Score Gauge displays average marks of 6 pts (actual: "${gaugeScorePts}")`);

    // Progress Bar Chart
    await page.waitForSelector('[data-testid="progress-bar-chart"]');
    const progressFillCount = await page.$$eval('.progress-bar-fill', (bars) => bars.length);
    assert(progressFillCount === 2, `Progress Bar Chart renders 2 horizontal metric bars`);

    // =============================================================
    // SCENARIO 4: Recent Activity Feed, Limit Controls & Filter Guidance
    // =============================================================
    console.log('\n--- Scenario 4: Recent Activity Feed, Limit Controls & Guidance ---');

    await page.waitForSelector('[data-testid="activity-feed-list"]');
    const initialItems = await page.$$('[data-testid="activity-item"]');
    assert(initialItems.length > 0, `Recent activity feed renders items (rendered: ${initialItems.length})`);

    // Verify Disclaimer Notice is visible
    const disclaimerText = await page.$eval('[data-testid="activity-feed-disclaimer"]', (el) => el.textContent.trim());
    assert(
      disclaimerText.includes('Filtered from your most recent 10 total activity events'),
      `Activity feed displays explicit contextual disclaimer notice: "${disclaimerText}"`
    );

    // Verify items have varied activity types
    const activityTypes = await page.$$eval('[data-testid="activity-item"]', (cards) =>
      cards.map((c) => c.getAttribute('data-activity-type'))
    );
    assert(
      activityTypes.includes('candidate_registered'),
      `Activity feed includes candidate registration events`
    );
    assert(
      activityTypes.includes('interview_booking'),
      `Activity feed includes interview booking events`
    );
    assert(
      activityTypes.includes('assessment_attempt'),
      `Activity feed includes assessment attempt events`
    );

    // Test Category Filtering: Filter to Registrations
    await page.click('[data-testid="filter-registrations"]');
    const filteredRegs = await page.$$eval('[data-testid="activity-item"]', (cards) =>
      cards.map((c) => c.getAttribute('data-activity-type'))
    );
    assert(
      filteredRegs.length > 0 && filteredRegs.every((t) => t === 'candidate_registered'),
      `Registrations filter strictly displays candidate registration events (count: ${filteredRegs.length})`
    );

    // Reset Filter to All
    await page.click('[data-testid="filter-all"]');
    const resetCount = await page.$$eval('[data-testid="activity-item"]', (cards) => cards.length);
    assert(resetCount === initialItems.length, `Resetting filter to All restores full recent activity list (${resetCount})`);

    // Test Limit Selector: change limit to 5
    await page.click('[data-testid="btn-limit-5"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="activity-feed-disclaimer"]')?.textContent.includes('recent 5'),
      { timeout: 5000 }
    );
    const updatedDisclaimer = await page.$eval('[data-testid="activity-feed-disclaimer"]', (el) => el.textContent.trim());
    assert(
      updatedDisclaimer.includes('Filtered from your most recent 5 total activity events'),
      `Updating feed limit to 5 updates disclaimer context notice to "most recent 5"`
    );

    const limitedItems = await page.$$eval('[data-testid="activity-item"]', (cards) => cards.length);
    assert(limitedItems <= 5, `Activity feed respected limit clamp of 5 (displayed: ${limitedItems})`);

    // =============================================================
    // SCENARIO 5: Operational Shortcut Links
    // =============================================================
    console.log('\n--- Scenario 5: Operational Console Shortcut Links ---');

    const slotsHref = await page.$eval('[data-testid="shortcut-slots"]', (el) => el.getAttribute('href'));
    assert(slotsHref === '/admin/slots', `Shortcut Manage Interview Slots links to /admin/slots`);

    const bookingsHref = await page.$eval('[data-testid="shortcut-bookings"]', (el) => el.getAttribute('href'));
    assert(bookingsHref === '/admin/bookings', `Shortcut Candidate Bookings links to /admin/bookings`);

    const assessmentsHref = await page.$eval('[data-testid="shortcut-assessments"]', (el) => el.getAttribute('href'));
    assert(assessmentsHref === '/admin/assessments', `Shortcut Assessment Catalog links to /admin/assessments`);

    const questionsHref = await page.$eval('[data-testid="shortcut-questions"]', (el) => el.getAttribute('href'));
    assert(questionsHref === '/admin/questions', `Shortcut Question Bank links to /admin/questions`);

    const broadcastHref = await page.$eval('[data-testid="shortcut-broadcast"]', (el) => el.getAttribute('href'));
    assert(broadcastHref === '/admin/broadcast', `Shortcut System Broadcast links to /admin/broadcast`);

    console.log('\n=================================================================');
    console.log(`✓ All ${passedCount} Real Backend Admin Dashboard tests PASSED successfully!`);
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n✗ Real backend admin dashboard verification encountered an error:', err);
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

runRealBackendAdminDashboardVerification();
