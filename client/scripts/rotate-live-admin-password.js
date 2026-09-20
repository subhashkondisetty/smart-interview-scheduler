/**
 * rotate-live-admin-password.js
 *
 * Securely updates the live production administrator password from the default
 * to a high-entropy secret, and verifies that the old default password is permanently revoked.
 */

const API_URL = 'https://smart-interview-scheduler-api-flgk.onrender.com/api';
const ADMIN_EMAIL = 'admin@smartprep.com';
const OLD_PASSWORD = process.env.OLD_ADMIN_PASSWORD || 'Password123!';
const NEW_PASSWORD = process.env.NEW_ADMIN_PASSWORD || 'Sm4rtPrep!Adm1n#2026$Secure';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { res, data };
}

async function rotatePassword() {
  console.log('='.repeat(70));
  console.log(' ROTATING LIVE PRODUCTION ADMIN PASSWORD');
  console.log(` Target API: ${API_URL}`);
  console.log(` Admin Account: ${ADMIN_EMAIL}`);
  console.log('='.repeat(70));

  // 1. Wait for backend ready
  console.log('\n[1/4] Checking live backend availability...');
  let ready = false;
  for (let i = 0; i < 25; i++) {
    try {
      const { res, data } = await request(`${API_URL}/health`);
      if (res.status === 200 && data?.status === 'ok') {
        console.log(`Backend is live and responsive! (Attempt ${i + 1})`);
        ready = true;
        break;
      }
      console.log(`Waiting for service... (Attempt ${i + 1}, Status: ${res.status})`);
    } catch (e) {
      console.log(`Waiting for service... (Attempt ${i + 1}, Error: ${e.message})`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (!ready) throw new Error('Backend failed to become healthy within 100 seconds.');

  // 2. Attempt login with old password
  console.log('\n[2/4] Authenticating with initial admin credentials...');
  const oldLogin = await request(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: OLD_PASSWORD }),
  });

  if (oldLogin.res.status === 200 && oldLogin.data.data?.token) {
    console.log('Successfully authenticated with initial password. Proceeding with rotation...');
    const adminToken = oldLogin.data.data.token;

    // Call PUT /api/auth/update-password
    const updateRes = await request(`${API_URL}/auth/update-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    });

    if (updateRes.res.status === 200 && updateRes.data.success) {
      console.log('✓ Password updated successfully on the live production database!');
    } else {
      console.error('✗ Failed to update password:', updateRes.data);
      process.exit(1);
    }
  } else if (oldLogin.res.status === 401) {
    console.log('Initial default password was already changed/rejected (HTTP 401). Testing new password...');
  } else {
    console.error('Unexpected login response:', oldLogin.res.status, oldLogin.data);
    process.exit(1);
  }

  // 3. Verify old password is now rejected
  console.log('\n[3/4] Verifying default password is permanently revoked...');
  const verifyOld = await request(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: OLD_PASSWORD }),
  });

  if (verifyOld.res.status === 401) {
    console.log('✓ Confirmed: Default password is rejected with HTTP 401.');
  } else {
    console.error('✗ Security warning: Old password was not revoked!', verifyOld.res.status);
    process.exit(1);
  }

  // 4. Verify new password successfully authenticates
  console.log('\n[4/4] Verifying new strong password authenticates successfully...');
  const verifyNew = await request(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: NEW_PASSWORD }),
  });

  if (verifyNew.res.status === 200 && verifyNew.data.data?.token) {
    console.log('✓ Confirmed: New strong password successfully authenticates and issues JWT!');
    console.log(`✓ Admin Role: ${verifyNew.data.data.user.role}`);
  } else {
    console.error('✗ New password failed to authenticate:', verifyNew.data);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✓ ADMIN PASSWORD ROTATION COMPLETE & VERIFIED ON PRODUCTION');
  console.log('='.repeat(70));
}

rotatePassword().catch((err) => {
  console.error('Rotation error:', err);
  process.exit(1);
});
