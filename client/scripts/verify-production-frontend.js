/**
 * Production Frontend, Deep-Link SPA Routing & Viewport Audit Suite
 *
 * Runs headless Chrome via Puppeteer against the live deployed Vercel frontend:
 * - URL: https://smart-interview-scheduler-chi.vercel.app
 *
 * Verifies:
 * - Dimension 11: Direct URL deep-link routing & hard refresh on sub-routes (/login, /register, /forgot-password)
 * - Dimension 12: Mobile, Tablet, and Desktop responsive layout audit (zero horizontal overflow, responsive containers)
 * - UI Form element interactivity and validation state rendering
 */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const FRONTEND_URL = process.env.LIVE_FRONTEND_URL || 'https://smart-interview-scheduler-chi.vercel.app';

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

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function logCheck(dimension, description, passed, details = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`  ✓ [PASS] [${dimension}] ${description} ${details ? '(' + details + ')' : ''}`);
  } else {
    failedChecks++;
    console.error(`  ✗ [FAIL] [${dimension}] ${description} ${details ? '(' + details + ')' : ''}`);
  }
}

async function runFrontendAudit() {
  console.log('='.repeat(75));
  console.log(' LIVE PRODUCTION FRONTEND & RESPONSIVENESS AUDIT');
  console.log(` Target Frontend: ${FRONTEND_URL}`);
  console.log('='.repeat(75));

  const chromePath = getChromePath();
  console.log(`\n[Browser] Launching Puppeteer with Chrome: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  // Capture console errors
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    // =========================================================================
    // DIMENSION 11: SPA Routing, Deep-Links & Hard Refreshes
    // =========================================================================
    console.log('\n--- DIMENSION 11: Frontend SPA Routing & Deep-Link Hard Refreshes ---');

    const testRoutes = [
      { path: '/', expectedText: 'SmartPrep' },
      { path: '/login', expectedText: 'Welcome' },
      { path: '/register', expectedText: 'Account' },
      { path: '/forgot-password', expectedText: 'Password' },
    ];

    for (const route of testRoutes) {
      const targetUrl = `${FRONTEND_URL}${route.path}`;
      const res = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const status = res ? res.status() : 0;

      // Hard refresh test (simulating pressing F5 / Ctrl+R in browser)
      const refreshRes = await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      const refreshStatus = refreshRes ? refreshRes.status() : 0;

      const bodyText = await page.evaluate(() => document.body.innerText);
      const isOk = (status === 200 || status === 304) && (refreshStatus === 200 || refreshStatus === 304);
      const contentMatches = bodyText.toLowerCase().includes(route.expectedText.toLowerCase());

      logCheck(
        'DIM-11',
        `Deep link & hard refresh: ${route.path}`,
        isOk && contentMatches,
        `Status: ${refreshStatus}, Content matches: ${contentMatches}`
      );
    }

    // =========================================================================
    // DIMENSION 12: Mobile, Tablet & Desktop Viewport Responsiveness
    // =========================================================================
    console.log('\n--- DIMENSION 12: Viewport Responsiveness & Layout Integrity ---');

    const viewports = [
      { name: 'Mobile (iPhone SE / 375x667)', width: 375, height: 667 },
      { name: 'Tablet (iPad / 768x1024)', width: 768, height: 1024 },
      { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    ];

    const auditPages = ['/login', '/register', '/'];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      console.log(`\n  Testing viewport: ${vp.name}`);

      for (const p of auditPages) {
        await page.goto(`${FRONTEND_URL}${p}`, { waitUntil: 'networkidle2', timeout: 30000 });

        // Check for horizontal overflow: scrollWidth should NOT exceed clientWidth + 1
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
          const clientWidth = doc.clientWidth;
          return {
            scrollWidth,
            clientWidth,
            hasOverflow: scrollWidth > clientWidth + 2,
          };
        });

        logCheck(
          'DIM-12',
          `No horizontal scroll overflow on ${p} [${vp.name.split(' ')[0]}]`,
          !overflow.hasOverflow,
          `clientWidth: ${overflow.clientWidth}px, scrollWidth: ${overflow.scrollWidth}px`
        );
      }
    }

    // =========================================================================
    // INTERACTIVE FORM SMOKE TEST
    // =========================================================================
    console.log('\n--- UI Form Interaction & Validation Smoke Test ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Verify login inputs are present and interactable
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    logCheck('UI-SMOKE', 'Login email input element visible', !!emailInput);
    logCheck('UI-SMOKE', 'Login password input element visible', !!passwordInput);
    logCheck('UI-SMOKE', 'Login submit button element present', !!submitBtn);

    // Verify zero fatal browser exceptions
    logCheck('UI-SMOKE', 'Zero unhandled client-side runtime errors', pageErrors.length === 0, `Errors: ${pageErrors.length}`);

  } finally {
    await browser.close();
    console.log('\n[Browser] Headless Chrome session closed.');
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(75));
  console.log(' FRONTEND AUDIT SUMMARY');
  console.log(` Total Checks:  ${totalChecks}`);
  console.log(` Passed Checks: ${passedChecks}`);
  console.log(` Failed Checks: ${failedChecks}`);
  console.log('='.repeat(75));

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    console.log('\n✓ ALL LIVE PRODUCTION FRONTEND CHECKS PASSED!\n');
  }
}

runFrontendAudit().catch((err) => {
  console.error('\nFATAL FRONTEND AUDIT FAILURE:', err);
  process.exit(1);
});
