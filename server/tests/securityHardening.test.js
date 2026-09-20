const request = require('supertest');
const app = require('../app');
const errorHandler = require('../middleware/errorHandler');

describe('Security Hardening & Protection Tests', () => {
  // 1. Helmet Security HTTP Headers
  test('1. Helmet headers: responses include core security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);

    // Verify Helmet applied headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  test('1b. Health check endpoints: both /health and /api/health return 200 with status ok', async () => {
    const res1 = await request(app).get('/health');
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('ok');

    const res2 = await request(app).get('/api/health');
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('ok');
  });

  // 2. CORS Headers
  test('2. CORS headers: responds with appropriate CORS headers for allowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  // 3. Body Size Limits (DoS Mitigation)
  test('3. Payload size limiting: rejects oversized JSON payloads (>10kb) with 413 Payload Too Large', async () => {
    // Generate a payload exceeding 10kb
    const oversizedString = 'x'.repeat(12 * 1024);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: oversizedString });

    expect(res.status).toBe(413);
  });

  // 4. NoSQL Injection Stripping Middleware
  test('4. NoSQL injection stripping: removes keys starting with $ or containing . from body and query', async () => {
    // Attempting a NoSQL operator query in body
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: { $gt: '' },
        password: 'password123',
      });

    // Since $gt is stripped, email becomes {} which fails validation
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toContain('Email is required');
  });

  // 5. CastError Safe Message Formatting (CWE-209 Mitigation)
  test('5. CastError sanitization: does not reflect raw malicious user input in CastError message', () => {
    const req = {};
    let sentStatus = null;
    let sentJson = null;

    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentJson = data;
        return res;
      },
    };

    const maliciousId = '<script>alert(1)</script>';
    const castErr = new Error('Cast to ObjectId failed');
    castErr.name = 'CastError';
    castErr.value = maliciousId;

    errorHandler(castErr, req, res, () => {});

    expect(sentStatus).toBe(400);
    expect(sentJson.success).toBe(false);
    expect(sentJson.message).toBe('Invalid resource identifier format');
    // Ensure raw malicious string is not reflected
    expect(sentJson.message).not.toContain(maliciousId);
  });

  // 6. Production 500 Error Masking
  test('6. Production error masking: hides raw 500 internal error message when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req = {};
    let sentStatus = null;
    let sentJson = null;

    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentJson = data;
        return res;
      },
    };

    const sensitiveErr = new Error('MongoServerError: connect ECONNREFUSED 127.0.0.1:27017 with user:admin password:secretPassword');
    sensitiveErr.statusCode = 500;

    try {
      errorHandler(sensitiveErr, req, res, () => {});

      expect(sentStatus).toBe(500);
      expect(sentJson.success).toBe(false);
      expect(sentJson.message).toBe('Internal Server Error');
      expect(sentJson.message).not.toContain('secretPassword');
      expect(sentJson.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
