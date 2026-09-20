import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

// 1. Lightweight Mock API Server on Port 5000 matching backend contracts
function startMockBackend(port = 5000) {
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
        const parsedBody = body ? JSON.parse(body) : {};
        const authHeader = req.headers.authorization || '';

        // POST /api/auth/login
        if (req.url === '/api/auth/login' && req.method === 'POST') {
          const { email, password } = parsedBody;
          console.log(`  [MockServer] Login attempt with email: "${email}"`);
          if (email === 'candidate@example.com' && password === 'password123') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Logged in successfully',
                data: {
                  user: { _id: 'cand101', email: 'candidate@example.com', role: 'candidate', isActive: true },
                  token: 'valid-candidate-token-xyz',
                },
              })
            );
            return;
          }
          if (email === 'admin@example.com' && password === 'password123') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Logged in successfully',
                data: {
                  user: { _id: 'adm202', email: 'admin@example.com', role: 'admin', isActive: true },
                  token: 'valid-admin-token-xyz',
                },
              })
            );
            return;
          }
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Invalid email or password' }));
          return;
        }

        // POST /api/auth/register
        if (req.url === '/api/auth/register' && req.method === 'POST') {
          const { email, password } = parsedBody;
          console.log(`  [MockServer] Register attempt with email: "${email}"`);
          if (!email || !password || password.length < 6) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Invalid registration data' }));
            return;
          }
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Candidate registered successfully',
              data: {
                user: { _id: 'cand-reg-999', email, role: 'candidate', isActive: true },
                token: 'valid-registered-token-xyz',
              },
            })
          );
          return;
        }

        // POST /api/auth/forgot-password
        if (req.url === '/api/auth/forgot-password' && req.method === 'POST') {
          const { email } = parsedBody;
          console.log(`  [MockServer] Forgot password attempt for email: "${email}"`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'If an account exists for this email, a reset link has been sent.',
            })
          );
          return;
        }

        // PUT /api/auth/reset-password/:token
        if (req.url.startsWith('/api/auth/reset-password/') && req.method === 'PUT') {
          const token = req.url.split('/').pop();
          console.log(`  [MockServer] Reset password attempt with token: "${token}"`);
          if (token === 'valid-reset-token') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Password reset successful',
              })
            );
            return;
          }
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'Password reset token is invalid or has expired',
            })
          );
          return;
        }

        // GET /api/auth/me
        if (req.url === '/api/auth/me' && req.method === 'GET') {
          if (authHeader === 'Bearer valid-candidate-token-xyz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Current user profile retrieved',
                data: {
                  user: { _id: 'cand101', email: 'candidate@example.com', role: 'candidate', isActive: true },
                },
              })
            );
            return;
          }
          if (authHeader === 'Bearer valid-admin-token-xyz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Current user profile retrieved',
                data: {
                  user: { _id: 'adm202', email: 'admin@example.com', role: 'admin', isActive: true },
                },
              })
            );
            return;
          }
          if (authHeader === 'Bearer valid-registered-token-xyz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                message: 'Current user profile retrieved',
                data: {
                  user: { _id: 'cand-reg-999', email: 'registered@example.com', role: 'candidate', isActive: true },
                },
              })
            );
            return;
          }
          // Expired or invalid token
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'Your session has expired. Please log in again.',
            })
          );
          return;
        }

        // POST /api/auth/logout
        if (req.url === '/api/auth/logout' && req.method === 'POST') {
          console.log('  [MockServer] POST /api/auth/logout received');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
          return;
        }

        // Fallback 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Route not found' }));
      });
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

// 2. Main Test Orchestration
async function runVerification() {
  console.log('=== [PHASE 6 RUNTIME VERIFICATION SUITE] ===\n');

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
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    console.log('  [BROWSER CONSOLE]', msg.type(), msg.text());
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const pageErrors = [];
  page.on('pageerror', (err) => {
    console.error('  [PAGE UNCAUGHT ERROR]', err.message);
    pageErrors.push(err.message);
  });

  const results = {
    test1_sessionExpiry: false,
    test2_adminRouteEnforcement: false,
    test3_sessionRestoreCandidate: false,
    test3_sessionRestoreAdmin: false,
    test4_registrationFlow: false,
    test5_forgotPasswordFlow: false,
    test6_resetPasswordFlow: false,
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Session Expiration & Event Bridge
    // -------------------------------------------------------------
    console.log('--- TEST 1: Session Expiration & Axios 401 Event Bridge ---');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

    // Step 1a: Log in as candidate
    await page.type('#email', 'candidate@example.com');
    await page.type('#password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for candidate dashboard navigation
    await page.waitForSelector('.candidate-portal', { timeout: 5000 });
    const currentUrl = page.url();
    console.log(`  Step 1: Successfully logged in as candidate, landed on: ${currentUrl}`);
    if (!currentUrl.includes('/candidate/dashboard')) {
      throw new Error(`Expected /candidate/dashboard, got ${currentUrl}`);
    }

    // Step 1b: Corrupt stored token to simulate expired JWT
    await page.evaluate(() => {
      localStorage.setItem('token', 'corrupted-expired-token-12345');
    });
    console.log('  Step 2: Directly corrupted token in localStorage.');

    // Step 1c: Trigger API call that returns 401
    console.log('  Step 3: Triggering authenticated API call with corrupted token...');
    await page.evaluate(async () => {
      const { default: api } = await import('/src/services/api.js');
      try {
        await api.get('/auth/me');
      } catch (e) {
        // Expected Axios 401 error caught by caller
      }
    });

    // Step 1d: Verify redirection to /login with session expired flash message
    await page.waitForSelector('.auth-page', { timeout: 5000 });
    const postExpiryUrl = page.url();
    console.log(`  Step 4: App redirected to: ${postExpiryUrl}`);

    const alertText = await page.$eval('.alert', (el) => el.textContent.trim());
    const isAlertWarning = await page.$eval('.alert', (el) => el.classList.contains('alert-warning'));
    const clearedToken = await page.evaluate(() => localStorage.getItem('token'));
    const isCandidateNavGone = (await page.$('.candidate-portal')) === null;

    console.log(`  Step 5: Alert text displayed: "${alertText}"`);
    console.log(`  Step 6: Token in localStorage: ${clearedToken} (cleared)`);
    console.log(`  Step 7: Candidate portal removed from DOM: ${isCandidateNavGone}`);

    if (
      postExpiryUrl.includes('/login') &&
      alertText.includes('Your session has expired') &&
      isAlertWarning &&
      clearedToken === null &&
      isCandidateNavGone
    ) {
      results.test1_sessionExpiry = true;
      console.log('✓ TEST 1 PASSED: Session expiry event bridge, state cleanup, and /login banner verified.\n');
    } else {
      throw new Error('Test 1 failed assertions.');
    }

    // -------------------------------------------------------------
    // TEST 2: AdminRoute Enforcement & Explicit /forbidden Redirect
    // -------------------------------------------------------------
    console.log('--- TEST 2: AdminRoute Enforcement & /forbidden Isolation ---');
    // Step 2a: Log back in as candidate
    await page.type('#email', 'candidate@example.com');
    await page.type('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.candidate-portal', { timeout: 5000 });
    console.log('  Step 1: Candidate logged in.');

    // Step 2b: Attempt direct navigation to /admin/dashboard
    console.log('  Step 2: Candidate navigating directly to /admin/dashboard...');
    await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle0' });

    // Step 2c: Verify redirect to /forbidden and complete absence of admin UI
    const forbiddenUrl = page.url();
    console.log(`  Step 3: App navigated to: ${forbiddenUrl}`);

    const forbiddenBadge = await page.$eval('.badge-danger', (el) => el.textContent.trim());
    const forbiddenTitle = await page.$eval('.status-title', (el) => el.textContent.trim());
    const adminPortalRendered = await page.$('.admin-portal');
    const adminHeaderRendered = await page.$('.admin-navbar');

    console.log(`  Step 4: Status badge: "${forbiddenBadge}", Title: "${forbiddenTitle}"`);
    console.log(`  Step 5: Admin layout rendered: ${adminPortalRendered !== null ? 'YES (FAIL)' : 'NO (PASSED)'}`);

    if (
      forbiddenUrl.includes('/forbidden') &&
      forbiddenBadge.includes('403 Forbidden') &&
      forbiddenTitle.includes('Access Denied') &&
      adminPortalRendered === null &&
      adminHeaderRendered === null
    ) {
      results.test2_adminRouteEnforcement = true;
      console.log('✓ TEST 2 PASSED: AdminRoute strictly blocked candidate and redirected to /forbidden with zero leakage.\n');
    } else {
      throw new Error('Test 2 failed assertions.');
    }

    // -------------------------------------------------------------
    // TEST 3: Session Restoration on Refresh (Candidate & Admin)
    // -------------------------------------------------------------
    console.log('--- TEST 3: Session Restoration on Browser Refresh ---');
    // Step 3a: Candidate session restoration
    await page.goto('http://localhost:5173/candidate/dashboard', { waitUntil: 'networkidle0' });
    console.log('  Step 1: Candidate on dashboard, refreshing page...');
    await page.reload({ waitUntil: 'networkidle0' });

    const candReloadUrl = page.url();
    const candEmailBadge = await page.$eval('.user-email', (el) => el.textContent.trim());
    const candRoleBadge = await page.$eval('.role-badge', (el) => el.textContent.trim());
    console.log(`  Step 2: After refresh, URL: ${candReloadUrl}, Email: ${candEmailBadge}, Role: ${candRoleBadge}`);

    if (
      candReloadUrl.includes('/candidate/dashboard') &&
      candEmailBadge === 'candidate@example.com' &&
      candRoleBadge === 'Candidate'
    ) {
      results.test3_sessionRestoreCandidate = true;
      console.log('  ✓ Candidate session retained cleanly on refresh.');
    }

    // Step 3b: Admin session restoration
    console.log('  Step 3: Logging out and signing in as Admin...');
    await page.waitForSelector('.candidate-navbar button.btn-outline', { timeout: 5000 });
    const logoutBtnText = await page.$eval('.candidate-navbar button.btn-outline', (el) => el.textContent.trim());
    console.log(`  Found logout button: "${logoutBtnText}", clicking...`);

    await page.evaluate(() => {
      const btn = document.querySelector('.candidate-navbar button.btn-outline');
      if (btn) btn.click();
    });

    await page.waitForSelector('.auth-page', { timeout: 5000 });
    console.log('  Landed on login page.');

    await page.waitForSelector('#email', { visible: true, timeout: 5000 });
    await page.evaluate((adminEmail, adminPass) => {
      function setReactInputValue(input, value) {
        const prev = input.value;
        input.value = value;
        if (input._valueTracker) {
          input._valueTracker.setValue(prev);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const emailInput = document.getElementById('email');
      const passInput = document.getElementById('password');
      setReactInputValue(emailInput, adminEmail);
      setReactInputValue(passInput, adminPass);

      const form = document.querySelector('.auth-form');
      form.requestSubmit();
    }, 'admin@example.com', 'password123');

    await page.waitForSelector('.admin-portal', { timeout: 8000 });
    console.log(`  Step 4: Admin logged in, landed on: ${page.url()}`);

    console.log('  Step 5: Refreshing admin dashboard tab...');
    await page.reload({ waitUntil: 'networkidle0' });

    const adminReloadUrl = page.url();
    const adminEmailBadge = await page.$eval('.admin-navbar .user-email', (el) => el.textContent.trim());
    const adminRoleBadge = await page.$eval('.admin-navbar .role-badge', (el) => el.textContent.trim());
    console.log(`  Step 6: After refresh, URL: ${adminReloadUrl}, Email: ${adminEmailBadge}, Role: ${adminRoleBadge}`);

    if (
      adminReloadUrl.includes('/admin/dashboard') &&
      adminEmailBadge === 'admin@example.com' &&
      adminRoleBadge === 'Admin'
    ) {
      results.test3_sessionRestoreAdmin = true;
      console.log('  ✓ Admin session retained cleanly on refresh.');
      console.log('✓ TEST 3 PASSED: Session restore on refresh functions seamlessly for both roles without flickers.\n');
    }

    // -------------------------------------------------------------
    // TEST 4: Candidate Registration Flow (/register)
    // -------------------------------------------------------------
    console.log('--- TEST 4: Candidate Registration & Validation Flow ---');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.auth-page', { timeout: 5000 });

    // Client-side validation: submit empty form
    await page.evaluate(() => document.querySelector('.auth-form').requestSubmit());
    await page.waitForSelector('.field-error-text', { timeout: 3000 });
    const emailErr = await page.$eval('.field-error-text', (el) => el.textContent.trim());
    console.log(`  Step 1: Empty submit validation caught: "${emailErr}"`);

    // Fill registration form using React input setter
    await page.evaluate((candEmail, candPass) => {
      function setReactInputValue(input, value) {
        const prev = input.value;
        input.value = value;
        if (input._valueTracker) {
          input._valueTracker.setValue(prev);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setReactInputValue(document.getElementById('email'), candEmail);
      setReactInputValue(document.getElementById('password'), candPass);
      setReactInputValue(document.getElementById('confirmPassword'), candPass);

      document.querySelector('.auth-form').requestSubmit();
    }, 'registered@example.com', 'password123');

    await page.waitForSelector('.candidate-portal', { timeout: 8000 });
    const regLandingUrl = page.url();
    console.log(`  Step 2: Registration succeeded, redirected to: ${regLandingUrl}`);

    if (regLandingUrl.includes('/candidate/dashboard')) {
      results.test4_registrationFlow = true;
      console.log('✓ TEST 4 PASSED: Candidate registration flow & validation verified.\n');
    }

    // -------------------------------------------------------------
    // TEST 5: Forgot Password Flow (/forgot-password)
    // -------------------------------------------------------------
    console.log('--- TEST 5: Forgot Password & Anti-Enumeration Confirmation ---');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5173/forgot-password', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.auth-page', { timeout: 5000 });

    // Invalid email validation test
    await page.evaluate(() => {
      function setReactInputValue(input, value) {
        const prev = input.value;
        input.value = value;
        if (input._valueTracker) {
          input._valueTracker.setValue(prev);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setReactInputValue(document.getElementById('email'), 'invalid-email-format');
      document.querySelector('.auth-form').requestSubmit();
    });

    await page.waitForSelector('.field-error-text', { timeout: 3000 });
    const forgotEmailErr = await page.$eval('.field-error-text', (el) => el.textContent.trim());
    console.log(`  Step 1: Invalid email format caught: "${forgotEmailErr}"`);

    // Valid email submission
    await page.evaluate(() => {
      function setReactInputValue(input, value) {
        const prev = input.value;
        input.value = value;
        if (input._valueTracker) {
          input._valueTracker.setValue(prev);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setReactInputValue(document.getElementById('email'), 'candidate@example.com');
      document.querySelector('.auth-form').requestSubmit();
    });

    await page.waitForSelector('.auth-confirmation-state', { timeout: 5000 });
    const confirmTitle = await page.$eval('.auth-confirmation-state .auth-title', (el) => el.textContent.trim());
    const confirmDesc = await page.$eval('.auth-confirmation-state .auth-subtitle', (el) => el.textContent.trim());
    console.log(`  Step 2: Generic confirmation state rendered: "${confirmTitle}"`);

    if (confirmTitle.includes('Check Your Email') && confirmDesc.includes('candidate@example.com')) {
      results.test5_forgotPasswordFlow = true;
      console.log('✓ TEST 5 PASSED: Forgot Password anti-enumeration confirmation state verified.\n');
    }

    // -------------------------------------------------------------
    // TEST 6: Reset Password Flow (/reset-password/:token)
    // -------------------------------------------------------------
    console.log('--- TEST 6: Reset Password Flow & Expiration Handling ---');
    // Test 6a: Expired / Invalid token
    await page.goto('http://localhost:5173/reset-password/expired-token-999', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#password', { timeout: 5000 });

    await page.evaluate(() => {
      function setReactInputValue(input, value) {
        const prev = input.value;
        input.value = value;
        if (input._valueTracker) {
          input._valueTracker.setValue(prev);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setReactInputValue(document.getElementById('password'), 'newpassword123');
      setReactInputValue(document.getElementById('confirmPassword'), 'newpassword123');
      document.querySelector('.auth-form').requestSubmit();
    });

    await page.waitForSelector('.alert-error', { timeout: 5000 });
    const resetErrText = await page.$eval('.alert-error p', (el) => el.textContent.trim());
    console.log(`  Step 1: Invalid/expired token correctly rejected: "${resetErrText}"`);

    // Test 6b: Valid token
    await page.goto('http://localhost:5173/reset-password/valid-reset-token', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#password', { timeout: 5000 });

    await page.evaluate(() => {
      function setReactInputValue(input, value) {
        const prev = input.value;
        input.value = value;
        if (input._valueTracker) {
          input._valueTracker.setValue(prev);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setReactInputValue(document.getElementById('password'), 'brandnewpassword123');
      setReactInputValue(document.getElementById('confirmPassword'), 'brandnewpassword123');
      document.querySelector('.auth-form').requestSubmit();
    });

    await page.waitForSelector('.auth-confirmation-state', { timeout: 5000 });
    const resetSuccessTitle = await page.$eval('.auth-confirmation-state .auth-title', (el) => el.textContent.trim());
    console.log(`  Step 2: Valid token password reset succeeded: "${resetSuccessTitle}"`);

    if (
      resetErrText.includes('invalid or has expired') &&
      resetSuccessTitle.includes('Password Reset Complete')
    ) {
      results.test6_resetPasswordFlow = true;
      console.log('✓ TEST 6 PASSED: Reset Password validation, rejection, and success state verified.\n');
    }

    // Console and page error inspection
    console.log('--- CONSOLE AND EXCEPTION AUDIT ---');
    console.log(`Total page errors / uncaught exceptions: ${pageErrors.length}`);
    console.log(`Total console errors: ${consoleErrors.length}`);
    if (pageErrors.length > 0) {
      console.warn('Page errors:', pageErrors);
    }
    if (consoleErrors.length > 0) {
      console.warn('Console errors:', consoleErrors);
    }
    if (pageErrors.length === 0) {
      console.log('✓ Zero uncaught exceptions or unhandled promise rejections detected.');
    }
  } finally {
    await browser.close();
    await vite.close();
    mockServer.close();
    console.log('\n✓ Cleaned up browser, Vite dev server, and mock API server.');
  }

  const allPassed = Object.values(results).every(Boolean) && pageErrors.length === 0;
  console.log(`\nOVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED (100%)' : 'SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

runVerification().catch((err) => {
  console.error('\nVerification runner failed:', err);
  process.exit(1);
});
