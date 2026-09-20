import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

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

// 1. In-Memory Mock Backend for Candidate Interview Workflows
function startMockBackend(port = 5000) {
  // Slots: tomorrow, +2 days, +3 days, +4 days
  const now = Date.now();
  const tomorrow = new Date(now + 86400000);
  const dayAfterTomorrow = new Date(now + 172800000);
  const inThreeDays = new Date(now + 259200000);
  const inFourDays = new Date(now + 345600000);

  let mockSlots = [
    {
      _id: 'slot-1',
      title: 'Frontend System Design',
      interviewerName: 'Sarah Connor',
      interviewer: 'int-001',
      startTime: tomorrow.toISOString(),
      endTime: new Date(tomorrow.getTime() + 60 * 60000).toISOString(),
      durationMinutes: 60,
      capacity: 2,
      bookedCount: 1, // 1 spot left
      description: 'System design questions covering CDN caching, state hydration, and micro-frontends.',
      meetingLink: 'https://meet.jit.si/smartprep-mock-slot-1',
      isActive: true,
    },
    {
      _id: 'slot-2',
      title: 'Backend Scalability & Microservices',
      interviewerName: 'Alex Mercer',
      interviewer: 'int-002',
      startTime: dayAfterTomorrow.toISOString(),
      endTime: new Date(dayAfterTomorrow.getTime() + 45 * 60000).toISOString(),
      durationMinutes: 45,
      capacity: 1,
      bookedCount: 1, // Fully booked (0 spots left)
      description: 'Distributed caching, database sharding, and message queues in Node.js/Go.',
      meetingLink: 'https://meet.jit.si/smartprep-mock-slot-2',
      isActive: true,
    },
    {
      _id: 'slot-3',
      title: 'React Performance & Internals',
      interviewerName: 'Elena Rostova',
      interviewer: 'int-003',
      startTime: inThreeDays.toISOString(),
      endTime: new Date(inThreeDays.getTime() + 30 * 60000).toISOString(),
      durationMinutes: 30,
      capacity: 3,
      bookedCount: 0, // 3 spots left
      description: 'Fiber tree reconciliation, React concurrency, hooks lifecycle, and bundle optimization.',
      meetingLink: 'https://meet.jit.si/smartprep-mock-slot-3',
      isActive: true,
    },
    {
      _id: 'slot-4',
      title: 'DevOps & CI/CD Pipelines',
      interviewerName: 'Marcus Vance',
      interviewer: 'int-004',
      startTime: inFourDays.toISOString(),
      endTime: new Date(inFourDays.getTime() + 45 * 60000).toISOString(),
      durationMinutes: 45,
      capacity: 2,
      bookedCount: 0, // 2 spots left
      description: 'Docker multi-stage builds, Kubernetes pods, and automated deployment pipelines.',
      meetingLink: 'https://meet.jit.si/smartprep-mock-slot-4',
      isActive: true,
    },
  ];

  let mockBookings = [
    {
      _id: 'bk-101',
      candidate: 'cand101',
      slot: { ...mockSlots[0] },
      status: 'confirmed',
      notes: 'Looking for deep guidance on micro-frontend state sharing.',
      createdAt: new Date(now - 3600000).toISOString(),
    },
    {
      _id: 'bk-102',
      candidate: 'cand101',
      slot: {
        _id: 'slot-past',
        title: 'Algorithms & Problem Solving',
        interviewerName: 'David Chen',
        interviewer: 'int-004',
        startTime: new Date(now - 172800000).toISOString(),
        endTime: new Date(now - 169200000).toISOString(),
        durationMinutes: 60,
        capacity: 1,
        bookedCount: 1,
        description: 'Binary search tree balancing and dynamic programming.',
        meetingLink: 'https://meet.jit.si/smartprep-mock-past',
        isActive: true,
      },
      status: 'confirmed',
      notes: 'Practiced binary search trees.',
      createdAt: new Date(now - 259200000).toISOString(),
    },
    {
      _id: 'bk-103',
      candidate: 'cand101',
      slot: {
        _id: 'slot-old-cancelled',
        title: 'Fullstack Web Security',
        interviewerName: 'Jordan Vance',
        interviewer: 'int-005',
        startTime: new Date(now - 86400000).toISOString(),
        endTime: new Date(now - 82800000).toISOString(),
        durationMinutes: 60,
        capacity: 1,
        bookedCount: 0,
        description: 'OWASP Top 10 defenses, CSRF tokens, and secure session management.',
        meetingLink: 'https://meet.jit.si/smartprep-mock-cancelled',
        isActive: true,
      },
      status: 'cancelled',
      cancelledAt: new Date(now - 80000000).toISOString(),
      notes: 'Schedule conflict occurred.',
      createdAt: new Date(now - 100000000).toISOString(),
    },
  ];

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
        const url = req.url || '';

        // 1. GET /api/auth/me
        if (url === '/api/auth/me' && req.method === 'GET') {
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

        // 2. GET /api/interview-slots
        if (url === '/api/interview-slots' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              count: mockSlots.length,
              data: { slots: mockSlots },
            })
          );
          return;
        }

        // 3. GET /api/candidate/bookings
        if (url === '/api/candidate/bookings' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              count: mockBookings.length,
              data: { bookings: mockBookings },
            })
          );
          return;
        }

        // 4. POST /api/candidate/bookings
        if (url === '/api/candidate/bookings' && req.method === 'POST') {
          const parsed = JSON.parse(body || '{}');
          const targetSlot = mockSlots.find((s) => s._id === parsed.slotId);

          if (!targetSlot) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Interview slot not found.' }));
            return;
          }

          // Check if candidate already has active booking for this slot (Duplicate Booking guard)
          const existingActive = mockBookings.find(
            (b) => (b.slot?._id === parsed.slotId || b.slot === parsed.slotId) && b.status === 'confirmed'
          );
          if (existingActive) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: 'You already have an active booking for this interview slot.',
              })
            );
            return;
          }

          // Check capacity guard (Slot Full guard)
          if (targetSlot.bookedCount >= targetSlot.capacity) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: 'This interview slot is fully booked or no longer available.',
              })
            );
            return;
          }

          // Valid booking
          targetSlot.bookedCount += 1;
          const newBooking = {
            _id: `bk-${Date.now()}`,
            candidate: 'cand101',
            slot: { ...targetSlot },
            status: 'confirmed',
            notes: parsed.notes || '',
            createdAt: new Date().toISOString(),
          };
          mockBookings.unshift(newBooking);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Interview slot booked successfully',
              data: { booking: newBooking },
            })
          );
          return;
        }

        // 5. PATCH /api/candidate/bookings/:id/cancel
        const cancelMatch = url.match(/^\/api\/candidate\/bookings\/([^/]+)\/cancel$/);
        if (cancelMatch && req.method === 'PATCH') {
          const bookingId = cancelMatch[1];
          const booking = mockBookings.find((b) => b._id === bookingId);

          if (!booking) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Interview booking not found.' }));
            return;
          }

          if (booking.status === 'cancelled') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: 'This booking has already been cancelled or modified by another request.',
              })
            );
            return;
          }

          // Release slot capacity
          const slot = mockSlots.find((s) => s._id === (booking.slot?._id || booking.slot));
          if (slot && slot.bookedCount > 0) {
            slot.bookedCount -= 1;
          }

          booking.status = 'cancelled';
          booking.cancelledAt = new Date().toISOString();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Interview booking cancelled successfully',
              data: { booking },
            })
          );
          return;
        }

        // 6. PATCH /api/candidate/bookings/:id/reschedule
        const rescheduleMatch = url.match(/^\/api\/candidate\/bookings\/([^/]+)\/reschedule$/);
        if (rescheduleMatch && req.method === 'PATCH') {
          const bookingId = rescheduleMatch[1];
          const parsed = JSON.parse(body || '{}');
          const booking = mockBookings.find((b) => b._id === bookingId);

          if (!booking) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Interview booking not found.' }));
            return;
          }

          if (booking.status !== 'confirmed') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: `Cannot reschedule a ${booking.status} booking. Only confirmed bookings may be rescheduled.`,
              })
            );
            return;
          }

          const currentSlotId = booking.slot?._id || booking.slot;
          if (parsed.newSlotId === currentSlotId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: 'New slot must be different from current slot.',
              })
            );
            return;
          }

          const targetSlot = mockSlots.find((s) => s._id === parsed.newSlotId);
          if (!targetSlot) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Interview slot not found.' }));
            return;
          }

          // Capacity check on target slot
          if (targetSlot.bookedCount >= targetSlot.capacity) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: 'The target interview slot is fully booked or no longer available.',
              })
            );
            return;
          }

          // Release old slot capacity and increment new
          const oldSlot = mockSlots.find((s) => s._id === currentSlotId);
          if (oldSlot && oldSlot.bookedCount > 0) {
            oldSlot.bookedCount -= 1;
          }
          targetSlot.bookedCount += 1;

          // Update booking
          booking.slot = { ...targetSlot };
          if (parsed.notes !== undefined) booking.notes = parsed.notes;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Interview rescheduled successfully',
              data: { booking },
            })
          );
          return;
        }

        // Fallback 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
      });
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

// 2. Headless Browser Verification Suite
async function runVerification() {
  console.log('=== [CANDIDATE INTERVIEW WORKFLOWS RUNTIME VERIFICATION SUITE] ===\n');

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
    console.log('[4/4] Executing candidate interview workflow tests...\n');

    // Bootstrap candidate auth token in localStorage
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('token', 'valid-mock-candidate-token-interviews');
    });

    // -------------------------------------------------------------
    // TEST 1: Browse Available Slots Page
    // -------------------------------------------------------------
    await page.goto('http://localhost:5173/candidate/slots', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="available-slots-page"]', { timeout: 5000 });

    const renderedSlots = await page.$$('[data-testid^="slot-card-"]');
    assert(renderedSlots.length === 4, `Available slots page renders all 4 active slots (found ${renderedSlots.length})`);

    const slot1Cap = await page.$eval('[data-testid="slot-capacity-badge-slot-1"]', (el) => el.textContent.trim());
    const slot2Cap = await page.$eval('[data-testid="slot-capacity-badge-slot-2"]', (el) => el.textContent.trim());
    const slot3Cap = await page.$eval('[data-testid="slot-capacity-badge-slot-3"]', (el) => el.textContent.trim());

    assert(
      slot1Cap.includes('1 of 2 spots open') &&
      slot2Cap.includes('Fully Booked') &&
      slot3Cap.includes('3 of 3 spots open'),
      `Accurate capacity badges: Slot 1 (${slot1Cap}), Slot 2 (${slot2Cap}), Slot 3 (${slot3Cap})`
    );

    // -------------------------------------------------------------
    // TEST 2: Search and Duration Filtering on Slots Page
    // -------------------------------------------------------------
    // Search for "React"
    await page.type('[data-testid="input-search-slots"]', 'React');
    await new Promise((r) => setTimeout(r, 200));

    let visibleCards = await page.$$('[data-testid^="slot-card-"]');
    assert(visibleCards.length === 1, `Keyword filter "React" narrows visible slots to 1 (found ${visibleCards.length})`);

    const reactTitle = await page.$eval('[data-testid="slot-title-slot-3"]', (el) => el.textContent.trim());
    assert(reactTitle === 'React Performance & Internals', 'Filtered slot is "React Performance & Internals"');

    // Clear search and filter by duration 45 mins
    const clearBtn = await page.$('.search-clear-btn');
    if (clearBtn) {
      await clearBtn.click();
    } else {
      await page.evaluate(() => {
        const searchInput = document.querySelector('[data-testid="input-search-slots"]');
        searchInput.value = '';
        searchInput._valueTracker?.setValue('React');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await new Promise((r) => setTimeout(r, 200));

    await page.select('[data-testid="select-duration-filter"]', '45');
    await new Promise((r) => setTimeout(r, 200));

    visibleCards = await page.$$('[data-testid^="slot-card-"]');
    assert(visibleCards.length === 2, `Duration filter 45 mins narrows visible slots to 2 (found ${visibleCards.length})`);

    // Reset filter
    await page.select('[data-testid="select-duration-filter"]', 'all');
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------
    // TEST 3: Differentiated Error Surfacing - Duplicate Active Booking (409)
    // -------------------------------------------------------------
    // Attempt to book Slot 1, for which the candidate already has an active confirmed booking (bk-101)
    await page.click('[data-testid="btn-book-slot-slot-1"]');
    await page.waitForSelector('[data-testid="booking-modal"]', { timeout: 3000 });

    const modalTitle = await page.$eval('[data-testid="modal-slot-title"]', (el) => el.textContent.trim());
    assert(modalTitle === 'Frontend System Design', 'Booking modal opens with correct slot summary');

    // Submit booking to trigger 409 Duplicate Booking
    await page.click('[data-testid="btn-confirm-booking"]');
    await page.waitForSelector('[data-testid="alert-booking-error"]', { timeout: 3000 });

    const dupErrorText = await page.$eval('[data-testid="alert-booking-error"]', (el) => el.textContent);
    assert(
      dupErrorText.includes('Already Reserved') && dupErrorText.includes('already hold a confirmed reservation'),
      'Backend 409 duplicate booking triggers user-friendly "Already Reserved" banner'
    );

    const errorLink = await page.$('[data-testid="btn-error-action-link"]');
    assert(errorLink !== null, 'Differentiated duplicate error provides direct action link to My Interviews');

    // Close modal
    await page.click('[data-testid="btn-cancel-modal"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="booking-modal"]'));

    // -------------------------------------------------------------
    // TEST 4: Successful Slot Booking Flow
    // -------------------------------------------------------------
    // Book Slot 3 (open 3 of 3)
    await page.click('[data-testid="btn-book-slot-slot-3"]');
    await page.waitForSelector('[data-testid="booking-modal"]', { timeout: 3000 });

    // Enter session notes
    await page.type(
      '[data-testid="textarea-booking-notes"]',
      'Please focus on React Fiber reconciler, useSyncExternalStore, and concurrency.'
    );

    // Confirm booking
    await page.click('[data-testid="btn-confirm-booking"]');
    await page.waitForSelector('[data-testid="booking-success-view"]', { timeout: 4000 });

    const successHeading = await page.$eval('[data-testid="booking-success-view"] h3', (el) => el.textContent);
    assert(successHeading.includes('Interview Confirmed!'), 'Successful booking displays confirmation view');

    // Navigate to My Interviews via success CTA
    await page.click('[data-testid="btn-goto-my-bookings"]');
    await page.waitForSelector('[data-testid="my-bookings-page"]', { timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="bookings-loading"]'), { timeout: 5000 });
    assert(page.url().includes('/candidate/bookings'), 'Navigated smoothly to My Interviews page');

    // -------------------------------------------------------------
    // TEST 5: My Interviews Page - Metrics and Filtering
    // -------------------------------------------------------------
    const totalCount = await page.$eval('[data-testid="metric-total-bookings"]', (el) => el.textContent.trim());
    const upcomingCount = await page.$eval('[data-testid="metric-upcoming-bookings"]', (el) => el.textContent.trim());
    const completedCount = await page.$eval('[data-testid="metric-completed-bookings"]', (el) => el.textContent.trim());
    const cancelledCount = await page.$eval('[data-testid="metric-cancelled-bookings"]', (el) => el.textContent.trim());

    assert(
      totalCount === '4' && upcomingCount === '2' && completedCount === '1' && cancelledCount === '1',
      `Accurate metrics strip: Total=${totalCount}, Upcoming=${upcomingCount}, Completed=${completedCount}, Cancelled=${cancelledCount}`
    );

    // Test filter tabs
    await page.click('[data-testid="tab-upcoming"]');
    await new Promise((r) => setTimeout(r, 200));
    let cards = await page.$$('[data-testid^="booking-card-"]');
    assert(cards.length === 2, `Upcoming tab shows exactly 2 confirmed future bookings (found ${cards.length})`);

    await page.click('[data-testid="tab-completed"]');
    await new Promise((r) => setTimeout(r, 200));
    cards = await page.$$('[data-testid^="booking-card-"]');
    assert(cards.length === 1, `Completed tab shows exactly 1 past booking (found ${cards.length})`);

    await page.click('[data-testid="tab-cancelled"]');
    await new Promise((r) => setTimeout(r, 200));
    cards = await page.$$('[data-testid^="booking-card-"]');
    assert(cards.length === 1, `Cancelled tab shows exactly 1 cancelled booking (found ${cards.length})`);

    await page.click('[data-testid="tab-all"]');
    await new Promise((r) => setTimeout(r, 200));

    // Verify Meeting Link is visible for upcoming booking bk-101
    const joinBtn = await page.$('[data-testid="btn-join-meeting-bk-101"]');
    assert(joinBtn !== null, 'Upcoming confirmed booking displays active "Open Meeting Link" button');

    // -------------------------------------------------------------
    // TEST 6: Reschedule Flow with Collision Protection
    // -------------------------------------------------------------
    // Find the newly booked interview card (should be the React one)
    const allCards = await page.$$('[data-testid^="booking-card-"]');
    let newBookingId = null;
    for (const card of allCards) {
      const cardText = await card.evaluate((el) => el.textContent);
      if (cardText.includes('React Performance')) {
        const tid = await card.evaluate((el) => el.getAttribute('data-testid'));
        newBookingId = tid.replace('booking-card-', '');
        break;
      }
    }
    assert(newBookingId !== null, `Newly booked React interview card located in My Bookings list (ID: ${newBookingId})`);

    // Click Reschedule on new booking
    await page.click(`[data-testid="btn-reschedule-${newBookingId}"]`);
    await page.waitForSelector('[data-testid="reschedule-modal"]', { timeout: 3000 });
    await page.waitForSelector('[data-testid="select-target-slot"]', { timeout: 3000 });

    // Target Slot 2 is fully booked in mock backend. Rescheduling to it must return 409 and show collision banner.
    await page.select('[data-testid="select-target-slot"]', 'slot-2');
    await page.click('[data-testid="btn-confirm-reschedule"]');
    await page.waitForSelector('[data-testid="alert-reschedule-error"]', { timeout: 3000 });

    const reschedErrText = await page.$eval('[data-testid="alert-reschedule-error"]', (el) => el.textContent);
    assert(
      reschedErrText.includes('Slot Just Filled Up') || reschedErrText.includes('fully booked'),
      'Rescheduling into a fully booked slot (409) displays specialized collision warning'
    );

    // Now select an open slot (Slot 4 has 2 spots open)
    await page.waitForSelector('[data-testid="select-target-slot"]', { timeout: 3000 });
    await page.select('[data-testid="select-target-slot"]', 'slot-4');
    await page.click('[data-testid="btn-confirm-reschedule"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="reschedule-modal"]'), { timeout: 4000 });

    // Verify success banner in My Bookings
    const notification = await page.$eval('[data-testid="alert-action-notification"]', (el) => el.textContent);
    assert(
      notification.includes('rescheduled successfully'),
      'Successful reschedule closes modal and renders success alert banner'
    );

    // -------------------------------------------------------------
    // TEST 7: Interview Details Page (`/candidate/bookings/:id`)
    // -------------------------------------------------------------
    await page.click('[data-testid="btn-view-details-bk-101"]');
    await page.waitForSelector('[data-testid="interview-details-page"]', { timeout: 5000 });
    assert(page.url().includes('/candidate/bookings/bk-101'), 'Navigated to Interview Details page for bk-101');

    const detailsTitle = await page.$eval('[data-testid="details-title"]', (el) => el.textContent.trim());
    const detailsInterviewer = await page.$eval('[data-testid="details-interviewer-name"]', (el) => el.textContent.trim());
    const meetingRoomCard = await page.$('[data-testid="meeting-room-card"]');
    const meetingJoinBtn = await page.$('[data-testid="btn-details-join-meeting"]');

    assert(detailsTitle.includes('Frontend System Design'), `Interview Details renders title: "${detailsTitle}"`);
    assert(detailsInterviewer === 'Sarah Connor', `Interview Details renders interviewer: "${detailsInterviewer}"`);
    assert(meetingRoomCard !== null && meetingJoinBtn !== null, 'Interview Details renders active Video Conference Room with join button');

    // Test Copy Link interaction
    await page.click('[data-testid="btn-copy-meeting-link"]');
    await new Promise((r) => setTimeout(r, 200));
    const copyBtnText = await page.$eval('[data-testid="btn-copy-meeting-link"]', (el) => el.textContent.trim());
    assert(copyBtnText === '✓ Copied!', 'Copy link button provides dynamic visual feedback on click');

    // -------------------------------------------------------------
    // TEST 8: Cancel Booking from Interview Details Page
    // -------------------------------------------------------------
    const cancelBtn = await page.$('[data-testid="btn-details-cancel"]');
    assert(cancelBtn !== null, 'Cancel Booking button is rendered on Interview Details page');

    await page.evaluate(() => document.querySelector('[data-testid="btn-details-cancel"]').click());
    await page.waitForSelector('[data-testid="details-cancel-modal"]', { timeout: 4000 });

    await page.evaluate(() => document.querySelector('[data-testid="btn-confirm-details-cancel"]').click());
    await page.waitForFunction(() => !document.querySelector('[data-testid="details-cancel-modal"]'), { timeout: 4000 });

    // Details page reloads booking: status should now be Cancelled
    const updatedBadge = await page.$eval('[data-testid="badge-details-status"]', (el) => el.textContent.trim());
    assert(updatedBadge.includes('Cancelled'), 'After cancellation, status badge updates to "✕ Cancelled"');

    const meetingInactiveText = await page.$eval('[data-testid="meeting-room-card"]', (el) => el.textContent);
    assert(
      meetingInactiveText.includes('deactivated') || meetingInactiveText.includes('Inactive'),
      'Video Conference Room is cleanly deactivated for cancelled session'
    );

    console.log('\n=============================================================');
    console.log(`✓ All ${passedCount} interview workflow tests PASSED successfully!`);
    console.log('=============================================================\n');
  } catch (err) {
    console.error('\n✗ Test suite encountered an error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await vite.close();
    mockServer.close();
  }
}

runVerification();
