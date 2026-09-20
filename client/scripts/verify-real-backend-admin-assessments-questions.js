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

async function runRealBackendAdminAssessmentsQuestionsVerification() {
  console.log('=== [ADMIN ASSESSMENTS & QUESTIONS REAL BACKEND VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_admin_assessments_questions_secret_1234567890_min32';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start MongoDB in-memory engine
  console.log('[1/5] Starting real MongoDB in-memory engine...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  console.log(`✓ Real MongoDB engine running at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log('✓ Mongoose connected to real MongoDB instance.');

  // 2. Seed Real Database Documents
  console.log('[2/5] Seeding admin and candidate user accounts...');

  const adminUser = await User.create({
    email: 'admin.eval@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidate = await User.create({
    email: 'candidate.eval@smartprep.com',
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
    { id: candidate._id.toString(), email: candidate.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log('✓ Admin and candidate test accounts seeded.');

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
  page.on('pageerror', (err) => console.log('  [BROWSER PAGEERROR]', err.message));
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`  [HTTP ${res.status()}] ${res.url()}`);
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
    // SCENARIO 1: Admin Assessments Page Navigation, KPI Cards & Table
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 1: Admin views /admin/assessments and verifies KPI cards and table...');
    await setAuthSession(adminToken, { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' });

    await page.goto(`${clientBaseUrl}/admin/assessments`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="create-assessment-btn"]');

    const totalKpi = await page.$eval('[data-testid="kpi-total-assessments"] .kpi-value', (el) => el.textContent.trim());
    if (totalKpi !== '0') {
      throw new Error(`Expected initial 0 assessments, got: ${totalKpi}`);
    }

    console.log('  ✓ Admin assessments management view rendered with 0 initial assessments.');
    scenarioResults.push({ name: 'Scenario 1: Admin Assessments Management Landing & KPI Cards', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 2: Create New Assessment via UI Modal
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 2: Admin creates new assessment via Create Modal with all fields...');
    await page.click('[data-testid="create-assessment-btn"]');
    await page.waitForSelector('[data-testid="create-assessment-modal"]');

    await page.type('#create-title', 'Microservices & Event Architecture');
    await page.type('#create-description', 'Kafka streaming, saga pattern, and eventual consistency.');
    await page.select('#create-difficulty', 'advanced');

    await setInputValue(page, '#create-duration', '40');
    await setInputValue(page, '#create-passing', '70');
    await setInputValue(page, '#create-max-attempts', '2');

    // Submit form (initially draft)
    await page.click('[data-testid="create-assessment-modal"] button[type="submit"]');
    await page.waitForSelector('[data-testid="assessments-table"]', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    // Verify in MongoDB
    const createdAssessment = await Assessment.findOne({ title: 'Microservices & Event Architecture' });
    if (!createdAssessment) throw new Error('Created assessment not found in MongoDB!');
    if (createdAssessment.difficulty !== 'advanced') throw new Error(`Expected advanced difficulty, got ${createdAssessment.difficulty}`);
    if (createdAssessment.durationMinutes !== 40) throw new Error(`Expected 40 min duration, got ${createdAssessment.durationMinutes}`);
    if (createdAssessment.passingPercentage !== 70) throw new Error(`Expected 70% pass, got ${createdAssessment.passingPercentage}`);
    if (createdAssessment.isPublished !== false) throw new Error('Expected initial draft status');

    console.log('  ✓ Assessment created via UI modal and verified in MongoDB with all properties.');
    scenarioResults.push({ name: 'Scenario 2: Create Assessment via Modal & Database Persistence', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 3: Edit Assessment Details via UI Modal
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 3: Admin edits assessment passing score and title via Edit Modal...');
    await page.click(`[data-testid="edit-assessment-btn-${createdAssessment._id}"]`);
    await page.waitForSelector('[data-testid="edit-assessment-modal"]');

    // Change title
    await setInputValue(page, '#edit-title', 'Microservices & Distributed Saga Architecture');

    // Change passing score to 75%
    await setInputValue(page, '#edit-passing', '75');

    // Save
    await page.click('[data-testid="edit-assessment-modal"] button[type="submit"]');
    await new Promise((r) => setTimeout(r, 600));

    // Verify in MongoDB
    const updatedInDb = await Assessment.findById(createdAssessment._id);
    if (updatedInDb.title !== 'Microservices & Distributed Saga Architecture') {
      throw new Error(`Updated title was not persisted in MongoDB! Got: ${updatedInDb.title}`);
    }
    if (updatedInDb.passingPercentage !== 75) {
      throw new Error(`Updated passing percentage was not persisted! Got: ${updatedInDb.passingPercentage}`);
    }

    console.log('  ✓ Assessment details updated via Edit Modal and confirmed in MongoDB.');
    scenarioResults.push({ name: 'Scenario 3: Edit Assessment Details & Real Database Update', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 4: Toggle Publish / Unpublish Status
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 4: Admin toggles publish status (Draft -> Published -> Draft)...');
    // Click toggle to publish
    await page.click(`[data-testid="toggle-publish-btn-${createdAssessment._id}"]`);
    await new Promise((r) => setTimeout(r, 600));

    let publishedInDb = await Assessment.findById(createdAssessment._id);
    if (publishedInDb.isPublished !== true) {
      throw new Error('Assessment failed to publish in MongoDB!');
    }

    // Click toggle to unpublish back to draft
    await page.click(`[data-testid="toggle-publish-btn-${createdAssessment._id}"]`);
    await new Promise((r) => setTimeout(r, 600));

    let unpublishedInDb = await Assessment.findById(createdAssessment._id);
    if (unpublishedInDb.isPublished !== false) {
      throw new Error('Assessment failed to unpublish in MongoDB!');
    }

    // Set it to published for subsequent testing
    await Assessment.findByIdAndUpdate(createdAssessment._id, { isPublished: true });
    console.log('  ✓ Publish / unpublish toggling verified end-to-end.');
    scenarioResults.push({ name: 'Scenario 4: Publish & Unpublish Toggle Lifecycle', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 5: Navigate to Question Studio for Assessment
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 5: Admin navigates to Question Management Studio for this assessment...');
    await page.goto(`${clientBaseUrl}/admin/assessments/${createdAssessment._id}/questions`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="add-question-btn"]');

    const selectVal = await page.$eval('[data-testid="assessment-switcher-select"]', (el) => el.value);
    if (selectVal !== createdAssessment._id.toString()) {
      throw new Error(`Expected switcher to focus on ${createdAssessment._id}, got: ${selectVal}`);
    }

    console.log('  ✓ Question Studio rendered focused on the selected assessment.');
    scenarioResults.push({ name: 'Scenario 5: Question Studio Navigation & Assessment Focus', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 6: Create Question with Radio Correct Answer Selector
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 6: Admin creates question with options, radio correct answer selector, and explanation...');
    await page.click('[data-testid="add-question-btn"]');
    await page.waitForSelector('[data-testid="question-form-modal"]');

    await page.type('#question-text', 'In a saga orchestration pattern, what is the role of the central orchestrator?');
    await page.type('#question-topic', 'Microservices');
    await page.select('#question-difficulty', 'advanced');

    // Set marks to 5
    await setInputValue(page, '#question-marks', '5');

    // Fill options
    await page.type('#option-input-0', 'Execute database transactions on a single monolithic node');
    await page.type('#option-input-1', 'Coordinate transactions and execute compensating actions upon failure');
    await page.type('#option-input-2', 'Compile high-level code to native assembly');
    await page.type('#option-input-3', 'Serve static HTML assets directly from edge CDN');

    // Select Option B (index 1) as the correct answer via radio button
    await page.click('[data-testid="radio-correct-option-1"]');

    // Fill explanation
    await page.type(
      '#question-explanation',
      'The orchestrator sends commands to participants and triggers compensating transactions if any step fails.'
    );

    // Submit question
    await page.click('[data-testid="question-form-modal"] button[type="submit"]');
    await page.waitForSelector('[data-testid="questions-list"]', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    // Verify in MongoDB
    const createdQuestion = await Question.findOne({ assessmentId: createdAssessment._id });
    if (!createdQuestion) throw new Error('Question not found in MongoDB!');
    if (createdQuestion.correctOptionIndex !== 1) {
      throw new Error(`Expected correctOptionIndex 1 (Option B), got: ${createdQuestion.correctOptionIndex}`);
    }
    if (createdQuestion.marks !== 5) throw new Error(`Expected 5 marks, got: ${createdQuestion.marks}`);
    if (!createdQuestion.explanation.includes('orchestrator')) {
      throw new Error(`Explanation missing in MongoDB: ${createdQuestion.explanation}`);
    }

    // Verify correct answer tag in UI
    const correctAnswerBadge = await page.$('[data-testid="correct-answer-badge"]');
    if (!correctAnswerBadge) throw new Error('Correct answer badge not rendered in Question Card!');

    console.log('  ✓ Question created with radio selector and answer key verified in MongoDB & UI.');
    scenarioResults.push({ name: 'Scenario 6: Create Question with Radio Correct-Answer Input & Badges', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 7: Edit Question and Designated Correct Answer Key
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 7: Admin edits question to change correct answer option and explanation...');
    await page.click(`[data-testid="edit-question-btn-${createdQuestion._id}"]`);
    await page.waitForSelector('[data-testid="question-form-modal"]');

    // Change correct answer to Option A (index 0)
    await page.click('[data-testid="radio-correct-option-0"]');

    // Update prompt
    await page.type('#question-text', ' [Updated]');

    // Save
    await page.click('[data-testid="question-form-modal"] button[type="submit"]');
    await new Promise((r) => setTimeout(r, 600));

    const updatedQuestionInDb = await Question.findById(createdQuestion._id);
    if (updatedQuestionInDb.correctOptionIndex !== 0) {
      throw new Error(`Expected updated correctOptionIndex 0, got: ${updatedQuestionInDb.correctOptionIndex}`);
    }

    // Set back to 1 for scoring test
    await Question.findByIdAndUpdate(createdQuestion._id, { correctOptionIndex: 1 });

    console.log('  ✓ Question updated successfully with new answer key saved in MongoDB.');
    scenarioResults.push({ name: 'Scenario 7: Edit Question & Answer Key Modification', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 8: Mid-Attempt Unpublish Immunity (Candidate completes attempt)
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 8: Candidate starts attempt while published, admin unpublishes mid-attempt, candidate submits and scores normally...');
    // Ensure assessment is published
    await Assessment.findByIdAndUpdate(createdAssessment._id, { isPublished: true });

    // Candidate starts attempt
    const startAttemptRes = await fetch(`${apiBaseUrl}/api/candidate/assessments/${createdAssessment._id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateToken}`,
      },
    });
    const startAttemptJson = await startAttemptRes.json();
    if (startAttemptRes.status !== 201) {
      throw new Error(`Candidate failed to start attempt: ${JSON.stringify(startAttemptJson)}`);
    }
    const attemptId = startAttemptJson.data.attempt._id;

    // Admin unpublishes the assessment mid-attempt
    await fetch(`${apiBaseUrl}/api/admin/assessments/${createdAssessment._id}/publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isPublished: false }),
    });

    const assessMidAttempt = await Assessment.findById(createdAssessment._id);
    if (assessMidAttempt.isPublished !== false) {
      throw new Error('Assessment was not unpublished mid-attempt!');
    }

    // Candidate submits attempt with correct answer (Option 1)
    const submitAttemptRes = await fetch(`${apiBaseUrl}/api/candidate/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateToken}`,
      },
      body: JSON.stringify({
        answers: [
          {
            questionId: createdQuestion._id.toString(),
            selectedOptionIndex: 1, // Correct answer
          },
        ],
      }),
    });
    const submitAttemptJson = await submitAttemptRes.json();
    if (submitAttemptRes.status !== 200 || !submitAttemptJson.success) {
      throw new Error(`Submission failed mid-attempt unpublish: ${JSON.stringify(submitAttemptJson)}`);
    }

    if (submitAttemptJson.data.attempt.status !== 'completed' || submitAttemptJson.data.attempt.score !== 5) {
      throw new Error(`Expected score 5 and status completed, got: ${JSON.stringify(submitAttemptJson.data.attempt)}`);
    }

    console.log('  ✓ Candidate completed and scored attempt normally after mid-attempt unpublish.');
    scenarioResults.push({ name: 'Scenario 8: Mid-Attempt Unpublish Immunity & Scoring Lifecycle', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 9: Attempt-Aware Deletion Guard Blocks Delete (400 Bad Request)
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 9: Verifying deletion is strictly blocked when candidate attempts exist...');
    // Try to delete via API
    const blockedDeleteRes = await fetch(`${apiBaseUrl}/api/admin/assessments/${createdAssessment._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const blockedDeleteJson = await blockedDeleteRes.json();
    if (blockedDeleteRes.status !== 400 || !blockedDeleteJson.message.includes('existing candidate attempts')) {
      throw new Error(`Expected 400 rejection for assessment with attempts, got: ${blockedDeleteRes.status} ${JSON.stringify(blockedDeleteJson)}`);
    }

    // Also check UI modal on assessments page
    await page.goto(`${clientBaseUrl}/admin/assessments`, { waitUntil: 'networkidle0' });
    await page.waitForSelector(`[data-testid="delete-assessment-btn-${createdAssessment._id}"]`);
    await page.click(`[data-testid="delete-assessment-btn-${createdAssessment._id}"]`);
    await page.waitForSelector('[data-testid="delete-assessment-modal"]');

    const unpublishInsteadBtn = await page.$('[data-testid="modal-unpublish-btn"]');
    if (!unpublishInsteadBtn) {
      throw new Error('Expected modal to display "Unpublish Instead" button when attempts exist!');
    }
    await page.click('[data-testid="delete-assessment-modal"] .btn-secondary'); // Close modal

    console.log('  ✓ Deletion guarded with 400 error; UI advises unpublishing to preserve candidate history.');
    scenarioResults.push({ name: 'Scenario 9: Attempt-Aware Assessment Deletion Block (400) & UI Guidance', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 10: Security Zero-Leakage: Candidate Endpoint Strips Answer Keys
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 10: Security validation: candidate question discovery endpoint strictly hides answer keys...');
    // Publish temporarily for discovery
    await Assessment.findByIdAndUpdate(createdAssessment._id, { isPublished: true });

    const candidateDiscoveryRes = await fetch(`${apiBaseUrl}/api/assessments/${createdAssessment._id}/questions`);
    const candidateDiscoveryJson = await candidateDiscoveryRes.json();
    if (candidateDiscoveryRes.status !== 200) {
      throw new Error(`Candidate question discovery failed: ${JSON.stringify(candidateDiscoveryJson)}`);
    }

    const candidateQuestion = candidateDiscoveryJson.data.questions[0];
    if (candidateQuestion.correctOptionIndex !== undefined) {
      throw new Error('SECURITY VIOLATION: correctOptionIndex was leaked to candidate!');
    }
    if (candidateQuestion.explanation !== undefined) {
      throw new Error('SECURITY VIOLATION: explanation was leaked to candidate!');
    }

    console.log('  ✓ Security verified: candidate endpoints strictly never leak correctOptionIndex or explanation.');
    scenarioResults.push({ name: 'Scenario 10: Candidate Discovery Zero-Leakage Answer Key Protection', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 11: Zero-Attempt Assessment Deletion & Question Cascade
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 11: Zero-attempt assessment deletion and cascade question cleanup...');
    // Create new assessment with 0 attempts and 1 question
    const throwawayAssessment = await Assessment.create({
      title: 'Throwaway Clean Assessment',
      durationMinutes: 15,
      passingPercentage: 60,
      maxAttempts: 1,
      createdBy: adminUser._id,
    });

    const throwawayQuestion = await Question.create({
      assessmentId: throwawayAssessment._id,
      text: 'Throwaway Question?',
      options: ['Option 1', 'Option 2'],
      correctOptionIndex: 0,
      marks: 1,
      topic: 'Throwaway',
    });

    // Delete zero-attempt assessment
    const cleanDeleteRes = await fetch(`${apiBaseUrl}/api/admin/assessments/${throwawayAssessment._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const cleanDeleteJson = await cleanDeleteRes.json();
    if (cleanDeleteRes.status !== 200 || !cleanDeleteJson.message.includes('deleted successfully')) {
      throw new Error(`Failed to delete zero-attempt assessment: ${JSON.stringify(cleanDeleteJson)}`);
    }

    // Verify both assessment and its question were deleted from MongoDB
    const checkAssess = await Assessment.findById(throwawayAssessment._id);
    if (checkAssess !== null) throw new Error('Assessment was not deleted from MongoDB!');

    const checkQuestion = await Question.findById(throwawayQuestion._id);
    if (checkQuestion !== null) throw new Error('Associated question was not cascade-deleted from MongoDB!');

    console.log('  ✓ Zero-attempt assessment deleted and associated questions cascade-removed successfully.');
    scenarioResults.push({ name: 'Scenario 11: Zero-Attempt Deletion & Question Cascade Cleanup', passed: true });

    // Summary
    console.log('\n======================================================');
    console.log('VERIFICATION SUMMARY: ALL SCENARIOS PASSED (11/11)');
    console.log('======================================================');
    scenarioResults.forEach((s, idx) => {
      console.log(`[${idx + 1}/11] ✓ ${s.name}`);
    });
    console.log('\n✓ ALL 11 REAL BACKEND SCENARIOS VERIFIED SUCCESSFULLY!');
  } finally {
    await browser.close();
    await vite.close();
    await expressServer.close();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

runRealBackendAdminAssessmentsQuestionsVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
