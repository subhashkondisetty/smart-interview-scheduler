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

async function runRealBackendAnalyticsVerification() {
  console.log('=== [CANDIDATE ASSESSMENT RESULTS & ANALYTICS REAL BACKEND VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_analytics_jwt_secret_key_123456789012345';
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
    email: 'admin.analytics@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidateUser = await User.create({
    email: 'candidate.analytics@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const realCandidateToken = jwt.sign(
    { id: candidateUser._id.toString(), email: candidateUser.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Seed Assessment 1: Fullstack Web Architecture (2 questions, 8 marks total)
  const assessment1 = await Assessment.create({
    title: 'Fullstack Web Architecture',
    description: 'Mastery of React hooks, component reconciliation, and Node event loop execution.',
    difficulty: 'intermediate',
    durationMinutes: 20,
    passingPercentage: 60,
    maxAttempts: 3,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const q1 = await Question.create({
    assessmentId: assessment1._id,
    text: 'Which React hook handles side effects in functional components?',
    options: ['useState', 'useEffect', 'useMemo', 'useContext'],
    correctOptionIndex: 1,
    marks: 3,
    topic: 'React Core',
    difficulty: 'intermediate',
  });

  const q2 = await Question.create({
    assessmentId: assessment1._id,
    text: 'What phase of the Node.js event loop executes timers like setTimeout?',
    options: ['Timers', 'Poll', 'Check', 'Close callbacks'],
    correctOptionIndex: 0,
    marks: 5,
    topic: 'Node.js Runtime',
    difficulty: 'intermediate',
  });

  // Seed Assessment 2: Data Structures & Algorithms (1 question, 10 marks total)
  const assessment2 = await Assessment.create({
    title: 'Data Structures & Algorithms',
    description: 'Algorithmic time complexity and data organization principles.',
    difficulty: 'advanced',
    durationMinutes: 15,
    passingPercentage: 70,
    maxAttempts: 2,
    isPublished: true,
    createdBy: adminUser._id,
  });

  const q3 = await Question.create({
    assessmentId: assessment2._id,
    text: 'What is the average time complexity of searching in a Balanced Binary Search Tree?',
    options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
    correctOptionIndex: 1,
    marks: 10,
    topic: 'Algorithms',
    difficulty: 'advanced',
  });

  // Attempt 1: Assessment 1, Completed, Passed (Score: 8/8 = 100%)
  const now = Date.now();
  const attempt1 = await AssessmentAttempt.create({
    candidateId: candidateUser._id,
    assessmentId: assessment1._id,
    attemptNumber: 1,
    startTime: new Date(now - 30 * 60 * 1000), // 30 mins ago
    endTime: new Date(now - 15 * 60 * 1000),   // 15 mins ago (duration: 15 mins)
    expiresAt: new Date(now - 10 * 60 * 1000),
    status: 'completed',
    score: 8,
    totalMarks: 8,
    percentage: 100,
    passed: true,
    topicBreakdown: [
      {
        topic: 'React Core',
        score: 3,
        totalMarks: 3,
        percentage: 100,
        correctCount: 1,
        totalQuestions: 1,
      },
      {
        topic: 'Node.js Runtime',
        score: 5,
        totalMarks: 5,
        percentage: 100,
        correctCount: 1,
        totalQuestions: 1,
      },
    ],
    answers: [
      {
        questionId: q1._id,
        topic: 'React Core',
        selectedOptionIndex: 1,
        isCorrect: true,
        marksAwarded: 3,
      },
      {
        questionId: q2._id,
        topic: 'Node.js Runtime',
        selectedOptionIndex: 0,
        isCorrect: true,
        marksAwarded: 5,
      },
    ],
  });

  // Attempt 2: Assessment 1, Completed, Failed (Score: 3/8 = 37.5%)
  const attempt2 = await AssessmentAttempt.create({
    candidateId: candidateUser._id,
    assessmentId: assessment1._id,
    attemptNumber: 2,
    startTime: new Date(now - 70 * 60 * 1000),
    endTime: new Date(now - 55 * 60 * 1000),
    expiresAt: new Date(now - 50 * 60 * 1000),
    status: 'completed',
    score: 3,
    totalMarks: 8,
    percentage: 37.5,
    passed: false,
    topicBreakdown: [
      {
        topic: 'React Core',
        score: 3,
        totalMarks: 3,
        percentage: 100,
        correctCount: 1,
        totalQuestions: 1,
      },
      {
        topic: 'Node.js Runtime',
        score: 0,
        totalMarks: 5,
        percentage: 0,
        correctCount: 0,
        totalQuestions: 1,
      },
    ],
    answers: [
      {
        questionId: q1._id,
        topic: 'React Core',
        selectedOptionIndex: 1,
        isCorrect: true,
        marksAwarded: 3,
      },
      {
        questionId: q2._id,
        topic: 'Node.js Runtime',
        selectedOptionIndex: 2, // incorrect
        isCorrect: false,
        marksAwarded: 0,
      },
    ],
  });

  // Attempt 3: Assessment 2, Expired, Failed (Score: 0/10 = 0%)
  const attempt3 = await AssessmentAttempt.create({
    candidateId: candidateUser._id,
    assessmentId: assessment2._id,
    attemptNumber: 1,
    startTime: new Date(now - 120 * 60 * 1000),
    endTime: new Date(now - 105 * 60 * 1000),
    expiresAt: new Date(now - 105 * 60 * 1000),
    status: 'expired',
    score: 0,
    totalMarks: 10,
    percentage: 0,
    passed: false,
    topicBreakdown: [
      {
        topic: 'Algorithms',
        score: 0,
        totalMarks: 10,
        percentage: 0,
        correctCount: 0,
        totalQuestions: 1,
      },
    ],
    answers: [
      {
        questionId: q3._id,
        topic: 'Algorithms',
        selectedOptionIndex: null, // unanswered
        isCorrect: false,
        marksAwarded: 0,
      },
    ],
  });

  console.log(`✓ Seeded Admin User: ${adminUser.email}`);
  console.log(`✓ Seeded Candidate User: ${candidateUser.email}`);
  console.log(`✓ Seeded Assessment 1 (${assessment1.title}) & Assessment 2 (${assessment2.title})`);
  console.log(`✓ Seeded Attempt 1: Completed, Passed, 100%`);
  console.log(`✓ Seeded Attempt 2: Completed, Failed, 37.5%`);
  console.log(`✓ Seeded Attempt 3: Expired, Failed, 0%\n`);

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
    // SCENARIO 1: Passed Attempt Result Page (/candidate/attempts/:id/result)
    // =============================================================
    console.log('\n--- Scenario 1: Passed Attempt Result Page (/candidate/attempts/:id/result) ---');
    await page.goto(`http://localhost:5173/candidate/attempts/${attempt1._id}/result`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('[data-testid="result-container"]', { timeout: 8000 });
    assert(true, 'Result page mounted successfully for completed passed attempt');

    const statusBadgeText = await page.$eval(
      '[data-testid="result-status-badge"]',
      (el) => el.textContent.trim()
    );
    assert(
      statusBadgeText.includes('Assessment Passed'),
      `Hero status badge displays "Assessment Passed" (actual: "${statusBadgeText}")`
    );

    const scorePct = await page.$eval(
      '[data-testid="result-percentage"]',
      (el) => el.textContent.trim()
    );
    assert(scorePct === '100%', `Percentage display matches real backend calculation: "${scorePct}"`);

    const scoreMarks = await page.$eval(
      '[data-testid="result-score"]',
      (el) => el.textContent.replace(/\s+/g, ' ').trim()
    );
    assert(scoreMarks.includes('8 / 8'), `Marks score matches real backend: "${scoreMarks}"`);

    const correctCount = await page.$eval(
      '[data-testid="metric-correct-count"]',
      (el) => el.textContent.trim()
    );
    assert(correctCount.includes('2 / 2'), `Correct answers metric correctly shows 2 / 2: "${correctCount}"`);

    const topicCardsCount = await page.$$eval(
      '[data-testid="topic-breakdown-card"]',
      (els) => els.length
    );
    assert(topicCardsCount === 2, `Rendered ${topicCardsCount} topic breakdown cards for Attempt 1`);

    const questionOutcomeRows = await page.$$eval(
      '[data-testid="question-outcome-row"]',
      (els) => els.length
    );
    assert(questionOutcomeRows === 2, `Rendered ${questionOutcomeRows} question outcome rows`);

    // =============================================================
    // SCENARIO 2: Expired Attempt Result Page (/candidate/attempts/:id/result)
    // =============================================================
    console.log('\n--- Scenario 2: Expired Attempt Result Page (/candidate/attempts/:id/result) ---');
    await page.goto(`http://localhost:5173/candidate/attempts/${attempt3._id}/result`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('[data-testid="result-container"]', { timeout: 8000 });
    const expiredBadgeText = await page.$eval(
      '[data-testid="result-status-badge"]',
      (el) => el.textContent.trim()
    );
    assert(
      expiredBadgeText.includes('Attempt Expired'),
      `Expired attempt surfaces "Attempt Expired" badge (actual: "${expiredBadgeText}")`
    );

    const expiredPct = await page.$eval(
      '[data-testid="result-percentage"]',
      (el) => el.textContent.trim()
    );
    assert(expiredPct === '0%', `Expired attempt shows 0% score: "${expiredPct}"`);

    const unansweredCount = await page.$eval(
      '[data-testid="metric-unanswered-count"]',
      (el) => el.textContent.trim()
    );
    assert(unansweredCount === '1', `Unanswered metric accurately shows 1 question unanswered: "${unansweredCount}"`);

    // =============================================================
    // SCENARIO 3: Candidate History Page & Summary KPIs
    // =============================================================
    console.log('\n--- Scenario 3: Candidate History Page & Summary KPIs ---');
    await page.goto('http://localhost:5173/candidate/history', { waitUntil: 'networkidle0' });

    await page.waitForSelector('[data-testid="history-page"]', { timeout: 8000 });
    assert(true, 'Candidate History Page mounted successfully');

    const totalAttemptsKpi = await page.$eval(
      '[data-testid="kpi-total-attempts"]',
      (el) => el.textContent.trim()
    );
    assert(totalAttemptsKpi === '3', `Total attempts KPI matches real database count (actual: "${totalAttemptsKpi}")`);

    const passRateKpi = await page.$eval(
      '[data-testid="kpi-pass-rate"]',
      (el) => el.textContent.trim()
    );
    assert(passRateKpi === '33%', `Pass rate KPI accurately computed as 33% (1 of 3): "${passRateKpi}"`);

    const avgScoreKpi = await page.$eval(
      '[data-testid="kpi-avg-score"]',
      (el) => el.textContent.trim()
    );
    assert(
      avgScoreKpi === '69%',
      `Average score KPI accurately computed across completed attempts as 69% ((100+37.5)/2 = 68.75% -> 69%): "${avgScoreKpi}"`
    );

    const attemptCards = await page.$$('[data-testid="history-attempt-card"]');
    assert(attemptCards.length === 3, `History list renders all 3 candidate attempts (found: ${attemptCards.length})`);

    // =============================================================
    // SCENARIO 4: Attempt History Status Filtering
    // =============================================================
    console.log('\n--- Scenario 4: Attempt History Status Filtering ---');
    // Filter Completed
    await page.click('[data-testid="filter-completed"]');
    await new Promise((r) => setTimeout(r, 200));
    let filteredCount = await page.$$eval('[data-testid="history-attempt-card"]', (els) => els.length);
    assert(filteredCount === 2, `Completed filter shows exactly 2 completed attempts (found: ${filteredCount})`);

    // Filter Expired
    await page.click('[data-testid="filter-expired"]');
    await new Promise((r) => setTimeout(r, 200));
    filteredCount = await page.$$eval('[data-testid="history-attempt-card"]', (els) => els.length);
    assert(filteredCount === 1, `Expired filter shows exactly 1 expired attempt (found: ${filteredCount})`);

    // Filter Passed
    await page.click('[data-testid="filter-passed"]');
    await new Promise((r) => setTimeout(r, 200));
    filteredCount = await page.$$eval('[data-testid="history-attempt-card"]', (els) => els.length);
    assert(filteredCount === 1, `Passed filter shows exactly 1 passed attempt (found: ${filteredCount})`);

    // Filter Failed
    await page.click('[data-testid="filter-failed"]');
    await new Promise((r) => setTimeout(r, 200));
    filteredCount = await page.$$eval('[data-testid="history-attempt-card"]', (els) => els.length);
    assert(filteredCount === 2, `Failed filter shows exactly 2 failed attempts (found: ${filteredCount})`);

    // Reset to All
    await page.click('[data-testid="filter-all"]');
    await new Promise((r) => setTimeout(r, 200));
    filteredCount = await page.$$eval('[data-testid="history-attempt-card"]', (els) => els.length);
    assert(filteredCount === 3, `Reset filter shows all 3 attempts (found: ${filteredCount})`);

    // =============================================================
    // SCENARIO 5: Topic Performance View & Decision #15 Verification
    // =============================================================
    console.log('\n--- Scenario 5: Topic Performance View & Decision #15 Verification ---');
    await page.click('[data-testid="tab-topics"]');
    await page.waitForSelector('[data-testid="topic-performance-card"]', { timeout: 5000 });

    const topicCards = await page.$$('[data-testid="topic-performance-card"]');
    assert(
      topicCards.length === 2,
      `Topic Performance view displays exactly 2 topics (found: ${topicCards.length})`
    );

    const renderedTopicNames = await page.$$eval('[data-testid="topic-name"]', (els) =>
      els.map((e) => e.textContent.trim())
    );
    assert(
      renderedTopicNames.includes('React Core') && renderedTopicNames.includes('Node.js Runtime'),
      `Completed topics present: ${JSON.stringify(renderedTopicNames)}`
    );

    // Architectural Decision #15 verification: Expired Attempt 3 ('Algorithms') MUST NOT appear in topic aggregation
    assert(
      !renderedTopicNames.includes('Algorithms'),
      'Architectural Decision #15 Verified: Expired attempt topic ("Algorithms") is strictly EXCLUDED from topic performance analytics'
    );

    const reactAccuracy = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="topic-performance-card"]'));
      const reactCard = cards.find((c) => c.querySelector('[data-testid="topic-name"]')?.textContent.includes('React Core'));
      return reactCard?.querySelector('[data-testid="topic-accuracy"]')?.textContent.trim();
    });
    assert(reactAccuracy === '100%', `React Core accuracy is 100% across completed attempts (actual: "${reactAccuracy}")`);

    const nodeAccuracy = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="topic-performance-card"]'));
      const nodeCard = cards.find((c) => c.querySelector('[data-testid="topic-name"]')?.textContent.includes('Node.js Runtime'));
      return nodeCard?.querySelector('[data-testid="topic-accuracy"]')?.textContent.trim();
    });
    assert(nodeAccuracy === '50%', `Node.js Runtime accuracy is 50% across completed attempts (actual: "${nodeAccuracy}")`);

    // =============================================================
    // SCENARIO 6: Cross-Navigation from History to Score Report
    // =============================================================
    console.log('\n--- Scenario 6: Cross-Navigation from History to Score Report ---');
    await page.click('[data-testid="tab-history"]');
    await page.waitForSelector(`[data-testid="btn-view-result-${attempt1._id}"]`, { timeout: 5000 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click(`[data-testid="btn-view-result-${attempt1._id}"]`),
    ]);

    const finalUrl = page.url();
    assert(
      finalUrl.includes(`/candidate/attempts/${attempt1._id}/result`),
      `Navigated successfully to attempt 1 result page (actual URL: ${finalUrl})`
    );

    await page.waitForSelector('[data-testid="result-percentage"]');
    const navigatedPct = await page.$eval(
      '[data-testid="result-percentage"]',
      (el) => el.textContent.trim()
    );
    assert(
      navigatedPct === '100%',
      `Successfully loaded score report from history navigation link (percentage: "${navigatedPct}")`
    );

    console.log('\n=================================================================');
    console.log(`✓ All ${passedCount} Real Backend Analytics tests PASSED successfully!`);
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n✗ Real backend analytics verification encountered an error:', err);
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

runRealBackendAnalyticsVerification();
