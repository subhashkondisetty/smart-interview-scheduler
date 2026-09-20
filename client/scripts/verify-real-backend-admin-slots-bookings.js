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
const InterviewSlot = serverRequire('./models/InterviewSlot');
const InterviewBooking = serverRequire('./models/InterviewBooking');
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

async function runRealBackendAdminSlotsBookingsVerification() {
  console.log('=== [ADMIN SLOTS & BOOKINGS REAL BACKEND VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_admin_slots_bookings_secret_1234567890_min32';
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
    email: 'admin.slots@smartprep.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const candidateA = await User.create({
    email: 'candidate.alpha@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const candidateB = await User.create({
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

  const candidateTokenA = jwt.sign(
    { id: candidateA._id.toString(), email: candidateA.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const candidateTokenB = jwt.sign(
    { id: candidateB._id.toString(), email: candidateB.email, role: 'candidate' },
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

  // 4. Start Vite Client Dev Server on standard port 5173
  console.log('[4/5] Starting Vite development server on port 5173...');
  const viteServer = await createServer({
    root: clientRoot,
    server: { port: 5173 },
  });
  await viteServer.listen();
  const clientBaseUrl = 'http://localhost:5173';
  console.log(`✓ Vite server running at ${clientBaseUrl}`);

  // 5. Launch Puppeteer Browser & Execute Real Verification Scenarios
  console.log('[5/5] Launching browser to run live integration scenarios...\n');
  const browser = await puppeteer.launch({
    executablePath: getChromePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const scenarioResults = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    page.on('console', (msg) => {
      const text = msg.text();
      if (!text.includes('[vite]') && !text.includes('Download the React DevTools')) {
        console.log('BROWSER LOG:', text);
      }
    });

    // Helper: Set auth token in localStorage
    const setAuthSession = async (token, userObj) => {
      await page.goto(`${clientBaseUrl}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(
        ({ t, u }) => {
          localStorage.setItem('token', t);
          localStorage.setItem('user', JSON.stringify(u));
        },
        { t: token, u: userObj }
      );
    };

    // --------------------------------------------------------------------------
    // SCENARIO 1: Create Slot with Explicit description and meetingLink (Prompt 23 Note)
    // --------------------------------------------------------------------------
    console.log('▶ Scenario 1: Creating interview slot with explicit description and meetingLink...');
    await setAuthSession(adminToken, { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' });

    await page.goto(`${clientBaseUrl}/admin/slots`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="create-slot-btn"]');

    // Click Create Slot button
    await page.click('[data-testid="create-slot-btn"]');
    await page.waitForSelector('[data-testid="create-slot-modal"]');

    // Fill form fields
    await page.type('#create-title', 'Distributed Systems Mock Architecture');
    await page.type('#create-interviewer', 'Dr. Aris Thorne');
    await page.click('#create-capacity', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#create-capacity', '2');

    // Fill explicit meetingLink and description
    await page.type('#create-meetinglink', 'https://meet.google.com/test-smartprep-xyz');
    await page.type(
      '#create-description',
      'Technical deep-dive into distributed consensus, Raft protocol, and horizontal partitioning.'
    );

    // Submit form
    await page.click('[data-testid="create-slot-modal"] button[type="submit"]');

    // Wait for modal to close and table to render
    await page.waitForSelector('[data-testid="slots-table"]', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    // Verify in MongoDB directly
    const createdSlot = await InterviewSlot.findOne({ title: 'Distributed Systems Mock Architecture' });
    if (!createdSlot) throw new Error('Slot was not found in MongoDB after UI submission!');
    if (createdSlot.meetingLink !== 'https://meet.google.com/test-smartprep-xyz') {
      throw new Error(`Expected meetingLink to be persisted verbatim, got: ${createdSlot.meetingLink}`);
    }
    if (
      createdSlot.description !==
      'Technical deep-dive into distributed consensus, Raft protocol, and horizontal partitioning.'
    ) {
      throw new Error(`Expected description to be persisted verbatim, got: ${createdSlot.description}`);
    }

    console.log('  ✓ Slot created via UI and verified in MongoDB with description & meetingLink intact.');
    scenarioResults.push({ name: 'Scenario 1: Slot Creation with description and meetingLink', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 2: Slot Validator Rejects Non-String description and meetingLink
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 2: Verifying validator rejects invalid non-string description and meetingLink...');
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const invalidDescRes = await fetch(`${apiBaseUrl}/api/admin/interview-slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Description Slot',
        startTime: futureDate,
        durationMinutes: 45,
        capacity: 1,
        description: 12345, // invalid type
      }),
    });
    const invalidDescJson = await invalidDescRes.json();
    if (invalidDescRes.status !== 400 || !invalidDescJson.errors?.some((e) => e.includes('Description must be a string'))) {
      throw new Error(`Expected 400 validator rejection for non-string description, got ${invalidDescRes.status}: ${JSON.stringify(invalidDescJson)}`);
    }

    const invalidLinkRes = await fetch(`${apiBaseUrl}/api/admin/interview-slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Link Slot',
        startTime: futureDate,
        durationMinutes: 45,
        capacity: 1,
        meetingLink: true, // invalid type
      }),
    });
    const invalidLinkJson = await invalidLinkRes.json();
    if (invalidLinkRes.status !== 400 || !invalidLinkJson.errors?.some((e) => e.includes('Meeting link must be a string'))) {
      throw new Error(`Expected 400 validator rejection for non-string meetingLink, got ${invalidLinkRes.status}: ${JSON.stringify(invalidLinkJson)}`);
    }

    console.log('  ✓ Backend validator correctly rejected non-string description and meetingLink with 400.');
    scenarioResults.push({ name: 'Scenario 2: Slot Validator Rejections for description & meetingLink', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 3: Slot Update Persists Updated description and meetingLink
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 3: Updating slot description and meetingLink via PUT...');
    const updateRes = await fetch(`${apiBaseUrl}/api/admin/interview-slots/${createdSlot._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        meetingLink: 'https://zoom.us/j/9998887776',
        description: 'Updated session agenda: Focus on Paxos consensus vs Raft leader election.',
      }),
    });
    const updateJson = await updateRes.json();
    if (updateRes.status !== 200 || !updateJson.success) {
      throw new Error(`Failed to update slot: ${JSON.stringify(updateJson)}`);
    }

    const updatedSlotInDb = await InterviewSlot.findById(createdSlot._id);
    if (updatedSlotInDb.meetingLink !== 'https://zoom.us/j/9998887776') {
      throw new Error(`Updated meetingLink was not saved in MongoDB!`);
    }
    if (updatedSlotInDb.description !== 'Updated session agenda: Focus on Paxos consensus vs Raft leader election.') {
      throw new Error(`Updated description was not saved in MongoDB!`);
    }

    console.log('  ✓ Slot updated successfully with new meetingLink and description in MongoDB.');
    scenarioResults.push({ name: 'Scenario 3: Slot Update with description & meetingLink', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 4: Candidates Book the Created Slot
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 4: Candidates Alpha and Beta book the slot...');
    const bookResA = await fetch(`${apiBaseUrl}/api/candidate/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateTokenA}`,
      },
      body: JSON.stringify({
        slotId: createdSlot._id.toString(),
        notes: 'Candidate Alpha: Looking forward to distributed systems review.',
      }),
    });
    const bookJsonA = await bookResA.json();
    if (bookResA.status !== 201) throw new Error(`Candidate A failed to book: ${JSON.stringify(bookJsonA)}`);
    const bookingAId = bookJsonA.data.booking._id;

    const bookResB = await fetch(`${apiBaseUrl}/api/candidate/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateTokenB}`,
      },
      body: JSON.stringify({
        slotId: createdSlot._id.toString(),
        notes: 'Candidate Beta: Prepared for system design.',
      }),
    });
    const bookJsonB = await bookResB.json();
    if (bookResB.status !== 201) throw new Error(`Candidate B failed to book: ${JSON.stringify(bookJsonB)}`);
    const bookingBId = bookJsonB.data.booking._id;

    // Verify slot capacity filled (2/2)
    const slotAfterBookings = await InterviewSlot.findById(createdSlot._id);
    if (slotAfterBookings.bookedCount !== 2 || slotAfterBookings.status !== 'booked') {
      throw new Error(`Expected slot to be fully booked (2/2), got bookedCount: ${slotAfterBookings.bookedCount}, status: ${slotAfterBookings.status}`);
    }

    console.log('  ✓ Both candidates booked slot; slot capacity marked full (2/2, status: booked).');
    scenarioResults.push({ name: 'Scenario 4: Candidates Book Slot to Full Capacity', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 5: Admin Bookings Management View & Filtering
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 5: Admin inspects Manage Bookings page with slot filtering...');
    await page.goto(`${clientBaseUrl}/admin/bookings?slotId=${createdSlot._id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="admin-bookings-table"]');

    // Verify 2 rows for this slot
    const rowA = await page.$(`[data-testid="booking-row-${bookingAId}"]`);
    const rowB = await page.$(`[data-testid="booking-row-${bookingBId}"]`);
    if (!rowA || !rowB) {
      throw new Error('Both candidate bookings were not rendered in the admin bookings table!');
    }

    console.log('  ✓ Admin bookings view rendered candidate bookings filtered by slotId.');
    scenarioResults.push({ name: 'Scenario 5: Admin Bookings Supervision & Filter View', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 6: Admin Reschedules Booking on Candidate Alpha's Behalf
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 6: Admin reschedules Candidate Alpha booking to a new slot on their behalf...');
    // Create a new future slot for rescheduling target
    const targetSlotDate = new Date(Date.now() + 96 * 60 * 60 * 1000);
    const targetSlot = await InterviewSlot.create({
      title: 'Target Reschedule Slot - Cloud Infrastructure',
      interviewerName: 'Staff Engineer Marcus',
      startTime: targetSlotDate,
      endTime: new Date(targetSlotDate.getTime() + 45 * 60000),
      durationMinutes: 45,
      capacity: 1,
      bookedCount: 0,
      status: 'available',
      createdBy: adminUser._id,
    });

    // Call admin reschedule endpoint
    const rescheduleRes = await fetch(`${apiBaseUrl}/api/admin/bookings/${bookingAId}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        newSlotId: targetSlot._id.toString(),
        notes: 'Rescheduled by Admin due to interviewer schedule change.',
      }),
    });
    const rescheduleJson = await rescheduleRes.json();
    if (rescheduleRes.status !== 200 || !rescheduleJson.success) {
      throw new Error(`Admin reschedule failed: ${JSON.stringify(rescheduleJson)}`);
    }

    const newBookingAId = rescheduleJson.data.newBooking._id;

    // Verify DB state
    const oldBookingA = await InterviewBooking.findById(bookingAId);
    if (oldBookingA.status !== 'rescheduled') {
      throw new Error(`Expected old booking status to be 'rescheduled', got: ${oldBookingA.status}`);
    }

    const newBookingA = await InterviewBooking.findById(newBookingAId);
    if (newBookingA.status !== 'confirmed') {
      throw new Error(`Expected new booking status to be 'confirmed', got: ${newBookingA.status}`);
    }

    // Verify capacity changes: old slot bookedCount decremented (from 2 to 1, status available)
    const oldSlotAfterReschedule = await InterviewSlot.findById(createdSlot._id);
    if (oldSlotAfterReschedule.bookedCount !== 1 || oldSlotAfterReschedule.status !== 'available') {
      throw new Error(`Old slot capacity not released! bookedCount: ${oldSlotAfterReschedule.bookedCount}, status: ${oldSlotAfterReschedule.status}`);
    }

    // New slot bookedCount incremented (from 0 to 1, status booked)
    const newSlotAfterReschedule = await InterviewSlot.findById(targetSlot._id);
    if (newSlotAfterReschedule.bookedCount !== 1 || newSlotAfterReschedule.status !== 'booked') {
      throw new Error(`Target slot capacity not claimed! bookedCount: ${newSlotAfterReschedule.bookedCount}, status: ${newSlotAfterReschedule.status}`);
    }

    // Verify in-app notification delivered to Candidate Alpha
    const alphaNotifs = await Notification.find({ userId: candidateA._id, type: 'booking_rescheduled' });
    if (alphaNotifs.length === 0) {
      throw new Error('Candidate Alpha did not receive booking_rescheduled in-app notification!');
    }
    if (!alphaNotifs[0].message.includes('rescheduled by an administrator')) {
      throw new Error(`Notification message did not specify administrator reschedule: ${alphaNotifs[0].message}`);
    }

    console.log('  ✓ Admin rescheduled booking on candidate behalf; atomic capacity updates & notification verified.');
    scenarioResults.push({ name: 'Scenario 6: Admin Reschedule Booking on Candidate Behalf', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 7: Admin Cancels Booking on Candidate Alpha's Behalf
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 7: Admin cancels Candidate Alpha booking on candidate behalf...');
    const cancelRes = await fetch(`${apiBaseUrl}/api/admin/bookings/${newBookingAId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const cancelJson = await cancelRes.json();
    if (cancelRes.status !== 200 || !cancelJson.success) {
      throw new Error(`Admin cancel failed: ${JSON.stringify(cancelJson)}`);
    }

    // Verify DB state
    const cancelledBooking = await InterviewBooking.findById(newBookingAId);
    if (cancelledBooking.status !== 'cancelled') {
      throw new Error(`Expected booking to be cancelled, got: ${cancelledBooking.status}`);
    }

    // Target slot capacity released (from 1 to 0, status available)
    const targetSlotAfterCancel = await InterviewSlot.findById(targetSlot._id);
    if (targetSlotAfterCancel.bookedCount !== 0 || targetSlotAfterCancel.status !== 'available') {
      throw new Error(`Slot capacity not restored to 0/available after cancel!`);
    }

    // Verify Candidate Alpha received booking_cancelled notification
    const alphaCancelNotifs = await Notification.find({ userId: candidateA._id, type: 'booking_cancelled' });
    if (alphaCancelNotifs.length === 0) {
      throw new Error('Candidate Alpha did not receive booking_cancelled notification!');
    }
    if (!alphaCancelNotifs[0].message.includes('was cancelled by an administrator')) {
      throw new Error(`Notification message lacked administrator wording: ${alphaCancelNotifs[0].message}`);
    }

    console.log('  ✓ Admin cancelled booking on candidate behalf; slot restored to available & candidate notified.');
    scenarioResults.push({ name: 'Scenario 7: Admin Cancel Booking on Candidate Behalf', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 8: Slot Deletion Cascade with Active Bookings (Candidate Beta)
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 8: Slot deletion cascade: admin deletes slot with active booking for Candidate Beta...');
    // createdSlot still has bookingB (Candidate Beta) confirmed
    const slotDelRes = await fetch(`${apiBaseUrl}/api/admin/interview-slots/${createdSlot._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const slotDelJson = await slotDelRes.json();
    if (slotDelRes.status !== 200) {
      throw new Error(`Slot deletion failed: ${JSON.stringify(slotDelJson)}`);
    }

    // Slot should be marked cancelled, bookedCount: 0
    const cascadeSlot = await InterviewSlot.findById(createdSlot._id);
    if (cascadeSlot.status !== 'cancelled' || cascadeSlot.bookedCount !== 0) {
      throw new Error(`Expected slot to be marked cancelled with bookedCount 0, got: ${cascadeSlot.status}, ${cascadeSlot.bookedCount}`);
    }

    // Candidate Beta's booking should be atomically transitioned to cancelled
    const cascadeBookingB = await InterviewBooking.findById(bookingBId);
    if (cascadeBookingB.status !== 'cancelled') {
      throw new Error(`Candidate Beta booking was not transitioned to cancelled! Status: ${cascadeBookingB.status}`);
    }

    // Candidate Beta should have received distinct admin cancellation notification
    const betaNotifs = await Notification.find({ userId: candidateB._id, type: 'booking_cancelled' });
    if (betaNotifs.length === 0) {
      throw new Error('Candidate Beta did not receive booking_cancelled notification from cascade!');
    }
    if (!betaNotifs[0].message.includes('was cancelled because the session was cancelled by an administrator')) {
      throw new Error(`Distinct cascade notification wording missing: ${betaNotifs[0].message}`);
    }

    console.log('  ✓ Slot deletion cascade atomically transitioned candidate booking to cancelled and dispatched distinct notification.');
    scenarioResults.push({ name: 'Scenario 8: Slot Deletion Cascade with Candidate Notification', passed: true });

    // --------------------------------------------------------------------------
    // SCENARIO 9: Hard Deletion of Unbooked Slot
    // --------------------------------------------------------------------------
    console.log('\n▶ Scenario 9: Hard deletion of unbooked slot from database...');
    // targetSlot currently has 0 bookings
    const hardDelRes = await fetch(`${apiBaseUrl}/api/admin/interview-slots/${targetSlot._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const hardDelJson = await hardDelRes.json();
    if (hardDelRes.status !== 200 || !hardDelJson.message?.includes('deleted successfully')) {
      throw new Error(`Hard deletion failed: ${JSON.stringify(hardDelJson)}`);
    }

    const hardDeletedSlot = await InterviewSlot.findById(targetSlot._id);
    if (hardDeletedSlot !== null) {
      throw new Error('Unbooked slot was not removed from MongoDB database!');
    }

    console.log('  ✓ Unbooked slot permanently deleted from database.');
    scenarioResults.push({ name: 'Scenario 9: Unbooked Slot Hard Deletion', passed: true });

  } finally {
    await browser.close();
    await viteServer.close();
    await new Promise((resolve) => expressServer.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }

  // Final Summary Report
  console.log('\n======================================================');
  console.log('ADMIN SLOTS & BOOKINGS REAL BACKEND VERIFICATION REPORT');
  console.log('======================================================');
  let allPassed = true;
  for (const s of scenarioResults) {
    const mark = s.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} - ${s.name}`);
    if (!s.passed) allPassed = false;
  }
  console.log('======================================================\n');

  if (!allPassed) {
    console.error('Verification failed for one or more scenarios!');
    process.exit(1);
  } else {
    console.log('All 9 scenarios verified successfully against real Express backend and live MongoDB engine!\n');
  }
}

runRealBackendAdminSlotsBookingsVerification().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
