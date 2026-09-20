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

// Require server modules via server's require context
const serverRequire = createRequire(path.join(serverRoot, 'package.json'));
const app = serverRequire('./app');
const mongoose = serverRequire('mongoose');
const User = serverRequire('./models/User');
const Assessment = serverRequire('./models/Assessment');
const Question = serverRequire('./models/Question');
const AssessmentAttempt = serverRequire('./models/AssessmentAttempt');
const { MongoMemoryServer } = serverRequire('mongodb-memory-server');
const jwt = serverRequire('jsonwebtoken');

// Helper to locate Chrome executable
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

async function runRealBackendAssessmentsVerification() {
  console.log('=== [CANDIDATE ASSESSMENTS REAL BACKEND INTEGRATION SUITE] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_test_jwt_secret_key_12345678901234567890';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start real MongoDB in-memory engine
  console.log('[1/5] Starting real MongoDB in-memory engine...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  console.log(`✓ Real MongoDB engine running at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log('✓ Mongoose connected to real MongoDB instance.');

  // 2. Seed Real Database Documents
  console.log('[2/5] Seeding real database documents into MongoDB...');
  const adminUser = await User.create({
    email: 'admin@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidateUser = await User.create({
    email: 'candidate@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const realCandidateToken = jwt.sign(
    { id: candidateUser._id.toString(), email: candidateUser.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Seed Assessment A: Standard 30-min Fullstack Architecture Exam
  const assessmentA = await Assessment.create({
    title: 'Fullstack Systems & Architecture Assessment',
    description: 'Comprehensive exam evaluating React reconciliation, distributed caching, and Node event loop mechanics.',
    difficulty: 'advanced',
    durationMinutes: 30,
    passingPercentage: 66,
    maxAttempts: 2,
    isPublished: true,
    createdBy: adminUser._id,
  });

  // Seed Questions for Assessment A
  const qA1 = await Question.create({
    assessmentId: assessmentA._id,
    text: 'What happens during React SSR hydration?',
    options: [
      'The browser completely re-renders the entire DOM tree from scratch.',
      'React attaches event listeners to existing server-rendered HTML markup and builds internal fiber tree.',
      'The server streams JavaScript binary code directly to the GPU.',
      'All CSS stylesheets are converted to WebAssembly.',
    ],
    correctOptionIndex: 1,
    explanation: 'Hydration attaches React internal fiber tree and listeners to server-rendered DOM nodes.',
    marks: 3,
    topic: 'React Internals',
    difficulty: 'advanced',
  });

  const qA2 = await Question.create({
    assessmentId: assessmentA._id,
    text: 'Which hook should be used to synchronize with external imperative systems in React 18?',
    options: ['useState', 'useTransition', 'useEffect', 'useMemo'],
    correctOptionIndex: 2,
    explanation: 'useEffect is designed to run side effects synchronizing with external non-React systems.',
    marks: 2,
    topic: 'React Hooks',
    difficulty: 'intermediate',
  });

  const qA3 = await Question.create({
    assessmentId: assessmentA._id,
    text: 'In Node.js event loop, which queue is executed immediately after the currently running operation completes, before the next phase?',
    options: ['check phase (setImmediate)', 'poll phase (I/O)', 'process.nextTick queue / microtask queue', 'timers phase (setTimeout)'],
    correctOptionIndex: 2,
    explanation: 'process.nextTick callbacks and microtasks drain immediately after the current operation finishes.',
    marks: 3,
    topic: 'Node.js Runtime',
    difficulty: 'advanced',
  });

  // Seed Assessment B: Short-Duration Quiz for Auto-Submit & Expiry Testing
  const assessmentB = await Assessment.create({
    title: 'Rapid JavaScript Mechanics Speedrun',
    description: 'Short evaluation of closures and prototypes for fast-paced verification.',
    difficulty: 'beginner',
    durationMinutes: 5,
    passingPercentage: 50,
    maxAttempts: 2,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const qB1 = await Question.create({
    assessmentId: assessmentB._id,
    text: 'What is the prototype of a plain object created via object literal {}?',
    options: ['null', 'Object.prototype', 'Function.prototype', 'Array.prototype'],
    correctOptionIndex: 1,
    explanation: 'Object literals inherit directly from Object.prototype.',
    marks: 2,
    topic: 'JavaScript Basics',
    difficulty: 'beginner',
  });

  console.log(`✓ Seeded Admin: ${adminUser.email}`);
  console.log(`✓ Seeded Candidate: ${candidateUser.email}`);
  console.log(`✓ Seeded Assessment A: ID=${assessmentA._id}, Questions=3, Duration=${assessmentA.durationMinutes}m`);
  console.log(`✓ Seeded Assessment B: ID=${assessmentB._id}, Questions=1, Duration=${assessmentB.durationMinutes}m\n`);

  // 3. Start Real Express Server on Port 5000
  console.log('[3/5] Starting real Express HTTP server on http://localhost:5000...');
  const expressServer = await new Promise((resolve) => {
    const s = app.listen(5000, () => resolve(s));
  });
  console.log('✓ Real Express HTTP server listening on port 5000.\n');

  // 4. Start Vite Dev Server on Port 5173
  console.log('[4/5] Starting Vite dev server on http://localhost:5173...');
  const vite = await createServer({
    root: clientRoot,
    server: { port: 5173, host: 'localhost' },
  });
  await vite.listen();
  console.log('✓ Vite dev server running on http://localhost:5173.\n');

  // 5. Run Headless Browser Interaction Suite
  console.log('[5/5] Launching headless browser to test real backend integration...');
  const chromePath = getChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

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
    // Authenticate candidate session with real JWT
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.evaluate((tok) => {
      localStorage.setItem('token', tok);
    }, realCandidateToken);

    // =============================================================
    // SCENARIO 1: CORS Date Header Exposure & Client Clock Integrity Check
    // =============================================================
    console.log('\n--- Scenario 1: CORS Date Header Exposure & Clock Integrity Check ---');
    const corsCheck = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/candidate/assessments/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dateHeader = res.headers.get('Date') || res.headers.get('date');
      const isDateValid = dateHeader ? !isNaN(new Date(dateHeader).getTime()) : false;
      return {
        hasDateHeader: Boolean(dateHeader),
        dateHeaderValue: dateHeader,
        isDateValid,
      };
    });

    assert(
      corsCheck.hasDateHeader === true,
      `Server exposes Access-Control-Expose-Headers: Date (header received: "${corsCheck.dateHeaderValue}")`
    );
    assert(
      corsCheck.isDateValid === true,
      'Exposed Date header parses to a valid UTC timestamp for authoritative timer reconciliation'
    );

    // =============================================================
    // SCENARIO 2: Assessment Catalog Discovery (/candidate/assessments)
    // =============================================================
    console.log('\n--- Scenario 2: Assessment Catalog Discovery (GET /api/assessments) ---');
    await page.goto('http://localhost:5173/candidate/assessments', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="candidate-assessments-page"]', { timeout: 5000 });

    const renderedCards = await page.$$('[data-testid^="assessment-card-"]');
    assert(renderedCards.length === 2, `Real Express server returned both published assessments (rendered ${renderedCards.length} cards)`);

    const titleA = await page.$eval(`[data-testid="title-${assessmentA._id}"]`, (el) => el.textContent.trim());
    assert(titleA === assessmentA.title, `Assessment card renders real database title: "${titleA}"`);

    const quotaA = await page.$eval(`[data-testid="quota-${assessmentA._id}"]`, (el) => el.textContent.trim());
    assert(quotaA === '0 / 2 attempts', `Candidate attempt quota accurately indicates 0 of 2 attempts used: "${quotaA}"`);

    // Difficulty filtering test
    await page.click('[data-testid="filter-difficulty-advanced"]');
    await new Promise((r) => setTimeout(r, 200));
    const filteredCards = await page.$$('[data-testid^="assessment-card-"]');
    assert(filteredCards.length === 1, `Advanced difficulty filter narrowed visible assessments to 1 (found ${filteredCards.length})`);

    await page.click('[data-testid="filter-difficulty-all"]');
    await new Promise((r) => setTimeout(r, 200));

    // =============================================================
    // SCENARIO 3: Details Modal & Atomic Attempt Start (POST /api/candidate/assessments/:id/start)
    // =============================================================
    console.log('\n--- Scenario 3: Assessment Details Modal & Start (POST /api/candidate/assessments/:id/start) ---');
    await page.click(`[data-testid="btn-start-${assessmentA._id}"]`);
    await page.waitForSelector('[data-testid="assessment-details-modal"]', { timeout: 4000 });

    const modalTitle = await page.$eval('[data-testid="modal-assessment-title"]', (el) => el.textContent.trim());
    assert(modalTitle === assessmentA.title, `Modal displays accurate test title: "${modalTitle}"`);

    // Click confirm to start attempt
    await page.click('[data-testid="btn-confirm-start-assessment"]');

    // Wait for navigation into Take Assessment arena
    await page.waitForSelector('[data-testid="take-assessment-page"]', { timeout: 6000 });
    assert(page.url().includes(`/candidate/assessments/${assessmentA._id}/take`), 'Navigated into Take Assessment arena');

    // Verify in MongoDB: AssessmentAttempt document created with status="in_progress"
    const createdAttemptInDB = await AssessmentAttempt.findOne({
      candidateId: candidateUser._id,
      assessmentId: assessmentA._id,
      status: 'in_progress',
    });
    assert(createdAttemptInDB !== null, `Verified in MongoDB: AssessmentAttempt created with ID=${createdAttemptInDB?._id}`);
    assert(createdAttemptInDB.attemptNumber === 1, `Verified in MongoDB: attemptNumber=1`);

    // =============================================================
    // SCENARIO 4: Arena Question Navigation, Options Selection & Synchronized Timer
    // =============================================================
    console.log('\n--- Scenario 4: Arena Question Navigation & Reconciled Countdown Timer ---');

    // Verify Synchronized Countdown Timer
    const timerText = await page.$eval('[data-testid="timer-digits"]', (el) => el.textContent.trim());
    assert(timerText.startsWith('29:') || timerText.startsWith('30:'), `Timer countdown starts accurately near 30m: "${timerText}"`);

    // Verify Question 1 (SSR Hydration)
    const q1Text = await page.$eval('[data-testid="question-text"]', (el) => el.textContent.trim());
    assert(q1Text.includes('SSR hydration'), `Arena renders Question 1 text: "${q1Text}"`);

    // Verify Answer Secrecy: Ensure correctOptionIndex and explanation are NOT leaked in DOM
    const arenaHtml = await page.content();
    assert(!arenaHtml.includes('Hydration attaches React internal fiber tree'), 'Explanation text is strictly absent from candidate HTML DOM (answer secrecy)');

    // Select Option B on Question 1 (optIndex 1)
    await page.click('[data-testid="option-item-1"]');
    const q1Selected = await page.$eval('[data-testid="option-item-1"]', (el) => el.classList.contains('option-selected'));
    assert(q1Selected === true, 'Question 1: Option B selected and visually highlighted');

    // Palette check for Question 1
    const p1Answered = await page.$eval('[data-testid="palette-btn-1"]', (el) => el.classList.contains('palette-answered'));
    assert(p1Answered === true, 'Question Palette immediately reflects Question 1 as Answered (green checkmark)');

    // Navigate to Question 2
    await page.click('[data-testid="btn-next-question"]');
    await new Promise((r) => setTimeout(r, 150));

    const qCounter = await page.$eval('[data-testid="question-counter"]', (el) => el.textContent.trim());
    assert(qCounter === 'Question 2 of 3', `Navigated to Question 2 of 3`);

    // Select Option C on Question 2 (optIndex 2: useEffect)
    await page.click('[data-testid="option-item-2"]');

    // Flag Question 2 for Review
    await page.click('[data-testid="btn-toggle-flag"]');
    const p2Flagged = await page.$eval('[data-testid="palette-btn-2"]', (el) => el.classList.contains('palette-flagged'));
    assert(p2Flagged === true, 'Question 2 flagged for review and reflected on Question Palette');

    // Jump back to Question 1 via Palette Button
    await page.click('[data-testid="palette-btn-1"]');
    await new Promise((r) => setTimeout(r, 150));
    const backToQ1 = await page.$eval('[data-testid="question-counter"]', (el) => el.textContent.trim());
    assert(backToQ1 === 'Question 1 of 3', 'Palette jump navigation smoothly returned to Question 1');

    // Test Clear Choice button on Question 1
    await page.click('[data-testid="btn-clear-choice"]');
    const q1Cleared = await page.$eval('[data-testid="palette-btn-1"]', (el) => el.classList.contains('palette-unanswered'));
    assert(q1Cleared === true, 'Clear Choice reset Question 1 answer state to Unanswered');

    // Re-select Option B on Question 1 for final scoring
    await page.click('[data-testid="option-item-1"]');

    // Navigate to Question 3
    await page.click('[data-testid="palette-btn-3"]');
    await new Promise((r) => setTimeout(r, 150));

    // Select Option C on Question 3 (optIndex 2: nextTick/microtasks)
    await page.click('[data-testid="option-item-2"]');

    // =============================================================
    // SCENARIO 5: Reload Resilience vs Authoritative Server-Side Expiry
    // =============================================================
    console.log('\n--- Scenario 5: Reload Resilience vs Authoritative Server-Side Expiry ---');

    // Create a new in-progress attempt specifically for testing reload-after-server-expiry
    const expiryTestAttempt = await AssessmentAttempt.create({
      candidateId: candidateUser._id,
      assessmentId: assessmentB._id,
      attemptNumber: 1,
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      expiresAt: new Date(Date.now() - 1800000), // expired 30 mins ago
      status: 'in_progress', // still marked in_progress before sweep
    });

    // Populate candidate's sessionStorage as if they were taking this attempt before reload
    await page.evaluate((attId) => {
      sessionStorage.setItem(`assessment_answers_${attId}`, JSON.stringify({ 'fake-qid': 1 }));
    }, expiryTestAttempt._id.toString());

    // Navigate directly to the arena for this expired attempt (simulating page reload/refresh)
    await page.goto(
      `http://localhost:5173/candidate/assessments/${assessmentB._id}/take?attemptId=${expiryTestAttempt._id}`,
      { waitUntil: 'networkidle0' }
    );
    await page.waitForSelector('[data-testid="arena-attempt-finalized"]', { timeout: 5000 });

    const finalizedText = await page.$eval('[data-testid="arena-attempt-finalized"]', (el) => el.textContent);
    assert(
      finalizedText.includes('Finalized') && finalizedText.includes('expired'),
      'Reloading after server-side expiry rejects stale countdown and displays authoritative Finalized/Expired screen'
    );

    // Verify in MongoDB that on-access sweep transitioned the attempt to status="expired"
    const verifiedExpiredInDB = await AssessmentAttempt.findById(expiryTestAttempt._id);
    assert(
      verifiedExpiredInDB.status === 'expired',
      `Verified in MongoDB: attempt status automatically finalized to "${verifiedExpiredInDB.status}"`
    );

    // =============================================================
    // SCENARIO 6: Manual Submission & Server-Side Scoring
    // =============================================================
    console.log('\n--- Scenario 6: Manual Submission (POST /api/candidate/attempts/:id/submit) ---');

    // Return to active Assessment A
    await page.goto(
      `http://localhost:5173/candidate/assessments/${assessmentA._id}/take?attemptId=${createdAttemptInDB._id}`,
      { waitUntil: 'networkidle0' }
    );
    await page.waitForSelector('[data-testid="take-assessment-page"]', { timeout: 5000 });

    // Click Submit Assessment in Topbar
    await page.click('[data-testid="btn-arena-submit"]');
    await page.waitForSelector('[data-testid="submit-confirmation-modal"]', { timeout: 4000 });

    // Confirm submission
    await page.click('[data-testid="btn-confirm-submit"]');
    await new Promise((r) => setTimeout(r, 800));

    // Verify MongoDB: attempt transitioned from "in_progress" to "completed"
    const completedAttemptInDB = await AssessmentAttempt.findById(createdAttemptInDB._id);
    assert(
      completedAttemptInDB.status === 'completed',
      `Verified in MongoDB: attempt status transitioned to "${completedAttemptInDB.status}"`
    );
    assert(
      completedAttemptInDB.score === 8,
      `Verified in MongoDB: server calculated score = ${completedAttemptInDB.score}/8 marks (100%)`
    );
    assert(
      completedAttemptInDB.passed === true,
      `Verified in MongoDB: passed = true (percentage: ${completedAttemptInDB.percentage}%)`
    );

    // =============================================================
    // SCENARIO 7: Auto-Submit on Timer Expiry
    // =============================================================
    console.log('\n--- Scenario 7: Auto-Submit on Timer Expiry ---');

    // Create an attempt for Assessment B with expiry set 3.5 seconds in the future
    const soonExpiringAttempt = await AssessmentAttempt.create({
      candidateId: candidateUser._id,
      assessmentId: assessmentB._id,
      attemptNumber: 2,
      startTime: new Date(),
      expiresAt: new Date(Date.now() + 3500), // expires in 3.5 seconds
      status: 'in_progress',
    });

    await page.goto(
      `http://localhost:5173/candidate/assessments/${assessmentB._id}/take?attemptId=${soonExpiringAttempt._id}`,
      { waitUntil: 'networkidle0' }
    );
    await page.waitForSelector('[data-testid="take-assessment-page"]', { timeout: 5000 });

    // Select Option B (Object.prototype) on Question B1
    await page.waitForSelector('[data-testid="option-item-1"]', { timeout: 4000 });
    await page.click('[data-testid="option-item-1"]');

    console.log('  ...waiting for countdown timer to reach 00:00 (auto-submit trigger)...');

    // Wait for auto-submit banner or finalized state
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="auto-submitting-banner"]') !== null ||
        window.location.pathname.includes('/result'),
      { timeout: 8000 }
    );

    assert(true, 'Timer countdown reached 00:00 and automatically dispatched auto-submit');

    await new Promise((r) => setTimeout(r, 1200));

    // Verify in MongoDB that the attempt was finalized
    const autoSubmittedInDB = await AssessmentAttempt.findById(soonExpiringAttempt._id);
    assert(
      autoSubmittedInDB.status === 'completed' || autoSubmittedInDB.status === 'expired',
      `Verified in MongoDB: auto-submitted attempt finalized with status="${autoSubmittedInDB.status}"`
    );

    console.log('\n=================================================================');
    console.log(`✓ All ${passedCount} Real Backend Assessment tests PASSED successfully!`);
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n✗ Real backend assessments verification encountered an error:', err);
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

runRealBackendAssessmentsVerification();
