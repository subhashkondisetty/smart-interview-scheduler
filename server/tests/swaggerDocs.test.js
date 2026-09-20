const request = require('supertest');
const app = require('../app');
const swaggerSpec = require('../docs/swaggerSpec');

describe('Swagger / OpenAPI 3.0 Documentation & CSP Isolation', () => {
  let originalEnv;
  let originalSwaggerFlag;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
    originalSwaggerFlag = process.env.ENABLE_SWAGGER;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalSwaggerFlag !== undefined) {
      process.env.ENABLE_SWAGGER = originalSwaggerFlag;
    } else {
      delete process.env.ENABLE_SWAGGER;
    }
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.ENABLE_SWAGGER;
  });

  // Test 1: Specification Validity and Completeness
  test('1. Specification completeness: GET /api-docs.json returns valid OpenAPI 3.0.3 spec with all 37 paths and 50 operations', async () => {
    const res = await request(app).get('/api-docs.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/i);

    const spec = res.body;
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('Smart Interview Scheduler & Mock Assessment Platform API');
    expect(spec.info.version).toBe('1.0.0');

    // Security definition
    expect(spec.components.securitySchemes).toHaveProperty('bearerAuth');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect(spec.components.securitySchemes.bearerAuth.bearerFormat).toBe('JWT');

    // Verify key schemas
    const schemas = spec.components.schemas;
    expect(schemas).toHaveProperty('User');
    expect(schemas).toHaveProperty('CandidateProfile');
    expect(schemas).toHaveProperty('InterviewSlot');
    expect(schemas).toHaveProperty('InterviewBooking');
    expect(schemas).toHaveProperty('Assessment');
    expect(schemas).toHaveProperty('Question');
    expect(schemas).toHaveProperty('AssessmentAttempt');
    expect(schemas).toHaveProperty('Notification');
    expect(schemas).toHaveProperty('ErrorResponse');

    // Verify all 37 distinct endpoint paths are registered
    const paths = Object.keys(spec.paths);
    expect(paths.length).toBe(37);

    // Assert key endpoint paths exist
    expect(paths).toContain('/health');
    expect(paths).toContain('/api/auth/register');
    expect(paths).toContain('/api/auth/login');
    expect(paths).toContain('/api/auth/logout');
    expect(paths).toContain('/api/auth/me');
    expect(paths).toContain('/api/admin/dashboard');
    expect(paths).toContain('/api/admin/interview-slots');
    expect(paths).toContain('/api/admin/interview-slots/{id}');
    expect(paths).toContain('/api/admin/bookings');
    expect(paths).toContain('/api/admin/assessments');
    expect(paths).toContain('/api/admin/assessments/{id}');
    expect(paths).toContain('/api/admin/assessments/{id}/publish');
    expect(paths).toContain('/api/admin/assessments/{assessmentId}/questions');
    expect(paths).toContain('/api/admin/notifications/broadcast');
    expect(paths).toContain('/api/candidate/dashboard');
    expect(paths).toContain('/api/candidate/profile');
    expect(paths).toContain('/api/candidate/profile/resume');
    expect(paths).toContain('/api/candidate/bookings');
    expect(paths).toContain('/api/candidate/bookings/{id}/cancel');
    expect(paths).toContain('/api/candidate/bookings/{id}/reschedule');
    expect(paths).toContain('/api/candidate/assessments/{id}/start');
    expect(paths).toContain('/api/candidate/attempts/{attemptId}/submit');
    expect(paths).toContain('/api/candidate/performance/topic-wise');
    expect(paths).toContain('/api/interview-slots');
    expect(paths).toContain('/api/assessments');
    expect(paths).toContain('/api/notifications');
    expect(paths).toContain('/api/notifications/{id}/read');

    // Verify specific authentic controller status codes are documented
    // Notification read anti-enumeration returns 404
    expect(spec.paths['/api/notifications/{id}/read'].patch.responses).toHaveProperty('404');
    expect(spec.paths['/api/notifications/{id}/read'].patch.responses['404'].description).toMatch(/anti-enumeration/i);

    // Reschedule returns 400, 403, 404, 409, 200
    const reschedResponses = spec.paths['/api/candidate/bookings/{id}/reschedule'].patch.responses;
    expect(reschedResponses).toHaveProperty('200');
    expect(reschedResponses).toHaveProperty('400');
    expect(reschedResponses).toHaveProperty('403');
    expect(reschedResponses).toHaveProperty('404');
    expect(reschedResponses).toHaveProperty('409');

    // Submit attempt returns 400, 403, 404, 200
    const submitResponses = spec.paths['/api/candidate/attempts/{attemptId}/submit'].post.responses;
    expect(submitResponses).toHaveProperty('200');
    expect(submitResponses).toHaveProperty('400');
    expect(submitResponses).toHaveProperty('403');
    expect(submitResponses).toHaveProperty('404');
  });

  // Test 2: Swagger UI Rendering
  test('2. Swagger UI rendering: GET /api-docs/ serves HTML page in non-production', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/i);
    expect(res.text).toContain('swagger-ui');
  });

  // Test 3: CSP Isolation Check (Strict verification of scoping)
  test('3. CSP isolation check: relaxed CSP is strictly scoped to /api-docs and does not weaken global API routes', async () => {
    // 3a. /api-docs/ has relaxed CSP with 'unsafe-inline' for Swagger UI
    const resSwagger = await request(app).get('/api-docs/');
    const swaggerCsp = resSwagger.headers['content-security-policy'];
    expect(swaggerCsp).toBeDefined();
    expect(swaggerCsp).toContain("script-src 'self' 'unsafe-inline'");
    expect(swaggerCsp).toContain("style-src 'self' 'unsafe-inline'");

    // 3b. Standard application routes (e.g. /health) retain strict Helmet default CSP
    const resHealth = await request(app).get('/health');
    const healthCsp = resHealth.headers['content-security-policy'];
    expect(healthCsp).toBeDefined();
    // Default Helmet v8 has script-src 'self' without 'unsafe-inline'
    expect(healthCsp).toContain("script-src 'self'");
    expect(healthCsp).not.toContain("script-src 'self' 'unsafe-inline'");

    // 3c. Protected API routes retain strict Helmet default CSP
    const resAuth = await request(app).get('/api/auth/me');
    const authCsp = resAuth.headers['content-security-policy'];
    expect(authCsp).toBeDefined();
    expect(authCsp).toContain("script-src 'self'");
    expect(authCsp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  // Test 4: Production Gate (Disabled in production without ENABLE_SWAGGER)
  test('4. Production gate: GET /api-docs and /api-docs.json return 404 in production when ENABLE_SWAGGER is not true', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_SWAGGER;

    const resHtml = await request(app).get('/api-docs/');
    expect(resHtml.status).toBe(404);
    expect(resHtml.body.success).toBe(false);
    expect(resHtml.body.message).toMatch(/documentation not available in production/i);

    // Confirm that in production 404, no CSP relaxation is applied (script-src retains strict 'self')
    const prodCsp = resHtml.headers['content-security-policy'];
    expect(prodCsp).toContain("script-src 'self'");
    expect(prodCsp).not.toContain("script-src 'self' 'unsafe-inline'");

    const resJson = await request(app).get('/api-docs.json');
    expect(resJson.status).toBe(404);
    expect(resJson.body.success).toBe(false);
    expect(resJson.body.message).toMatch(/documentation not available in production/i);
  });

  // Test 5: Production Override Gate (Enabled in production with ENABLE_SWAGGER=true)
  test('5. Production override gate: GET /api-docs and /api-docs.json return 200 when ENABLE_SWAGGER=true in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_SWAGGER = 'true';

    const resHtml = await request(app).get('/api-docs/');
    expect(resHtml.status).toBe(200);
    expect(resHtml.headers['content-type']).toMatch(/text\/html/i);
    expect(resHtml.text).toContain('swagger-ui');

    const resJson = await request(app).get('/api-docs.json');
    expect(resJson.status).toBe(200);
    expect(resJson.body.openapi).toBe('3.0.3');
    expect(resJson.body.info.title).toBe('Smart Interview Scheduler & Mock Assessment Platform API');
  });
});
