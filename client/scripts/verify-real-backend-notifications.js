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

async function runRealBackendNotificationsVerification() {
  console.log('=== [CANDIDATE NOTIFICATIONS & TOAST SYSTEM REAL BACKEND VERIFICATION] ===\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'real_backend_notifications_jwt_secret_key_123456789012345';
  process.env.CLIENT_URL = 'http://localhost:5173';

  // 1. Start real in-memory MongoDB
  console.log('[1/5] Starting real MongoDB in-memory engine...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  console.log(`✓ Real MongoDB engine running at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log('✓ Mongoose connected to real MongoDB instance.');

  // 2. Seed User and Notification documents
  console.log('[2/5] Seeding candidate and real notifications into MongoDB...');
  const candidateUser = await User.create({
    email: 'candidate.notif@smartprep.com',
    password: 'Password123!',
    role: 'candidate',
    isActive: true,
  });

  const realCandidateToken = jwt.sign(
    { id: candidateUser._id.toString(), email: candidateUser.email, role: 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const notif1 = await Notification.create({
    userId: candidateUser._id,
    type: 'booking_confirmed',
    message: 'Your interview for Senior Frontend Engineer has been confirmed for tomorrow at 10:00 AM.',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5m ago
  });

  const notif2 = await Notification.create({
    userId: candidateUser._id,
    type: 'booking_cancelled',
    message: 'Your interview booking for Fullstack Architecture has been cancelled.',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30m ago
  });

  const notif3 = await Notification.create({
    userId: candidateUser._id,
    type: 'assessment_completed',
    message: 'You completed React Core Assessment with a score of 92%.',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000), // 2h ago
  });

  const notif4 = await Notification.create({
    userId: candidateUser._id,
    type: 'assessment_expired',
    message: 'Your attempt for Node.js Event Loop assessment has expired.',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000), // 1 day ago
  });

  const notif5 = await Notification.create({
    userId: candidateUser._id,
    type: 'admin_broadcast',
    message: 'Platform maintenance scheduled for Sunday at 02:00 UTC.',
    isRead: true,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000), // 2 days ago
  });

  console.log(`✓ Seeded Candidate: ${candidateUser.email}`);
  console.log(`✓ Seeded 5 notifications (3 unread, 2 read) directly in MongoDB\n`);

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
  console.log('[5/5] Launching headless browser to verify Notifications & Toast integration...');
  const chromePath = getChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
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
    // Inject auth credentials into localStorage
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      {
        token: realCandidateToken,
        user: { id: candidateUser._id.toString(), email: candidateUser.email, role: 'candidate' },
      }
    );

    // =============================================================
    // SCENARIO 1: Navbar Unread Badge & Initial Notifications Page Load
    // =============================================================
    console.log('\n--- Scenario 1: Navbar Badge & Notifications Page Render ---');
    await page.goto('http://localhost:5173/candidate/dashboard', { waitUntil: 'networkidle0' });

    // Check navbar unread badge
    await page.waitForSelector('[data-testid="nav-unread-badge"]', { timeout: 5000 });
    const navBadgeText = await page.$eval('[data-testid="nav-unread-badge"]', (el) => el.textContent.trim());
    assert(navBadgeText === '3', `Navbar badge displays exact unread count of 3 (actual: "${navBadgeText}")`);

    // Navigate to Notifications Page
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('a[href="/candidate/notifications"]'),
    ]);

    await page.waitForSelector('[data-testid="notifications-page"]', { timeout: 5000 });
    assert(page.url().includes('/candidate/notifications'), 'Successfully loaded /candidate/notifications route');

    // Check header unread counter badge
    await page.waitForSelector('[data-testid="unread-count-badge"]', { timeout: 5000 });
    const headerBadgeText = await page.$eval('[data-testid="unread-count-badge"]', (el) => el.textContent.trim());
    assert(headerBadgeText.includes('3 unread'), `Header counter badge displays "3 unread" (actual: "${headerBadgeText}")`);

    // Verify all 5 notifications rendered
    const items = await page.$$('[data-testid="notification-item"]');
    assert(items.length === 5, `Rendered all 5 notifications from real MongoDB (actual: ${items.length})`);

    // Verify booking_confirmed icon mapping: must display 📅 (calendar), NOT fallback 🔔
    const notifTexts = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="notification-item"]'));
      return cards.map((c) => ({
        icon: c.querySelector('.notification-type-icon')?.textContent.trim(),
        badge: c.querySelector('[data-testid="notification-type-badge"]')?.textContent.trim(),
        message: c.querySelector('[data-testid="notification-message"]')?.textContent.trim(),
        isUnread: c.classList.contains('notification-unread'),
      }));
    });

    const confirmedNotif = notifTexts.find((n) => n.message.includes('Senior Frontend Engineer'));
    assert(
      confirmedNotif && confirmedNotif.icon === '📅',
      `booking_confirmed maps to calendar emoji 📅 (actual: "${confirmedNotif?.icon}")`
    );
    assert(
      confirmedNotif && confirmedNotif.badge === 'Interview Confirmed',
      `booking_confirmed badge is "Interview Confirmed" (actual: "${confirmedNotif?.badge}")`
    );

    const cancelledNotif = notifTexts.find((n) => n.message.includes('Fullstack Architecture'));
    assert(
      cancelledNotif && cancelledNotif.icon === '✕' && cancelledNotif.badge === 'Interview Cancelled',
      `booking_cancelled maps to ✕ and "Interview Cancelled" badge`
    );

    const completedNotif = notifTexts.find((n) => n.message.includes('React Core Assessment'));
    assert(
      completedNotif && completedNotif.icon === '📝' && completedNotif.badge === 'Assessment Completed',
      `assessment_completed maps to 📝 and "Assessment Completed" badge`
    );

    const expiredNotif = notifTexts.find((n) => n.message.includes('Node.js Event Loop'));
    assert(
      expiredNotif && expiredNotif.icon === '⏳' && expiredNotif.badge === 'Assessment Expired',
      `assessment_expired maps to ⏳ and "Assessment Expired" badge`
    );

    const broadcastNotif = notifTexts.find((n) => n.message.includes('Platform maintenance'));
    assert(
      broadcastNotif && broadcastNotif.icon === '📢' && broadcastNotif.badge === 'Announcement',
      `admin_broadcast maps to 📢 and "Announcement" badge`
    );

    // Verify unread dot presence: exactly 3 cards have unread dots
    const unreadDotsCount = await page.$$eval('[data-testid="unread-dot"]', (dots) => dots.length);
    assert(unreadDotsCount === 3, `Exactly 3 unread dots rendered for unread notifications (actual: ${unreadDotsCount})`);

    // =============================================================
    // SCENARIO 2: Tab Filtering (Unread, Read, All)
    // =============================================================
    console.log('\n--- Scenario 2: Notification Tab Filtering ---');

    // Filter: Unread
    await page.click('[data-testid="filter-unread"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="notification-item"]').length === 3,
      { timeout: 5000 }
    );
    const unreadFilteredItems = await page.$$eval('[data-testid="notification-item"]', (cards) => cards.length);
    assert(unreadFilteredItems === 3, `Unread tab displays exactly 3 unread items (actual: ${unreadFilteredItems})`);

    // Filter: Read
    await page.click('[data-testid="filter-read"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="notification-item"]').length === 2,
      { timeout: 5000 }
    );
    const readFilteredItems = await page.$$eval('[data-testid="notification-item"]', (cards) => cards.length);
    assert(readFilteredItems === 2, `Read tab displays exactly 2 read items (actual: ${readFilteredItems})`);

    // Return to: All
    await page.click('[data-testid="filter-all"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="notification-item"]').length === 5,
      { timeout: 5000 }
    );
    const allFilteredItems = await page.$$eval('[data-testid="notification-item"]', (cards) => cards.length);
    assert(allFilteredItems === 5, `All tab displays all 5 items again (actual: ${allFilteredItems})`);

    // =============================================================
    // SCENARIO 3: Single Mark as Read + Real DB Mutation + Toast
    // =============================================================
    console.log('\n--- Scenario 3: Single Mark as Read with Real DB Sync & Toast ---');

    // Click mark as read on notif1 (Senior Frontend Engineer)
    const btnMarkReadSelector = `[data-testid="btn-mark-read-${notif1._id}"]`;
    await page.waitForSelector(btnMarkReadSelector, { timeout: 5000 });
    await page.click(btnMarkReadSelector);

    // Verify toast notification appears
    await page.waitForSelector('.toast-item.toast-success', { timeout: 5000 });
    const toastText = await page.$eval('.toast-item.toast-success .toast-message', (el) => el.textContent.trim());
    assert(
      toastText === 'Notification marked as read',
      `Toast appeared with message "Notification marked as read" (actual: "${toastText}")`
    );

    // Verify UI state decrements unread count
    await page.waitForFunction(
      () => document.querySelector('[data-testid="unread-count-badge"]')?.textContent.includes('2 unread'),
      { timeout: 5000 }
    );
    const updatedHeaderBadge = await page.$eval('[data-testid="unread-count-badge"]', (el) => el.textContent.trim());
    assert(updatedHeaderBadge.includes('2 unread'), `Header counter updated to "2 unread" (actual: "${updatedHeaderBadge}")`);

    // Verify mark-read button is gone for that item
    const btnStillExists = await page.$(btnMarkReadSelector);
    assert(btnStillExists === null, `Mark-as-read button removed for the updated notification`);

    // Verify in real MongoDB document
    const updatedDbNotif = await Notification.findById(notif1._id);
    assert(
      updatedDbNotif && updatedDbNotif.isRead === true,
      `Real MongoDB document ${notif1._id} isRead updated to true`
    );

    // =============================================================
    // SCENARIO 4: Batch Mark All as Read + Real DB Sync + Toast
    // =============================================================
    console.log('\n--- Scenario 4: Mark All as Read with Real DB Sync & Toast ---');

    await page.waitForSelector('[data-testid="btn-mark-all-read"]');
    await page.click('[data-testid="btn-mark-all-read"]');

    // Verify batch toast notification
    await page.waitForFunction(
      () => {
        const msgs = Array.from(document.querySelectorAll('.toast-item.toast-success .toast-message'));
        return msgs.some((m) => m.textContent.includes('Marked 2 notifications as read') || m.textContent.includes('All notifications marked as read'));
      },
      { timeout: 5000 }
    );
    console.log('  ✓ Toast appeared for batch mark-all-read action.');
    passedCount++;
    testCount++;

    // Verify header unread badge disappears
    await page.waitForFunction(
      () => document.querySelector('[data-testid="unread-count-badge"]') === null,
      { timeout: 5000 }
    );
    const badgeGone = await page.$('[data-testid="unread-count-badge"]');
    assert(badgeGone === null, 'Header unread badge is hidden when 0 unread remaining');

    // Verify no unread dots remain
    const remainingDots = await page.$$eval('[data-testid="unread-dot"]', (dots) => dots.length);
    assert(remainingDots === 0, `Zero unread dots remain in list (actual: ${remainingDots})`);

    // Verify in real MongoDB directly
    const remainingUnreadInDb = await Notification.countDocuments({
      userId: candidateUser._id,
      isRead: false,
    });
    assert(remainingUnreadInDb === 0, `Real MongoDB confirms 0 unread notifications remain for candidate`);

    // =============================================================
    // SCENARIO 5: Toast Container Dismissal
    // =============================================================
    console.log('\n--- Scenario 5: Toast Container Manual Dismissal ---');

    const toastItems = await page.$$('.toast-item');
    assert(toastItems.length > 0, `Toast container currently displays active toast items`);

    // Click close button on the top toast
    await page.click('.toast-item .toast-close-btn');
    await page.waitForFunction(
      (initialCount) => document.querySelectorAll('.toast-item').length < initialCount,
      { timeout: 5000 },
      toastItems.length
    );
    console.log('  ✓ Successfully dismissed toast via close button.');
    passedCount++;
    testCount++;

    console.log('\n=================================================================');
    console.log(`✓ All ${passedCount} Real Backend Notification & Toast tests PASSED successfully!`);
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n✗ Real backend notifications verification encountered an error:', err);
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

runRealBackendNotificationsVerification();
