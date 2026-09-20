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
const InterviewSlot = serverRequire('./models/InterviewSlot');
const InterviewBooking = serverRequire('./models/InterviewBooking');
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

async function runRealBackendVerification() {
  console.log('=== [CANDIDATE INTERVIEW REAL BACKEND INTEGRATION SUITE] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_test_jwt_secret_key_12345678901234567890';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start real MongoDB in-memory daemon
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

  const tomorrow = new Date(Date.now() + 86400000);
  const inTwoDays = new Date(Date.now() + 172800000);

  // Slot A: Non-empty description and working meetingLink
  const realDescriptionA =
    'Comprehensive discussion on distributed cache invalidation, event-driven microservices, and React SSR hydration patterns.';
  const realMeetingLinkA = 'https://meet.jit.si/smartprep-real-backend-room-alpha';

  const slotA = await InterviewSlot.create({
    title: 'Fullstack System Architecture Mock',
    description: realDescriptionA,
    meetingLink: realMeetingLinkA,
    interviewerName: 'Marcus Vance',
    startTime: tomorrow,
    endTime: new Date(tomorrow.getTime() + 60 * 60000),
    durationMinutes: 60,
    capacity: 2,
    bookedCount: 1,
    status: 'available',
    createdBy: adminUser._id,
  });

  // Slot B: EMPTY description and EMPTY meetingLink (schema defaults) to test sensible fallbacks
  const slotB = await InterviewSlot.create({
    title: 'Algorithms & Data Structures Speed Run',
    description: '', // Schema default
    meetingLink: '', // Schema default
    interviewerName: 'Elena Rostova',
    startTime: inTwoDays,
    endTime: new Date(inTwoDays.getTime() + 45 * 60000),
    durationMinutes: 45,
    capacity: 2,
    bookedCount: 1,
    status: 'available',
    createdBy: adminUser._id,
  });

  // Booking A: for Slot A (with non-empty description & meetingLink)
  const bookingA = await InterviewBooking.create({
    candidate: candidateUser._id,
    slot: slotA._id,
    status: 'confirmed',
    notes: 'Focus on Redis cache stampede and React hydration.',
  });

  // Booking B: for Slot B (with empty description & meetingLink)
  const bookingB = await InterviewBooking.create({
    candidate: candidateUser._id,
    slot: slotB._id,
    status: 'confirmed',
    notes: 'Graph algorithms practice.',
  });

  console.log(`✓ Seeded Admin: ${adminUser.email}`);
  console.log(`✓ Seeded Candidate: ${candidateUser.email}`);
  console.log(`✓ Seeded Slot A (populated): ID=${slotA._id}`);
  console.log(`✓ Seeded Slot B (schema defaults): ID=${slotB._id}`);
  console.log(`✓ Seeded Booking A: ID=${bookingA._id}`);
  console.log(`✓ Seeded Booking B: ID=${bookingB._id}\n`);

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

  const context = browser.defaultBrowserContext();
  try {
    await context.overridePermissions('http://localhost:5173', ['clipboard-read', 'clipboard-write']);
  } catch (_) {}

  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

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
    // SCENARIO 1: Available Slots Page with Real Data & Fallbacks
    // =============================================================
    console.log('\n--- Scenario 1: Available Slots Page (GET /api/interview-slots via Real Express/Mongoose) ---');
    await page.goto('http://localhost:5173/candidate/slots', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="available-slots-page"]', { timeout: 5000 });

    const renderedSlots = await page.$$('[data-testid^="slot-card-"]');
    assert(renderedSlots.length === 2, `Real Express server returned both active MongoDB slots (found ${renderedSlots.length})`);

    // Slot A: Verify actual MongoDB description text
    const descA = await page.$eval(`[data-testid="slot-description-${slotA._id}"]`, (el) => el.textContent.trim());
    assert(
      descA === realDescriptionA,
      `Slot A accurately displays real MongoDB description: "${descA.slice(0, 50)}..."`
    );

    // Slot B: Verify sensible fallback when description is schema default empty string
    const descB = await page.$eval(`[data-testid="slot-description-${slotB._id}"]`, (el) => el.textContent.trim());
    assert(
      descB === 'No description provided',
      `Slot B with schema default empty string renders sensible fallback: "${descB}"`
    );

    // =============================================================
    // SCENARIO 2: Interview Details with Real Data & Working Meeting Link
    // =============================================================
    console.log('\n--- Scenario 2: Interview Details Page with Populated Fields (Booking A) ---');
    await page.goto(`http://localhost:5173/candidate/bookings/${bookingA._id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="interview-details-page"]', { timeout: 5000 });

    // Verify Real Description
    const detailsDescA = await page.$eval('[data-testid="details-description"]', (el) => el.textContent.trim());
    assert(
      detailsDescA === realDescriptionA,
      `Interview Details displays real database description: "${detailsDescA.slice(0, 50)}..."`
    );

    // Verify Real Working Meeting Link
    const joinBtnA = await page.$('[data-testid="btn-details-join-meeting"]');
    assert(joinBtnA !== null, 'Active Video Conference Room displays "Enter Video Interview" button');

    const joinHrefA = await page.$eval('[data-testid="btn-details-join-meeting"]', (el) => el.getAttribute('href'));
    assert(
      joinHrefA === realMeetingLinkA,
      `Meeting link href is sourced directly from MongoDB document: "${joinHrefA}"`
    );

    // Test Copy Link Button
    await page.click('[data-testid="btn-copy-meeting-link"]');
    await new Promise((r) => setTimeout(r, 200));
    const copyFeedback = await page.$eval('[data-testid="btn-copy-meeting-link"]', (el) => el.textContent.trim());
    assert(copyFeedback === '✓ Copied!', 'Copy link button triggers instant visual feedback');

    // =============================================================
    // SCENARIO 3: Interview Details with Empty Schema Defaults (Booking B)
    // =============================================================
    console.log('\n--- Scenario 3: Interview Details Page with Empty Schema Defaults (Booking B) ---');
    await page.goto(`http://localhost:5173/candidate/bookings/${bookingB._id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="interview-details-page"]', { timeout: 5000 });

    // Verify Fallback for Description
    const detailsDescB = await page.$eval('[data-testid="details-description"]', (el) => el.textContent.trim());
    assert(
      detailsDescB === 'No description provided',
      `Empty description field renders clean fallback: "${detailsDescB}"`
    );

    // Verify Fallback for Meeting Link (sensible notice, NO broken/dead link)
    const deadJoinBtn = await page.$('[data-testid="btn-details-join-meeting"]');
    assert(deadJoinBtn === null, 'No dead or broken meeting link button rendered when link is empty');

    const pendingNotice = await page.$('[data-testid="meeting-room-pending"]');
    assert(pendingNotice !== null, 'Sensible pending notice box is rendered instead of a blank void');

    const pendingText = await page.$eval('[data-testid="meeting-room-pending"]', (el) => el.textContent);
    assert(
      pendingText.includes('Meeting link will be shared closer to the interview date'),
      `Pending notice conveys clear candidate guidance: "${pendingText.trim()}"`
    );

    // =============================================================
    // SCENARIO 4: My Interviews List Card Rendering with Fallback
    // =============================================================
    console.log('\n--- Scenario 4: My Interviews List (GET /api/candidate/bookings via Real Express) ---');
    await page.goto('http://localhost:5173/candidate/bookings', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="my-bookings-page"]', { timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="bookings-loading"]'));

    // Booking A card should display active meeting link
    const cardJoinA = await page.$(`[data-testid="btn-join-meeting-${bookingA._id}"]`);
    assert(cardJoinA !== null, 'Booking A card displays active "Open Meeting Link" button');
    const cardHrefA = await page.$eval(`[data-testid="btn-join-meeting-${bookingA._id}"]`, (el) => el.getAttribute('href'));
    assert(cardHrefA === realMeetingLinkA, `Booking A card link matches MongoDB meetingLink: "${cardHrefA}"`);

    // Booking B card should display sensible fallback text
    const cardPendingB = await page.$(`[data-testid="meeting-pending-${bookingB._id}"]`);
    assert(cardPendingB !== null, 'Booking B card displays sensible "Meeting link will be shared closer to the interview date" text');

    // =============================================================
    // SCENARIO 5: Real Backend Duplicate Booking Protection (409)
    // =============================================================
    console.log('\n--- Scenario 5: Real Backend Duplicate Booking Protection (POST /api/candidate/bookings) ---');
    await page.goto('http://localhost:5173/candidate/slots', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="available-slots-page"]', { timeout: 5000 });

    // Attempt to book Slot A again (candidate already holds Booking A)
    await page.click(`[data-testid="btn-book-slot-${slotA._id}"]`);
    await page.waitForSelector('[data-testid="booking-modal"]', { timeout: 3000 });

    await page.click('[data-testid="btn-confirm-booking"]');
    await page.waitForSelector('[data-testid="alert-booking-error"]', { timeout: 4000 });

    const dupError = await page.$eval('[data-testid="alert-booking-error"]', (el) => el.textContent);
    assert(
      dupError.includes('Already Reserved') && dupError.includes('already hold a confirmed reservation'),
      'Real backend 409 rejection is caught and rendered as specialized "Already Reserved" banner'
    );

    await page.click('[data-testid="btn-cancel-modal"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="booking-modal"]'));

    // =============================================================
    // SCENARIO 6: Real Backend Cancellation & Database Verification
    // =============================================================
    console.log('\n--- Scenario 6: Real Backend Cancellation (PATCH /api/candidate/bookings/:id/cancel) ---');
    await page.goto(`http://localhost:5173/candidate/bookings/${bookingA._id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="interview-details-page"]', { timeout: 5000 });

    // Click cancel and confirm
    await page.evaluate(() => document.querySelector('[data-testid="btn-details-cancel"]').click());
    await page.waitForSelector('[data-testid="details-cancel-modal"]', { timeout: 4000 });

    await page.evaluate(() => document.querySelector('[data-testid="btn-confirm-details-cancel"]').click());
    await page.waitForFunction(() => !document.querySelector('[data-testid="details-cancel-modal"]'), { timeout: 4000 });
    await page.waitForSelector('[data-testid="badge-details-status"]', { timeout: 5000 });

    // Verify UI state updated
    const statusBadge = await page.$eval('[data-testid="badge-details-status"]', (el) => el.textContent.trim());
    assert(statusBadge.includes('Cancelled'), 'UI immediately reflects "✕ Cancelled" status');

    const inactiveNotice = await page.$eval('[data-testid="meeting-room-card"]', (el) => el.textContent);
    assert(
      inactiveNotice.includes('deactivated') || inactiveNotice.includes('Inactive'),
      'Meeting room is cleanly deactivated upon cancellation'
    );

    // Directly query MongoDB database to verify true persistence!
    const updatedBookingInDB = await InterviewBooking.findById(bookingA._id);
    const updatedSlotInDB = await InterviewSlot.findById(slotA._id);

    assert(
      updatedBookingInDB.status === 'cancelled' && updatedBookingInDB.cancelledAt !== null,
      `Verified in MongoDB: booking status="${updatedBookingInDB.status}", cancelledAt set`
    );
    assert(
      updatedSlotInDB.bookedCount === 0,
      `Verified in MongoDB: slot capacity released (bookedCount decremented from 1 to ${updatedSlotInDB.bookedCount})`
    );

    console.log('\n=================================================================');
    console.log(`✓ All ${passedCount} Real Backend Verification tests PASSED successfully!`);
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n✗ Real backend verification encountered an error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await vite.close();
    await new Promise((resolve) => expressServer.close(resolve));
    await mongoose.connection.close();
    await mongod.stop();
  }
}

runRealBackendVerification();
