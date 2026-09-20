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
const Notification = serverRequire('./models/Notification');
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

async function setInputValue(page, selector, value) {
  await page.waitForSelector(selector);
  await page.evaluate((sel, val) => {
    const input = document.querySelector(sel);
    if (!input) throw new Error(`Element not found: ${sel}`);
    const proto =
      input.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, val);
    } else {
      input.value = val;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, String(value));
}

async function runRealBackendAdminResultsNotificationsVerification() {
  console.log('=== [ADMIN CANDIDATE RESULTS & NOTIFICATIONS REAL BACKEND VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_results_notifications_secret_1234567890_min32';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start MongoDB in-memory engine
  console.log('[1/5] Starting real MongoDB in-memory engine...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  console.log(`✓ Real MongoDB engine running at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log('✓ Mongoose connected to real MongoDB instance.');

  // 2. Seed Real Database Documents
  console.log('[2/5] Seeding admin, candidates, profiles, and assessments...');

  const adminUser = await User.create({
    email: 'admin.director@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidateAlpha = await User.create({
    email: 'alice.walker@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  await CandidateProfile.create({
    user: candidateAlpha._id,
    fullName: 'Alice Walker',
    headline: 'Senior Cloud Systems Architect (Distributed Systems)',
    skills: ['Kafka', 'Node.js', 'Kubernetes'],
    experienceLevel: 'senior',
  });

  const candidateBeta = await User.create({
    email: 'bob.stone@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const inactiveCandidate = await User.create({
    email: 'inactive.user@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: false,
  });

  const assessmentMicroservices = await Assessment.create({
    title: 'Distributed Systems (Microservices & Event-Driven)',
    description: 'Kafka messaging, event sourcing, and saga orchestration.',
    difficulty: 'advanced',
    durationMinutes: 45,
    passingPercentage: 70,
    maxAttempts: 3,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const assessmentFrontend = await Assessment.create({
    title: 'Frontend Architecture & Performance',
    description: 'SSR Hydration and Virtual DOM performance.',
    difficulty: 'intermediate',
    durationMinutes: 30,
    passingPercentage: 60,
    maxAttempts: 2,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const candidateAlphaToken = jwt.sign(
    { id: candidateAlpha._id.toString(), email: candidateAlpha.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log('✓ Accounts, profiles, and assessments seeded successfully.');

  // 3. Start Express Backend Server on standard port 5000
  console.log('[3/5] Starting Express backend API server on port 5000...');
  const expressServer = app.listen(5000);
  await new Promise((resolve) => expressServer.on('listening', resolve));
  const apiBaseUrl = 'http://localhost:5000';
  console.log(`✓ Express server listening on ${apiBaseUrl}`);

  // 4. Start Vite Frontend Server
  console.log('[4/5] Starting Vite frontend server on port 5173...');
  const vite = await createServer({
    root: clientRoot,
    server: { port: 5173, strictPort: true },
    logLevel: 'error',
  });
  await vite.listen();
  const clientBaseUrl = 'http://localhost:5173';
  console.log(`✓ Vite frontend dev server running at ${clientBaseUrl}`);

  // 5. Launch Puppeteer Browser
  console.log('[5/5] Launching headless Chrome via Puppeteer...');
  const chromePath = getChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || text.includes('failed') || text.includes('Error')) {
      console.log('  [BROWSER CONSOLE]', msg.type(), text);
    }
  });

  const scenarioResults = [];

  const setAuthSession = async (token, userObj) => {
    await page.goto(`${clientBaseUrl}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(
      ({ t, u }) => {
        localStorage.setItem('token', t);
        localStorage.setItem('user', JSON.stringify(u));
      },
      { t: token, u: userObj }
    );
  };

  try {
    // --------------------------------------------------------------------------
    // SCENARIO 1: RBAC Guards for /admin/results and /admin/notifications
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 1: RBAC route guards: candidate redirected to /forbidden...');
    await setAuthSession(candidateAlphaToken, {
      id: candidateAlpha._id.toString(),
      email: candidateAlpha.email,
      role: 'candidate',
    });

    await page.goto(`${clientBaseUrl}/admin/results`, { waitUntil: 'networkidle0' });
    if (!page.url().includes('/forbidden')) {
      throw new Error(`Expected candidate to be redirected to /forbidden, got: ${page.url()}`);
    }

    await page.goto(`${clientBaseUrl}/admin/broadcast`, { waitUntil: 'networkidle0' });
    if (!page.url().includes('/forbidden')) {
      throw new Error(`Expected candidate to be redirected to /forbidden, got: ${page.url()}`);
    }

    console.log('  ✓ Candidate token strictly redirected to /forbidden on admin endpoints.');
    scenarioResults.push({ name: 'Scenario 1: RBAC Guards & Candidate Route Redirection', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 2: Admin lands on /admin/results with 0 initial attempts
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 2: Admin lands on /admin/results, verifies KPI cards and empty state...');
    await setAuthSession(adminToken, {
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
    });

    await page.goto(`${clientBaseUrl}/admin/results`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="admin-results-page"]');

    const initialTotalAttempts = await page.$eval('[data-testid="kpi-total-attempts"] .kpi-value', (el) => el.textContent.trim());
    if (initialTotalAttempts !== '0') {
      throw new Error(`Expected initial total attempts 0, got: ${initialTotalAttempts}`);
    }

    const emptyText = await page.$eval('.empty-state h3', (el) => el.textContent.trim());
    if (!emptyText.includes('No Candidate Results Found')) {
      throw new Error(`Expected empty state, got: ${emptyText}`);
    }

    console.log('  ✓ Admin Results landing verified with 0 initial attempts and empty state.');
    scenarioResults.push({ name: 'Scenario 2: Admin Results Landing & KPI Empty State', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 3: Seed Real Attempts & Verify Aggregation Table and KPIs
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 3: Seed real candidate attempts in MongoDB and verify live aggregation...');
    const now = new Date();

    // Attempt 1: Alice Walker, Microservices, Completed, 100%, Passed
    const attemptAlpha = await AssessmentAttempt.create({
      candidateId: candidateAlpha._id,
      assessmentId: assessmentMicroservices._id,
      attemptNumber: 1,
      startTime: new Date(now - 25 * 60 * 1000),
      endTime: now,
      expiresAt: new Date(now + 20 * 60 * 1000),
      status: 'completed',
      score: 10,
      totalMarks: 10,
      percentage: 100,
      passed: true,
      topicBreakdown: [
        { topic: 'Kafka Streaming', score: 5, totalMarks: 5, percentage: 100, correctCount: 2, totalQuestions: 2 },
        { topic: 'Saga Pattern', score: 5, totalMarks: 5, percentage: 100, correctCount: 2, totalQuestions: 2 },
      ],
      answers: [
        { questionId: new mongoose.Types.ObjectId(), topic: 'Kafka Streaming', selectedOptionIndex: 1, isCorrect: true, marksAwarded: 5 },
        { questionId: new mongoose.Types.ObjectId(), topic: 'Saga Pattern', selectedOptionIndex: 0, isCorrect: true, marksAwarded: 5 },
      ],
    });

    // Attempt 2: Bob Stone, Microservices, Completed, 40%, Failed
    const attemptBeta = await AssessmentAttempt.create({
      candidateId: candidateBeta._id,
      assessmentId: assessmentMicroservices._id,
      attemptNumber: 1,
      startTime: new Date(now - 35 * 60 * 1000),
      endTime: now,
      expiresAt: new Date(now + 10 * 60 * 1000),
      status: 'completed',
      score: 4,
      totalMarks: 10,
      percentage: 40,
      passed: false,
      topicBreakdown: [
        { topic: 'Kafka Streaming', score: 4, totalMarks: 5, percentage: 80, correctCount: 1, totalQuestions: 2 },
        { topic: 'Saga Pattern', score: 0, totalMarks: 5, percentage: 0, correctCount: 0, totalQuestions: 2 },
      ],
      answers: [
        { questionId: new mongoose.Types.ObjectId(), topic: 'Kafka Streaming', selectedOptionIndex: 1, isCorrect: true, marksAwarded: 4 },
        { questionId: new mongoose.Types.ObjectId(), topic: 'Saga Pattern', selectedOptionIndex: 2, isCorrect: false, marksAwarded: 0 },
      ],
    });

    // Attempt 3: Alice Walker, Frontend React, Expired, 0%, Failed
    const attemptExpired = await AssessmentAttempt.create({
      candidateId: candidateAlpha._id,
      assessmentId: assessmentFrontend._id,
      attemptNumber: 1,
      startTime: new Date(now - 60 * 60 * 1000),
      endTime: new Date(now - 30 * 60 * 1000),
      expiresAt: new Date(now - 30 * 60 * 1000),
      status: 'expired',
      score: 0,
      totalMarks: 10,
      percentage: 0,
      passed: false,
    });

    // Refresh page
    await page.goto(`${clientBaseUrl}/admin/results`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="results-table"]');

    // Verify KPI cards
    const kpiTotal = await page.$eval('[data-testid="kpi-total-attempts"] .kpi-value', (el) => el.textContent.trim());
    const kpiPassed = await page.$eval('[data-testid="kpi-passed-attempts"] .kpi-value', (el) => el.textContent.trim());
    const kpiPassRate = await page.$eval('[data-testid="kpi-pass-rate"] .kpi-value', (el) => el.textContent.trim());
    const kpiAvgScore = await page.$eval('[data-testid="kpi-avg-score"] .kpi-value', (el) => el.textContent.trim());

    if (kpiTotal !== '3') throw new Error(`Expected KPI total 3, got: ${kpiTotal}`);
    if (kpiPassed !== '1') throw new Error(`Expected KPI passed 1, got: ${kpiPassed}`);
    if (kpiPassRate !== '33%') throw new Error(`Expected KPI pass rate 33%, got: ${kpiPassRate}`);
    if (kpiAvgScore !== '70%') throw new Error(`Expected KPI avg score 70%, got: ${kpiAvgScore}`); // (100 + 40) / 2 = 70%

    // Verify data rows
    const rowCount = await page.$$eval('[data-testid="results-table"] tbody tr', (rows) => rows.length);
    if (rowCount !== 3) throw new Error(`Expected 3 rows in results table, got: ${rowCount}`);

    const aliceRowText = await page.$eval(`[data-testid="result-row-${attemptAlpha._id}"]`, (el) => el.textContent);
    if (!aliceRowText.includes('Alice Walker') || !aliceRowText.includes('100%') || !aliceRowText.includes('PASSED')) {
      throw new Error(`Alice's row missing expected values: ${aliceRowText}`);
    }

    console.log('  ✓ Results table rendered all 3 candidate attempts with accurate joins and KPIs.');
    scenarioResults.push({ name: 'Scenario 3: Live Aggregation, Joins & KPI Computation', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 4: Filter by Status, Result & ReDoS-Safe Search
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 4: Admin filters results by status, pass/fail, and searches candidate...');

    // 1. Filter status: completed
    await page.click('[data-testid="filter-status-completed"]');
    await new Promise((r) => setTimeout(r, 600));
    const completedRows = await page.$$eval('[data-testid="results-table"] tbody tr', (rows) => rows.length);
    if (completedRows !== 2) throw new Error(`Expected 2 completed rows, got: ${completedRows}`);

    // 2. Filter result: passed
    await page.click('[data-testid="filter-status-all"]');
    await new Promise((r) => setTimeout(r, 300));
    await page.click('[data-testid="filter-result-passed"]');
    await new Promise((r) => setTimeout(r, 600));
    const passedRows = await page.$$eval('[data-testid="results-table"] tbody tr', (rows) => rows.length);
    if (passedRows !== 1) throw new Error(`Expected 1 passed row, got: ${passedRows}`);

    // 3. Reset filters and search candidate name 'Alice Walker'
    await page.click('[data-testid="filter-result-all"]');
    await new Promise((r) => setTimeout(r, 300));
    await setInputValue(page, '#search-results-input', 'Alice Walker');
    await new Promise((r) => setTimeout(r, 600));
    const searchAliceRows = await page.$$eval('[data-testid="results-table"] tbody tr', (rows) => rows.length);
    if (searchAliceRows !== 2) throw new Error(`Expected 2 rows for Alice Walker, got: ${searchAliceRows}`);

    // 4. Search with special regex symbols '(Microservices'
    await setInputValue(page, '#search-results-input', '(Microservices');
    await new Promise((r) => setTimeout(r, 600));
    const specialCharsRows = await page.$$eval('[data-testid="results-table"] tbody tr', (rows) => rows.length);
    if (specialCharsRows !== 2) throw new Error(`Expected 2 rows for special chars search, got: ${specialCharsRows}`);

    // Clear search
    await setInputValue(page, '#search-results-input', '');
    await new Promise((r) => setTimeout(r, 600));

    console.log('  ✓ Status, outcome filtering, and ReDoS-safe search verified successfully.');
    scenarioResults.push({ name: 'Scenario 4: Search, Status & Outcome Filtering Invariants', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 5: Score Report Detail Inspection Modal
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 5: Admin inspects attempt detail score report modal...');
    await page.click(`[data-testid="view-result-btn-${attemptAlpha._id}"]`);
    await page.waitForSelector('[data-testid="result-detail-modal"]');

    const modalTitle = await page.$eval('[data-testid="result-detail-modal"] h2', (el) => el.textContent.trim());
    if (!modalTitle.includes('Distributed Systems')) {
      throw new Error(`Expected test title in modal, got: ${modalTitle}`);
    }

    const modalScore = await page.$eval('[data-testid="result-detail-modal"] .huge-percentage', (el) => el.textContent.trim());
    if (modalScore !== '100%') {
      throw new Error(`Expected 100% score in modal, got: ${modalScore}`);
    }

    const topicCardsCount = await page.$$eval('[data-testid="result-detail-modal"] .topic-card', (cards) => cards.length);
    if (topicCardsCount !== 2) {
      throw new Error(`Expected 2 topic benchmark cards, got: ${topicCardsCount}`);
    }

    // Close modal
    await page.click('[data-testid="result-detail-modal"] .modal-footer button');
    await new Promise((r) => setTimeout(r, 500));

    console.log('  ✓ Attempt score report modal inspected with topic cards and outcome summary.');
    scenarioResults.push({ name: 'Scenario 5: Score Report Detail Modal Inspection', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 6: Admin Navigates to Admin Notifications & Broadcast Center
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 6: Admin navigates to Admin Notifications & Broadcast Center...');
    await page.goto(`${clientBaseUrl}/admin/broadcast`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="admin-broadcast-page"]');

    const activeCandidatesKpi = await page.$eval('[data-testid="kpi-active-candidates"] .kpi-value', (el) => el.textContent.trim());
    if (activeCandidatesKpi !== '2') {
      throw new Error(`Expected 2 available active candidates in KPI, got: ${activeCandidatesKpi}`);
    }

    console.log('  ✓ Admin Notifications hub mounted with operational KPIs and candidate count.');
    scenarioResults.push({ name: 'Scenario 6: Admin Notifications Hub Navigation & Metrics', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 7: Targeted Notification Delivery to Candidate Alpha
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 7: Admin dispatches targeted notification to Candidate Alpha...');
    await page.click('[data-testid="open-send-notification-btn"]');
    await page.waitForSelector('[data-testid="send-notification-modal"]');

    // Select "Specific Candidate(s)" radio
    await page.click('[data-testid="target-specific-candidates-radio"]');
    await page.waitForSelector('[data-testid="candidate-picker"]');

    // Select Candidate Alpha checkbox
    await page.click(`[data-testid="candidate-checkbox-${candidateAlpha._id}"]`);

    // Select notification type reminder
    await page.select('#notification-type', 'reminder');

    // Enter message
    await setInputValue(page, '#notification-message', 'Personal interview reminder: your panel begins tomorrow at 10:00 AM UTC.');

    // Submit form
    await page.click('[data-testid="submit-notification-btn"]');
    await page.waitForSelector('[data-testid="send-success-alert"]', { timeout: 8000 });

    // Verify in MongoDB
    const targetedNotification = await Notification.findOne({
      userId: candidateAlpha._id,
      type: 'reminder',
    });
    if (!targetedNotification) throw new Error('Targeted notification not found in MongoDB for Candidate Alpha!');
    if (!targetedNotification.message.includes('Personal interview reminder')) {
      throw new Error(`Unexpected message: ${targetedNotification.message}`);
    }

    // Verify Candidate Beta did NOT receive this targeted notification
    const betaNotif = await Notification.findOne({
      userId: candidateBeta._id,
      type: 'reminder',
    });
    if (betaNotif) throw new Error('Targeted notification incorrectly leaked to Candidate Beta!');

    console.log('  ✓ Targeted notification dispatched and verified in MongoDB for Candidate Alpha exclusively.');
    scenarioResults.push({ name: 'Scenario 7: Targeted Candidate Notification Delivery', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 8: Candidate Alpha Reads Targeted Notification in Notification Center
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 8: Candidate Alpha views targeted notification in candidate portal...');
    await setAuthSession(candidateAlphaToken, {
      id: candidateAlpha._id.toString(),
      email: candidateAlpha.email,
      role: 'candidate',
    });

    await page.goto(`${clientBaseUrl}/candidate/notifications`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="notification-item"]');

    const candidateFeedText = await page.$eval('.notifications-list', (el) => el.textContent);
    if (!candidateFeedText.includes('Personal interview reminder')) {
      throw new Error(`Targeted notification missing in candidate feed: ${candidateFeedText}`);
    }

    console.log('  ✓ Candidate Alpha successfully retrieved and viewed the targeted notification.');
    scenarioResults.push({ name: 'Scenario 8: Candidate In-App Feed Notification Reception', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 9: Broadcast Notification Dispatched to All Candidates
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 9: Admin broadcasts platform announcement to all candidates...');
    await setAuthSession(adminToken, {
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
    });

    await page.goto(`${clientBaseUrl}/admin/broadcast`, { waitUntil: 'networkidle0' });
    await page.click('[data-testid="open-send-notification-btn"]');
    await page.waitForSelector('[data-testid="send-notification-modal"]');

    // Select "All Candidates" radio
    await page.click('[data-testid="target-all-candidates-radio"]');

    // Enter announcement message
    await setInputValue(page, '#notification-message', 'System Maintenance: The assessment engine will undergo upgrades on Saturday.');

    // Submit form
    await page.click('[data-testid="submit-notification-btn"]');
    await page.waitForSelector('[data-testid="send-success-alert"]', { timeout: 8000 });

    // Verify both active candidates received the broadcast in MongoDB
    const broadcastAlpha = await Notification.findOne({
      userId: candidateAlpha._id,
      message: 'System Maintenance: The assessment engine will undergo upgrades on Saturday.',
    });
    const broadcastBeta = await Notification.findOne({
      userId: candidateBeta._id,
      message: 'System Maintenance: The assessment engine will undergo upgrades on Saturday.',
    });
    const broadcastInactive = await Notification.findOne({
      userId: inactiveCandidate._id,
      message: 'System Maintenance: The assessment engine will undergo upgrades on Saturday.',
    });

    if (!broadcastAlpha) throw new Error('Broadcast missing for Candidate Alpha in MongoDB!');
    if (!broadcastBeta) throw new Error('Broadcast missing for Candidate Beta in MongoDB!');
    if (broadcastInactive) throw new Error('Broadcast was incorrectly sent to inactive candidate!');

    console.log('  ✓ Broadcast notification received by all active candidates and excluded inactive users.');
    scenarioResults.push({ name: 'Scenario 9: Canonical Broadcast to All Candidates', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 10: Strict Recipient Validation Rejection (400 Bad Request)
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 10: Verifying recipient validation strictly rejects invalid recipient IDs...');
    const fakeId = new mongoose.Types.ObjectId().toString();

    // Make direct API call as admin attempting to target admin or inactive account
    const invalidTargetRes = await fetch(`${apiBaseUrl}/api/admin/notifications/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: 'This should fail validation',
        userIds: [adminUser._id.toString(), inactiveCandidate._id.toString(), fakeId],
      }),
    });

    const invalidTargetJson = await invalidTargetRes.json();
    if (invalidTargetRes.status !== 400) {
      throw new Error(`Expected 400 rejection for invalid recipient IDs, got ${invalidTargetRes.status}`);
    }
    if (!invalidTargetJson.message.includes('No active candidate accounts found')) {
      throw new Error(`Expected specific error message, got: ${invalidTargetJson.message}`);
    }

    console.log('  ✓ Backend strictly rejected non-candidate recipient IDs with 400 Bad Request.');
    scenarioResults.push({ name: 'Scenario 10: Strict Candidate Recipient Validation Invariant', passed: true });

  } finally {
    await browser.close();
    await vite.close();
    await new Promise((resolve) => expressServer.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }

  console.log('\n======================================================');
  console.log(`VERIFICATION SUMMARY: ALL SCENARIOS PASSED (${scenarioResults.length}/${scenarioResults.length})`);
  console.log('======================================================');
  scenarioResults.forEach((s, idx) => {
    console.log(`[${idx + 1}/${scenarioResults.length}] ✓ ${s.name}`);
  });
  console.log('\n✓ ALL 10 REAL BACKEND SCENARIOS VERIFIED SUCCESSFULLY!\n');
}

runRealBackendAdminResultsNotificationsVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
