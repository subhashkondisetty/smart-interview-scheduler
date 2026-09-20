# Project Status: Smart Interview Scheduler & Mock Assessment Platform

## Completed Phases
- **Phase 0: Workspace Scaffolding & Configuration**
  - Workspace directory structure established for `server/` and `client/`.
  - Initialized `package.json` with dependencies for both backend and frontend.
  - Configured `.env.example` templates for both server and client.
  - Setup root `.gitignore` protecting secrets, dependencies, and uploads.
  - Scaffolded empty architecture folders ready for phase implementations.
- **Phase 1 (Part 1): Database Connectivity & Mongoose Scaffolding**
  - Implemented `server/config/db.js` with `MONGODB_URI` connection, host/db startup logging, and graceful process shutdown.
  - Wired database connection into `server.js` startup lifecycle.
  - Implemented `server/utils/baseSchemaPlugin.js` registered globally on Mongoose to enforce `timestamps: true` and strip `__v` and `password` on JSON/object transformations.
  - Verified with automated Jest tests (`tests/db.test.js`).
- **Phase 2 (Part 1): User Model, Authentication & Invalidation Strategy**
  - Implemented `User` model with email validation, bcrypt password hashing, `comparePassword`, and JWT generation.
  - Implemented `authenticate` and `authorize` RBAC middleware with token expiry and post-logout invalidation checks.
  - Implemented request body validation (`validateRegister`, `validateLogin`).
  - Implemented centralized error handler (`errorHandler`) and `asyncHandler` wrapper.
  - Auth endpoints implemented and mounted: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - Comprehensive automated tests with Jest & Supertest (`tests/auth.test.js`, `tests/userModel.test.js`).
- **Phase 2 (Part 2): Role-Based Access Control (RBAC) Middleware**
  - Implemented standalone `requireRole` middleware factory (`server/middleware/roleMiddleware.js`).
  - Mounted verification endpoints: `GET /api/admin/ping` and `GET /api/candidate/ping`.
  - Automated tests verifying 403 on role mismatch, 200 on authorized role, and 401 on missing token (`tests/roleMiddleware.test.js`).
- **Phase 3 (Part 1): CandidateProfile & Ownership Enforcement**
  - Implemented `CandidateProfile` model with contact details, headline/bio, skills, education, experience, and pre-save `profileCompletionPercentage` calculation.
  - Implemented `GET /api/candidate/profile` and `PUT /api/candidate/profile` strictly derived from `req.user.id`.
  - Implemented input validation with `validateProfileUpdate`.
  - Automated tests verifying profile CRUD, completion score updates, and prevention of horizontal privilege escalation (`tests/candidateProfile.test.js`).
- **Phase 3 (Part 2): Resume Upload & File Management**
  - Configured Multer upload pipeline (`server/middleware/upload.js`) supporting PDF/DOC/DOCX, UUID filename sanitization, dynamic `MAX_FILE_SIZE_MB` limit, and unread stream draining.
  - Storage established in `server/uploads/resumes` (gitignored).
  - Implemented `POST /api/candidate/profile/resume` (replace-if-exists with old file deletion on disk).
  - Implemented `DELETE /api/candidate/profile/resume` (removes file from filesystem and resets completion score).
  - Implemented `GET /api/candidate/profile/resume` (retrieval/download strictly scoped to authenticated candidate).
  - Automated tests covering valid upload, oversized files, invalid MIME types, cleanup on replace, and ownership isolation (`tests/candidateResume.test.js`).
- **Phase 4 (Part 1): InterviewSlot Model & Overlap Prevention Engine**
  - Implemented `InterviewSlot` model with timestamps, capacity, booked count, status tracking, and admin reference.
  - Implemented admin-only CRUD: `POST /api/admin/interview-slots`, `GET /api/admin/interview-slots`, `GET /api/admin/interview-slots/:id`, `PUT /api/admin/interview-slots/:id`, `DELETE /api/admin/interview-slots/:id`.
  - Implemented candidate discovery endpoint: `GET /api/interview-slots` filtering future available slots (`status === 'available'`, `startTime > now`, `bookedCount < capacity`).
  - Implemented `server/validators/interviewSlotValidator.js` rejecting past-dated times and invalid duration/capacity.
  - Enforced mathematical overlap prevention for non-cancelled slots.
  - Automated test suite validating CRUD, role protection, past-date rejection, overlap prevention, and candidate discovery (`tests/interviewSlot.test.js`).
- **Phase 4 (Part 2): InterviewBooking Model, Endpoints & Atomic Capacity Guard**
  - Implemented `InterviewBooking` model with status lifecycle (`confirmed`, `cancelled`, `completed`, `rescheduled`), candidate and slot references.
  - Implemented `POST /api/candidate/bookings` with atomic capacity check (`findOneAndUpdate` with `$expr: { $lt: ['$bookedCount', '$capacity'] }`), preventing duplicate active candidate bookings.
  - Implemented `GET /api/candidate/bookings` (own booking history) and `GET /api/admin/bookings` (admin management with filters).
  - Implemented `PATCH /api/candidate/bookings/:id/cancel` releasing slot capacity and restoring status to available.
  - Implemented `PATCH /api/candidate/bookings/:id/reschedule` atomically claiming the new slot and freeing the old slot.
  - Automated tests validating duplicate-booking rejection, cancellation, rescheduling, ownership isolation, and simulated concurrent double-booking race condition (`tests/interviewBooking.test.js`).
- **Phase 5 (Part 1): Nodemailer Email Service & Non-Blocking Notification Pipeline**
  - Implemented `server/services/emailService.js` supporting environment-driven SMTP (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`).
  - Added HTML templates for registration welcome, booking confirmation, cancellation, reschedule, assessment completion, and interview reminder.
  - Hooked non-blockingly into `register`, `bookSlot`, `cancelBooking`, and `rescheduleBooking`.
  - Automated tests verifying mailer mock calls on booking creation and complete fault tolerance during SMTP failure (`tests/emailService.test.js`).
- **Phase 4 (Part 3): Assessment Model & Publishing Lifecycle Engine**
  - Implemented `Assessment` model with title, description, difficulty, durationMinutes, passingPercentage, maxAttempts, isPublished, and createdBy admin.
  - Implemented admin CRUD: `POST /api/admin/assessments`, `GET /api/admin/assessments`, `GET /api/admin/assessments/:id`, `PUT /api/admin/assessments/:id`, `DELETE /api/admin/assessments/:id`, and `PATCH /api/admin/assessments/:id/publish` (toggle publish state).
  - Implemented candidate-facing discovery: `GET /api/assessments` and `GET /api/assessments/:id` strictly filtering `isPublished: true`.
  - Input validation for assessment properties (`server/validators/assessmentValidator.js`).
  - Automated test suite validating CRUD, validation errors, role protection, and the published-only candidate visibility rule (`tests/assessment.test.js`).
- **Phase 4 (Part 4): Question Model, Question Management & Candidate Answer Stripping**
  - Implemented `Question` model linked to `Assessment` with `text`, `options` (min 2), `correctOptionIndex`, `explanation`, `marks`, `topic`, and `difficulty`.
  - Implemented admin-only CRUD: `POST /api/admin/assessments/:assessmentId/questions`, `GET /api/admin/assessments/:assessmentId/questions`, `GET /api/admin/assessments/:assessmentId/questions/:id`, `PUT /api/admin/assessments/:assessmentId/questions/:id`, `DELETE /api/admin/assessments/:assessmentId/questions/:id`.
  - Implemented candidate-facing question delivery: `GET /api/assessments/:id/questions` restricted to published assessments.
  - Enforced candidate answer key secrecy via dual defense-in-depth: Mongoose projection exclusion (`.select('-correctOptionIndex -explanation')`) plus in-memory sanitization ensuring `correctOptionIndex` and `explanation` are never leaked in candidate payloads.
  - Implemented input validation with `validateQuestionCreate` and `validateQuestionUpdate`.
  - Automated tests validating question CRUD, validation bounds, role protection, and raw JSON assertions verifying answer key absence (`tests/question.test.js`).
- **Phase 4 (Part 5): AssessmentAttempt Model, Scoring Engine & Concurrency Controls**
  - Implemented `AssessmentAttempt` model with candidate ref, assessment ref, attempt number, start/expiry/end timestamps, status lifecycle (`in_progress`, `completed`, `expired`), evaluated answers, score, total marks, percentage, passed status, and topic-wise performance breakdown.
  - Configured single partial unique index on `{ candidateId: 1, assessmentId: 1 }` with `partialFilterExpression: { status: 'in_progress' }`, guaranteeing at most one active attempt per candidate per assessment without limiting accumulated completed/expired attempts.
  - Implemented `POST /api/candidate/assessments/:id/start` with published assessment verification, on-access auto-expiry, active attempt resumption, `maxAttempts` enforcement, and MongoDB duplicate-key error (`11000`) intercept handling.
  - Implemented `POST /api/candidate/attempts/:attemptId/submit` with question-driven scoring engine iterating strictly over database-persisted questions, out-of-range option index normalization to unanswered state, and atomic `findOneAndUpdate` status transition preventing duplicate submissions and double emails.
  - Implemented candidate attempt history (`GET /api/candidate/attempts`) and detail (`GET /api/candidate/attempts/:attemptId`) endpoints with ownership verification.
  - Implemented scheduled auto-expiry service (`server/services/cronService.js`) using `node-cron` running every 2 minutes with clean server lifecycle start/stop integration.
  - Comprehensive automated test suite with 11 test cases validating score accuracy, expiry rejection, attempt limits, forged score immunity, concurrent start/submit race handling, foreign question resistance, and out-of-range index normalization (`tests/assessmentAttempt.test.js`).
- **Phase 4 (Part 6): Candidate Assessment Result, History & Topic-Wise Analytics**
  - Implemented detailed attempt result endpoint: `GET /api/candidate/attempts/:attemptId/result`, returning computed `score`, `percentage`, `correctCount`, `incorrectCount`, `unansweredCount`, `timeTakenSeconds`, `timeTakenMinutes`, `passed` status, and populated assessment metadata. Enforces ownership isolation (403 for other candidates) and returns 400 for active, unexpired attempts.
  - Implemented candidate attempt history endpoint: `GET /api/candidate/assessments/history`, returning all finalized attempts (`completed` and `expired`) chronologically descending with attempt metrics and assessment details, filtered strictly to `req.user.id`.
  - Implemented candidate topic-wise performance aggregation: `GET /api/candidate/performance/topic-wise`, aggregating question accuracy and marks per topic across all completed attempts for the authenticated candidate.
  - Extracted single source-of-truth scoring logic into `server/services/scoringService.js`: `computeAttemptScore` evaluates answers against database questions, awards marks, handles out-of-range indices as unanswered, and dynamically derives percentage, passed status, and topic breakdowns.
  - Unified expiry finalization: `finalizeExpiredAttempt` in `scoringService.js` calculates derived percentage and passed status dynamically (never hardcoding 0 or false), sets `endTime = attempt.expiresAt` consistently, and uses atomic `findOneAndUpdate({ _id: attempt._id, status: 'in_progress' }, ...)` with fallback re-fetch to eliminate race conditions between cron sweeps and on-access callers.
  - Updated background cron worker (`server/services/cronService.js`) and on-access checks across start, submit, result, and history endpoints to use `finalizeExpiredAttempt`.
  - Comprehensive automated test suite with 8 test cases validating detailed result metrics, on-access expiry scoring, cross-candidate 403 isolation, active attempt guard, history listing, topic-wise aggregation and exclusion of expired attempts, and concurrent expiry race protection (`tests/candidateAnalytics.test.js`).
- **Phase 1 (Part 8) & Phase 3 (Part 3): Notification Model, In-App Notification System & Event Pipeline**
  - Implemented `Notification` model with `userId`, `type`, `message`, `isRead`, `timestamps: true`, and compound indexes on `{ userId: 1, createdAt: -1 }` and `{ userId: 1, isRead: 1 }`.
  - Implemented `GET /api/notifications`: paginated retrieval (`page`, `limit`), filtering (`isRead`), total counts, page metadata, and `unreadCount`. Strictly scoped to `req.user.id`.
  - Implemented `PATCH /api/notifications/:id/read`: marks single notification as read. Scoped to `{ _id, userId }` returning 404 uniformly if not found or belonging to another user, eliminating ID enumeration.
  - Implemented `PATCH /api/notifications/read-all`: marks all unread notifications for authenticated user to `isRead: true`.
  - Implemented single canonical admin broadcast route: `POST /api/admin/notifications/broadcast` (`requireRole('admin')`), creating in-app announcements for all candidates or users in bulk.
  - Event hooks integrated seamlessly:
    - Interview booking: `'booking_confirmed'`, `'booking_cancelled'`, `'booking_rescheduled'`.
    - Assessment submission: `'assessment_completed'` dispatched on winning atomic submission branch.
    - Assessment auto-expiry: `'assessment_expired'` dispatched strictly on the winning branch of `finalizeExpiredAttempt`'s atomic `findOneAndUpdate` guard, preventing duplicate notifications during cron/on-access races.
  - Comprehensive automated test suite with 11 test cases validating pagination, filtering, ownership isolation, anti-enumeration 404, read-all, canonical admin broadcast, booking/assessment hooks, and concurrent expiry race protection (`tests/notification.test.js`).
- **Phase 3 (Part 4): Candidate Dashboard Aggregation Endpoint**
  - Implemented `GET /api/candidate/dashboard` consolidating candidate onboarding and progress metrics in a single payload.
  - Aggregates profile completion percentage (`CandidateProfile.user`), next upcoming interview (`InterviewBooking.candidate` where `slot.startTime > now`), last 5 recent assessment attempts (`AssessmentAttempt.candidateId`), average score & average percentage across completed attempts, count of unread notifications (`Notification.userId`), and dynamic pending actions list (`'Incomplete profile'`, `'No resume uploaded'`, `'In-progress assessment pending completion'`).
  - Integrated on-access expiry sweep executing `finalizeExpiredAttempt` with authentic question-driven scoring before calculating dashboard KPI numbers.
  - Enforced schema-verified query field mappings across models (`user` on CandidateProfile, `candidate` on InterviewBooking, `candidateId` on AssessmentAttempt, `userId` on Notification, and nested `resume.url` presence check).
  - Comprehensive automated test suite with 8 test cases validating aggregate shape correctness, pending actions, earliest upcoming interview selection, average score calculation, 5-item attempt cap, on-access expiry, and RBAC/ownership isolation (`tests/candidateDashboard.test.js`).
- **Phase 4 (Part 7): Admin Dashboard Aggregation & Platform Analytics Endpoint**
  - Implemented `GET /api/admin/dashboard` aggregating platform-wide KPI metrics, interview pipelines, assessment performance statistics, and activity feeds into a unified administrative view.
  - Aggregates total candidate count (`User.role === 'candidate'`), total interviews scheduled (`upcoming + completed`), assessment statistics (published assessment count, total assessments, total attempts, completed attempts count, platform average score and percentage across completed attempts), and detailed booking status breakdown.
  - Formulated mutually-exclusive booking/interview partitioning (Architectural Decision #19) eliminating double-counting and contradictions between raw booking statuses and temporal interview states: `upcoming` (confirmed with future slot time), `completed` (explicitly completed or confirmed with past/missing slot time), `cancelled`, and `rescheduled`. Strictly guarantees `upcoming + completed + cancelled + rescheduled === totalBookings`.
  - Implemented null-safe slot fallback protecting against deleted or unpopulated `InterviewSlot` references, routing orphaned confirmed bookings safely into `completed` without crashing or throwing `TypeError`.
  - Implemented unified, timestamp-sorted recent activity feed merging candidate registrations, interview bookings, and assessment attempts with customizable, clamped `?limit=N` parameter (default 10, max 50).
  - Comprehensive automated test suite with 9 test cases validating aggregate shape correctness, mathematical partitioning invariants, confirmed future/past temporal partitioning, orphaned booking/null-slot resilience, activity feed assembly and descending order, feed limit clamping, empty platform handling, on-access expiry sweep execution, and admin/candidate/unauthorized RBAC protections (`tests/adminDashboard.test.js`).

- **Phase 5 (Part 2): Security Hardening, Defenses & Vulnerability Remediation**
  - Conducted comprehensive defensive backend audit across authentication, authorization, input validation, NoSQL injection vectors, CORS, Helmet, rate limiting, file upload security, error handling leakage, sensitive fields exposure, and JWT handling.
  - Implemented `helmet` middleware configuring secure HTTP headers (X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, X-DNS-Prefetch-Control, HSTS).
  - Implemented strict `cors` policy with origin allowlisting (`CLIENT_URL` / local dev ports), credentials support, and restricted HTTP methods/headers.
  - Implemented dual-tier rate limiting via `express-rate-limit`: general API rate limiter (100 req / 15 min) and strict authentication rate limiter (10 attempts / 15 min) on `/api/auth/login` and `/api/auth/register` (bypassed in test environments).
  - Enforced strict payload size limits (`10kb` for JSON and URL-encoded bodies) to mitigate denial-of-service memory exhaustion attacks.
  - Implemented recursive NoSQL query injection sanitization middleware stripping keys starting with `$` or containing `.` from `req.body`, `req.query`, and `req.params`.
  - Hardened error handling in `server/middleware/errorHandler.js`: eliminated user input reflection in Mongoose `CastError` responses (CWE-209), and enforced production 500 error message masking to prevent internal driver/database leakage.
  - Enforced production JWT secret strength assertions in `server/server.js` (requires at least 32 characters in production).
  - Comprehensive automated security test suite with 6 test cases verifying Helmet headers, CORS headers, 413 payload size limiting, NoSQL injection stripping, CastError sanitization, and production error masking (`tests/securityHardening.test.js`).

- **Phase 5 (Part 3): Test Suite Hardening & Domain Regression Coverage**
  - Conducted comprehensive test coverage review across 8 critical domain areas: register, login, authentication, authorization, profile ownership, booking (including duplicate/race), assessment attempt + scoring, and admin-only access.
  - Added 26 targeted unit and integration tests addressing edge case gaps:
    - **Register**: enforced immutable candidate role assignment against privilege escalation attempts (`role: 'admin'`) and validated lowercase/whitespace email normalization (`tests/auth.test.js`).
    - **Login**: verified 403 rejection for deactivated accounts (`isActive: false`) and 400 validation error responses for missing credentials (`tests/auth.test.js`).
    - **Authentication**: verified 401 on deleted user tokens, 403 on deactivated account tokens accessing protected endpoints, and 401 on expired JWTs via `TokenExpiredError` (`tests/auth.test.js`).
    - **Authorization**: verified `authorize` and `requireRole` middleware standalone behaviors and asserted safe 401/403 failure modes when `req.user` is absent (`tests/roleMiddleware.test.js`).
    - **Profile Ownership**: verified auto-initialization on update without ownership bypass, 404 on missing resume file on disk, and ownership isolation (`tests/candidateProfile.test.js`, `tests/candidateResume.test.js`).
    - **Booking**: verified slot rollback and 409 Conflict upon code `11000` duplicate key on `InterviewBooking.create()`, 404 on nonexistent booking cancel/reschedule/booking, 403 on cross-candidate reschedule, 400 on non-confirmed reschedule, 400 on same-slot reschedule, 409 on fully booked target slots, and query filter propagation for admin bookings (`tests/interviewBooking.test.js`).
    - **Assessment Attempt & Scoring**: verified active `in_progress` attempt resumption returning 200 without duplicate creation, 400 on malformed ObjectIds, 404 on nonexistent attempts, stale in-progress auto-finalization on start, concurrent start duplicate-key code 11000 race recovery, atomic submit status transition guard (`!updatedAttempt`), missing assessment 404, candidate attempts history listing, and unauthorized attempt access isolation (`tests/assessmentAttempt.test.js`).
    - **Admin-Only Access**: implemented systematic route matrix test asserting 403 Forbidden for candidates and 401 Unauthorized for unauthenticated requests across all administrative endpoints (`tests/roleMiddleware.test.js`).
  - Total automated test count expanded to 170 passing tests across 17 test suites (100% pass rate, 0 open handles), achieving 98.63% line coverage on `assessmentAttemptController.js` and 91.75% line coverage on `interviewBookingController.js` (with all compensating rollbacks and race recovery paths fully tested), and 100% line coverage for core authentication and authorization middleware (`auth.js`, `roleMiddleware.js`).

- **Phase 5 (Part 4): Swagger / OpenAPI 3.0.3 Documentation & CSP Isolation**
  - Authored comprehensive OpenAPI 3.0.3 specification (`server/docs/swaggerSpec.js`) strictly covering all 37 distinct endpoint paths and 50 operations across Authentication, Admin, Candidate, Public Discovery, Notifications, and System Health.
  - Derived all request body schemas, parameters, and status codes directly from real controller code and test assertions:
    - `PATCH /api/notifications/:id/read`: uniform 404 anti-enumeration behavior.
    - Booking & reschedule matrix: 400 (invalid state/race), 403 (ownership), 404 (not found), 409 (capacity/duplicate collision), 200/201 (success).
    - Assessment attempt matrix: 200 (in-progress attempt resumption), 400 (expired/atomic guard transition lost race), 403 (ownership), 404 (not found).
  - Mounted Swagger UI at `/api-docs` and raw spec at `/api-docs.json` with strict route-level CSP relaxation (`'unsafe-inline'` strictly scoped to documentation routes; global routes retain strict `script-src 'self'`).
  - Gated documentation behind environment check (`NODE_ENV !== 'production' || ENABLE_SWAGGER === 'true'`), returning 404 in production with zero CSP relaxation when disabled.
  - Added automated test suite (`tests/swaggerDocs.test.js`) verifying spec completeness, UI HTML serving, CSP header isolation between routes, and production gating.
  - Expanded total test count to 175 passing tests across 18 test suites (100% pass rate, 0 open handles).

- **Phase 6: Frontend Client Architecture & Core Components**
  - Configured client environment variables with `VITE_API_BASE_URL` in `client/.env`.
  - Implemented centralized Axios instance (`client/src/services/api.js`) with request interceptors for JWT Bearer attachment and deduplicated response interceptor for 401 Unauthorized handling via a custom window event (`auth:session-expired`).
  - Implemented `authService.js` supporting `login`, `register`, `logout`, and `getCurrentUser` (`GET /api/auth/me`).
  - Implemented `AuthContext.jsx` and `useAuth` hook managing authentication state (`user`, `token`, `loading`, `isAuthenticated`, `isAdmin`, `isCandidate`), automatic session restoration on mount/refresh, and single-flight listener for session-expired events with redirection to `/login` with flash message.
  - Implemented route protection guards: `ProtectedRoute` requiring authentication and `AdminRoute` requiring admin role with concrete redirect to `/forbidden`.
  - Implemented responsive, role-aware layout components: `PublicLayout`, `CandidateLayout`, and `AdminLayout` with brand identity, active link highlighting, user email badge, and functional logout controls.
  - Created 17 structured placeholder stub pages wired directly into React Router:
    - Public: `HomePage`, `LoginPage`, `RegisterPage`, `PublicSlotsPage`, `PublicAssessmentsPage`, `ForbiddenPage` (403), `NotFoundPage` (404).
    - Candidate: `CandidateDashboardPage`, `CandidateProfilePage`, `AvailableSlotsPage`, `MyBookingsPage`, `CandidateAssessmentsPage`, `TakeAssessmentPage`, `AssessmentResultPage`, `CandidateHistoryPage`, `NotificationsPage`.
    - Admin: `AdminDashboardPage`, `AdminSlotsPage`, `AdminBookingsPage`, `AdminAssessmentsPage`, `AdminQuestionsPage`, `AdminBroadcastPage`.
  - Established a comprehensive CSS design system (`client/src/index.css`) covering layout grids, navigation bars, buttons, forms, alert banners, metric cards, status pages, and loading spinners.
  - Verified clean production build (`npm run build` transforms 117 modules in 1.6s with 0 errors) and regression safety across all 18 backend test suites (175 tests, 0 open handles).
  - Automated Browser Runtime Verification (`client/scripts/verify-runtime-auth.js` via `npm run verify:auth`):
    - Created an end-to-end browser verification suite using `puppeteer-core` driving headless Chrome with a real-time mock backend on port 5000 and Vite dev server on port 5173.
    - **Test 1 (Session Expiry & Event Bridge)**: Verified candidate login, direct token corruption in `localStorage`, authenticated API call trigger, automatic dispatch and reception of `auth:session-expired`, in-memory state purging, and redirect to `/login` with the session-expired banner (`alert-warning` showing "Your session has expired. Please log in again.") with 0 unhandled rejections.
    - **Test 2 (AdminRoute Enforcement & /forbidden Isolation)**: Verified candidate login, direct navigation attempt to `/admin/dashboard`, immediate redirect to `/forbidden`, rendering of the 403 Forbidden card with return navigation, and 0% administrative layout or content leakage.
    - **Test 3 (Session Restoration on Refresh)**: Verified browser tab reload for candidate and admin sessions; both sessions successfully restore user state via `GET /api/auth/me`, maintain target routes (`/candidate/dashboard`, `/admin/dashboard`), render correct role navigation bars, and experience zero flickering or accidental redirects.
    - Overall runtime test suite status: **100% Passed (3/3 test scenarios, 0 uncaught exceptions)**.

## Current Phase
- **Phase 9: Frontend Audit, End-to-End Integration, Verification & Deployment Prep**

## Remaining Tasks
- **Phase 2: Authentication & Authorization Extensions**
  - [x] Password reset workflows (Forgot/Reset password with Nodemailer, anti-enumeration generic response, SHA-256 token hashing, 15-minute expiry, single-use token lifecycle, and authLimiter integration).
- **Phase 4: Admin Features Backend**
  - [x] Candidate management, booking management (extended).
  - [x] Admin view of candidate results and analytics.
- **Phase 5: Email & Notification Services, Security & API Documentation**
  - [x] Swagger / OpenAPI documentation (Completed).
  - [x] Jest + Supertest test suites (Completed - 183 tests across 19 suites).
- **Phase 6: Frontend Client Architecture & Core Components**
  - [x] Layouts, context providers (AuthContext), Axios instance with token interceptors.
  - [x] Common UI components, route protection guards, and routing structure.
- **Phase 7: Candidate Client Implementation**
  - [x] Pages: Landing (`/`), Register (`/register`), Login (`/login`), Forgot Password (`/forgot-password`), Reset Password (`/reset-password/:token`).
  - [x] Candidate Profile (`/candidate/profile`): Full view/edit profile fields, interactive skills chip manager, multi-entry education list manager, live optimistic completion percentage display, resume upload/replace/delete with progress bar and exact client-side validation mirroring Multer backend rules.
  - [x] Interview Slots (`/candidate/slots`), Interview Details (`/candidate/bookings/:id`), My Interviews (`/candidate/bookings`): Browse & filter open slots with capacity badges, booking modal with notes, My Interviews list with status tabs, cancel/reschedule actions with collision protection, active video meeting rooms, and differentiated backend error surfacing.
  - [x] Assessment Listing (`/candidate/assessments`), Details Modal, and Take Assessment Arena (`/candidate/assessments/:id/take`): Browse published quizzes, difficulty filtering, attempt quotas, active in-progress detection, sanitized question delivery with answer secrecy, per-attempt countdown timer synchronized against server HTTP Date header, question palette, manual submit with breakdown, and auto-submit on expiry.
  - [x] Assessment Result (`/candidate/attempts/:attemptId/result`), Assessment History & Topic Analytics (`/candidate/history`): Detailed score reports, pass/fail status banner, accuracy metrics, topic breakdown cards, question outcomes, chronological attempt history with status filters, and aggregated topic mastery analytics honoring Architectural Decision #15.
  - [x] Candidate Dashboard (`/candidate/dashboard`), Notifications (`/candidate/notifications`).
- **Phase 8: Admin Client Implementation**
  - [x] Pages: Admin Dashboard, Manage Candidates, Manage Interview Slots, Manage Bookings, Manage Assessments, Question Management, Candidate Results, Admin Notifications.
- **Phase 9: End-to-End Integration, Verification & Deployment Prep**
  - [x] Frontend Consistency, Accessibility & Shared Component Audit.
  - [x] Cross-role verification, test runs, build verification for production deployment.
  - [x] Production-Readiness Audit across 10 architectural dimensions.

- **Phase 7 (Part 2): Candidate Interview Workflows (Available Slots, My Interviews & Interview Details)**
  - Implemented `client/src/pages/candidate/AvailableSlotsPage.jsx` (`/candidate/slots`):
    - Browse available future interview slots fetched from `GET /api/interview-slots`.
    - Keyword search filtering across slot titles, interviewer names, and descriptions.
    - Duration filters (30, 45, 60 minutes) and date range filters (All Upcoming, Today Only, Next 7 Days).
    - Capacity indicators dynamically displaying remaining seats (`X of Y spots open`) or disabled state (`✕ Fully Booked`).
    - Booking modal with candidate session notes (up to 500 characters), loading indicator, confirmation view, and differentiated error surfacing.
  - Implemented `client/src/pages/candidate/MyBookingsPage.jsx` (`/candidate/bookings`):
    - Metrics summary strip displaying total sessions, upcoming confirmed, completed, and cancelled bookings.
    - Status filter tabs (`All`, `Upcoming`, `Completed`, `Cancelled`, `Rescheduled`) with live count badges.
    - Booking cards with status badges, interviewer details, time window badges, session focus notes preview, and direct "Open Meeting Link" shortcuts.
    - Cancel Confirmation Modal (`PATCH /api/candidate/bookings/:id/cancel`) with capacity release confirmation and atomic error handling.
    - Reschedule Modal (`PATCH /api/candidate/bookings/:id/reschedule`) fetching alternative available slots (excluding the current slot), candidate notes update, and collision handling.
  - Implemented `client/src/pages/candidate/InterviewDetailsPage.jsx` (`/candidate/bookings/:id`):
    - Breadcrumb navigation (`← Back to My Interviews`), session title, and status pill.
    - Video Conference Room card: active link for confirmed sessions with "Copy Link" visual feedback and pre-session preparation checklist; inactive banner for cancelled/rescheduled sessions.
    - Detailed schedule card (date, time range, duration, topics covered) and interviewer profile card.
    - Candidate session focus notes card and lifecycle timeline (`Booking Created`, `Booking Cancelled`, `Rescheduled`).
    - In-page Cancel Booking modal for confirmed upcoming interviews.
  - Implemented `client/src/services/interviewService.js`:
    - Full service wrapper for `getAvailableSlots`, `bookSlot`, `getCandidateBookings`, `getBookingById`, `cancelBooking`, and `rescheduleBooking`.
    - Centralized `classifyBookingError(err)` helper parsing HTTP status codes (400, 403, 404, 409) and error messages into structured error categories with distinct, user-tailored guidance and action links.
  - Registered `/candidate/bookings/:id` in `client/src/App.jsx` and added comprehensive styles in `client/src/index.css`.
    - Added `"verify:interviews"` and `"verify:interviews:real"` scripts in `client/package.json`. Created `client/scripts/verify-candidate-interviews.js` (26/26 mock suite tests) and `client/scripts/verify-real-backend-interviews.js` (19/19 tests against real Express server, real Mongoose models, and real MongoDB engine).
- **Phase 7 (Part 3): Candidate Assessment Workflows (Catalog, Details Modal & Take Assessment Arena)**
  - Implemented `client/src/pages/candidate/CandidateAssessmentsPage.jsx` (`/candidate/assessments`):
    - Catalog browsing published assessments fetched from `GET /api/assessments`.
    - Search input and difficulty filtering (`All`, `Beginner`, `Intermediate`, `Advanced`).
    - Assessment cards with duration, passing score percentage, attempt quotas (computed against candidate attempt history), and prominent "⚡ Resume In-Progress Attempt" buttons when an active attempt is detected.
    - Assessment Details Modal displaying test criteria, time limits, rules, and initiating attempts via `POST /api/candidate/assessments/:id/start`.
  - Implemented `client/src/pages/candidate/TakeAssessmentPage.jsx` (`/candidate/assessments/:id/take`):
    - Authoritative mount lifecycle: calls `getAttemptById` or `startAssessmentAttempt`, asserting the presence and validity of the HTTP `Date` header, and halts immediately if the attempt is already expired/finalized server-side.
    - Per-attempt countdown timer synchronized to backend-computed `expiresAt` and continuously evaluated against `(Date.now() + clockSkew)` for complete client clock tampering immunity.
    - Color-coded urgency styling (Green normal, Amber < 5 min, Red pulsing < 1 min).
    - Question navigation with "← Previous", "Next →", "Clear Choice", and "Flag for Review" toggling.
    - Interactive Question Palette sidebar indicating status (Answered with checkmark, Flagged with flag icon, Unanswered, and Current Active focus ring) with jump-to functionality and summary tally.
    - Manual Submission with confirmation modal displaying answered vs unanswered counts and zero-mark warnings.
    - Auto-Submission on timer expiry (`remainingMs <= 0`), automatically submitting candidate answers and gracefully navigating to results.
  - Implemented `client/src/services/assessmentService.js`:
    - Full service methods for published assessments, sanitized questions, authoritative start/get attempt with CORS `Date` validation, manual/auto submission, attempt history, and error classification.
  - Configured `exposedHeaders: ['Date']` in Express CORS middleware (`server/app.js`).
  - Added `"verify:assessments:real"` script in `client/package.json` and created `client/scripts/verify-real-backend-assessments.js` (26/26 tests passing against real Express server, real Mongoose models, and real MongoDB database engine).
- **Phase 7 (Part 4): Candidate Assessment Results, Attempt History & Topic Performance Analytics**
  - Implemented `client/src/pages/candidate/AssessmentResultPage.jsx` (`/candidate/attempts/:attemptId/result`):
    - Connects directly to `GET /api/candidate/attempts/:attemptId/result`.
    - Hero Result Banner: color-coded status styling (Passed in green, Not Passed in red, Expired in amber), score and percentage display (`X / Y marks`, `Z%`), and passing threshold requirements note.
    - Performance Metrics Grid: correct answers, incorrect answers, unanswered count, time taken, and allocated duration.
    - Topic-Wise Performance Breakdown: individual topic cards with mastery level badges (`Strong` ≥ 80%, `Proficient` ≥ 60%, `Needs Practice` < 60%), accuracy percentage, marks scored, and visual progress bars.
    - Question-by-Question Evaluation Review: comprehensive table showing question index, topic tag, outcome (Correct, Incorrect, Unanswered), and marks awarded (`+N Marks` or `0`).
    - Flash submission feedback banner capturing redirect messages from manual submission or auto-submit expiry.
    - Quick actions to view attempt history or browse assessments.
  - Implemented `client/src/pages/candidate/CandidateHistoryPage.jsx` (`/candidate/history`):
    - Parallel data fetching on mount: `getAssessmentHistory()` (`GET /api/candidate/assessments/history`) and `getTopicWisePerformance()` (`GET /api/candidate/performance/topic-wise`).
    - Top Summary KPI Strip: Total Attempts recorded, Overall Pass Rate (%), Average Score (%) across completed attempts (aligning with Candidate Dashboard and Decision #15), and Strongest Domain (highest accuracy topic).
    - Tab Switcher: "Attempt History" and "Topic Performance".
    - Attempt History Tab:
      - Filter pills: `All`, `Completed`, `Expired`, `Passed`, `Failed` with live counts.
      - Chronological attempt cards with assessment title, difficulty pill, attempt number, status badges (`Completed`, `Expired`), pass/fail badges (`Passed`, `Not Passed`), time taken, date, score/marks, and direct link to full score report (`/candidate/attempts/:attemptId/result`).
    - Topic Performance Tab:
      - Topic mastery cards with mastery level badge, accuracy percentage, visual progress bars, marks scored, and questions accuracy ratio.
      - Informational guidance note on scoring policy: explains that topic metrics aggregate completed attempts only, excluding expired/abandoned attempts per Architectural Decision #15.
  - Updated `client/src/services/assessmentService.js`:
    - Updated `getAttemptResult(attemptId)` to extract `response.data?.data?.result` (with fallback to `attempt`).
    - Added `getAssessmentHistory()` calling `GET /api/candidate/assessments/history`.
    - Added `getTopicWisePerformance()` calling `GET /api/candidate/performance/topic-wise`.
  - Added dedicated styling for results, metrics, topic progress bars, and attempt cards in `client/src/index.css`.
  - Added `"verify:analytics:real"` script in `client/package.json` and created `client/scripts/verify-real-backend-analytics.js` (27/27 tests passing against real Express server, real Mongoose models, and real MongoDB database engine, validating all result calculations, status filters, cross-navigation, and Decision #15 topic exclusion).
- **Phase 7 (Part 4): Notifications Center & Real-Time Action Toast System**
  - Implemented `client/src/context/ToastContext.jsx` providing a lightweight, non-blocking toast notification system (`ToastProvider`, `useToast` hook) with auto-dismissal (4000ms) and manual dismissal (`×` button), wrapped at the application root in `client/src/main.jsx`.
  - Implemented `client/src/services/notificationService.js` connecting directly to real backend notification endpoints:
    - `getUserNotifications(params)` -> `GET /api/notifications` (supports pagination and `isRead` query filter).
    - `markNotificationAsRead(id)` -> `PATCH /api/notifications/:id/read`.
    - `markAllAsRead()` -> `PATCH /api/notifications/read-all`.
  - Implemented `client/src/pages/candidate/NotificationsPage.jsx` (`/candidate/notifications`):
    - Exact backend notification type-to-icon mapping matching `server/models/Notification.js` (`booking_confirmed`, `booking_cancelled`, `booking_rescheduled`, `assessment_completed`, `assessment_expired`, `admin_broadcast`, `system`).
    - Unread count badge in page header and candidate navbar.
    - Filter tabs: 'All', 'Unread', 'Read' with real-time reactive counts.
    - Single mark-as-read action with optimistic UI update and database synchronization.
    - Batch mark-all-as-read action clearing unread status across all candidate notifications.
    - Paginated list navigation (`pagination.hasPrev`, `pagination.hasNext`, page indicator).
  - Integrated action toasts providing immediate feedback on key candidate lifecycle events:
    - Interview slot booked: `toast.success('Interview slot booked successfully!')` (`AvailableSlotsPage.jsx`).
    - Interview booking cancelled: `toast.info('Interview booking cancelled.')` (`MyBookingsPage.jsx`, `InterviewDetailsPage.jsx`).
    - Interview rescheduled: `toast.success('Interview rescheduled successfully!')` (`MyBookingsPage.jsx`).
    - Assessment manual submit: `toast.success('Assessment submitted successfully!')` (`TakeAssessmentPage.jsx`).
    - Assessment auto-submit on expiry: `toast.warning('Time expired! Your assessment was automatically submitted.')` (`TakeAssessmentPage.jsx`).
    - Notification mark-as-read: `toast.success('Notification marked as read')` / `toast.success('Marked N notifications as read')` (`NotificationsPage.jsx`).
  - Added live unread counter badge to candidate navbar in `CandidateLayout.jsx` with route-aware update on navigation.
  - Added `"verify:notifications:real"` script in `client/package.json` and created `client/scripts/verify-real-backend-notifications.js` (24/24 tests passing against real Express HTTP server and MongoDB in-memory engine, validating initial render, badge sync, filter tabs, single/batch mark-read DB mutations, and toast dismissals).
- **Phase 8 (Part 1): Admin Operations Dashboard & Lightweight Visual Analytics**
  - Implemented `client/src/services/adminService.js` (`getDashboardMetrics` with dynamic `limit` parameter).
  - Implemented lightweight zero-dependency SVG chart components in `client/src/components/charts/`:
    - `DonutChart.jsx`: Computes SVG circular arcs (`strokeDasharray`/`strokeDashoffset`) for interview booking breakdown (Upcoming, Completed, Cancelled, Rescheduled) with center total and interactive legend.
    - `ProgressBarChart.jsx`: Horizontal multi-bar metric comparison for assessment publication and completion rates.
    - `ScoreGaugeRing.jsx`: Circular progress gauge showing platform average score percentage and average marks.
  - Rebuilt `client/src/pages/admin/AdminDashboardPage.jsx` (`/admin/dashboard`):
    - Stat cards strip displaying 5 authoritative KPIs: Total Candidates, Scheduled Interviews, Live Assessments, Candidate Attempts, and Avg Test Score.
    - Direct consumption of authoritative `interviewStats.totalScheduled` directly from API response (avoiding duplicate client-side arithmetic drift).
    - Recent activity feed populated from `recentActivityFeed` with type icons/badges (👤 Registration, 📅 Interview Booking, 📝 Assessment Attempt).
    - Activity feed limit controls (5, 10, 25, 50).
    - Category filter pills (All, Registrations, Interviews, Assessments) with explicit contextual guidance note (*"Filtered from your most recent N total activity events. Increase the feed limit (up to 50) to see more historical events."*) and match counter (*"Showing X of Y"*).
    - Operations console shortcut links to `/admin/slots`, `/admin/bookings`, `/admin/assessments`, `/admin/questions`, and `/admin/broadcast`.
    - Loading skeletons, error handling, and manual refresh controls.
  - Designed responsive styling in `client/src/index.css`.
  - Created automated verification suite `client/scripts/verify-real-backend-admin-dashboard.js` (`npm run verify:admin:real`) validating 29/29 tests across all 5 scenarios against a real Express HTTP server and MongoDB in-memory engine.

## Known Issues / Flagged Backend Discrepancies
1. **`GET /api/admin/candidates` Unfiltered Status Return**:
   - `GET /api/admin/candidates` returns both active (`isActive: true`) and inactive/deactivated (`isActive: false`) candidate accounts when queried without a status filter. Callers must pass `?status=active` to view only active candidates. (Flagged for potential future refinement if default behavior should filter for active accounts only).

## Architectural Decisions
1. **Separation of Concerns**: Decoupled `server/` and `client/` folders designed for independent deployment (e.g., Render/Railway for backend, Vercel/Netlify for frontend).
2. **Backend as Source of Truth**: Frontend never trusted for roles, timestamps, slot availability, or assessment scoring. All validation and scoring are executed strictly on the backend.
3. **Environment Isolation**: API endpoints and secrets driven strictly by environment variables; no hardcoded URLs (no hardcoded `localhost:5000` in client code).
4. **Client Toolchain**: Modern React setup using Vite for fast compilation, HMR, and production bundling.
5. **Secure File Storage**: Resumes stored in `server/uploads` with sanitization, file-type checks (`pdf`, `doc`, `docx`), and size limits, excluded from version control.
6. **Global Mongoose Plugin**: All schemas inherit automatic `timestamps: true` and sanitization transforms (`toJSON` and `toObject` strip `__v` and `password` by default).
7. **Token Invalidation Strategy**: `User.lastLogoutAt` timestamp tracking. When a user logs out via `POST /api/auth/logout`, `lastLogoutAt` is updated on the user record. On incoming requests, `authenticate` middleware compares token issuance (`decoded.iat * 1000`) against `lastLogoutAt.getTime()`. Any token issued prior to the last logout is rejected with 401 Unauthorized, achieving stateless yet instant token revocation without maintaining an ever-growing token blacklist.
8. **Context-Derived Ownership Enforcement**: Candidate-owned resources (such as profile, bookings, attempts) strictly bind ownership to the verified `req.user.id`. Any user ID or profile ID injected via request bodies or query parameters is intentionally ignored, preventing horizontal authorization bypasses.
9. **Interview Slot Overlap Prevention Rule**: For a given interviewer/admin (`createdBy: adminId`), any newly created or modified slot with interval `[newStartTime, newEndTime]` is checked against all existing non-cancelled slots (`status !== 'cancelled'`). Overlap is formally evaluated as `(existing.startTime < newEndTime) && (existing.endTime > newStartTime)`. If an overlap is discovered, the request is rejected with 400 Bad Request, preventing double-booking of interviewer resources.
10. **Atomic Capacity Guard for Concurrent Bookings**: Slot reservation executes via MongoDB's atomic `findOneAndUpdate` with condition `$expr: { $lt: ['$bookedCount', '$capacity'] }` and increment `$inc: { bookedCount: 1 }`. This guarantees at the database engine level that no race condition can ever overbook an interview slot beyond its designated capacity, returning 409 Conflict if competing requests arrive simultaneously.
11. **Non-Blocking Fault-Tolerant Email Architecture**: Outbound emails are processed asynchronously without blocking the client response cycle. The `emailService` wraps transport logic so that transport failures (e.g. SMTP connection timeout, invalid host) log diagnostics without rejecting or terminating the ongoing API transaction. Interview reminders (`sendInterviewReminderEmail`) are exposed as a callable function; background recurring cron execution is decoupled and slated for scheduler integration if automated background polling is introduced.
12. **Candidate Question Sanitization & Answer Key Secrecy**: When candidates fetch questions via `GET /api/assessments/:id/questions`, assessment answers must be strictly protected against client-side inspection. Protection is implemented in depth: Mongoose projection explicitly excludes answer fields (`.select('-correctOptionIndex -explanation')`), and the controller additionally sanitizes each document by deleting `correctOptionIndex` and `explanation` from plain object representations before transmission. Test suites assert raw JSON properties directly to guarantee zero leakage.
13. **Attempt Limit Policy for Expired & Abandoned Attempts**: All attempts where status is `'completed'` or `'expired'` (including mid-assessment abandonments detected by the cron or on-access expiry worker) strictly count toward the assessment's `maxAttempts`. This prevents question-harvesting exploits where a candidate opens a test, copies questions, lets the timer run out without submitting, and restarts indefinitely.
14. **Atomic Concurrency Guards for Assessment Start and Submit**: Assessment starts are protected by a single partial unique index on `{ candidateId: 1, assessmentId: 1 }` with `partialFilterExpression: { status: 'in_progress' }`. This strictly guarantees at most one in-progress attempt per candidate per assessment at any moment, regardless of `attemptNumber`, without restricting accumulated historical completed/expired attempts. Duplicate-key errors (`code 11000`) are caught and resolved to the active attempt rather than surfacing as a 500 error. Submissions are guarded by atomic `findOneAndUpdate({ _id: attemptId, candidateId, status: 'in_progress' }, ...)` ensuring exactly one winning process finalizes the attempt and triggers the completion email, eliminating race-condition double-submissions.
15. **Selective Scope for Topic-Wise Performance Aggregation (Completed Attempts Only) vs Individual Result/History Endpoints**: The candidate topic-wise analytics endpoint (`GET /api/candidate/performance/topic-wise`) strictly scopes aggregation to attempts with `status: 'completed'`. Expired attempts (where questions were unanswered due to elapsed time) are excluded from aggregated topic proficiency metrics so that candidate mastery isn't artificially penalized or skewed by abandoned/timed-out tests. In contrast, individual result inspection (`GET /api/candidate/attempts/:attemptId/result`) and history listings (`GET /api/candidate/assessments/history`) include both `completed` and `expired` attempts with accurate zero scores, derived metrics, and populated metadata for full auditability and transparency.
16. **Atomic Status Transition Guard in `finalizeExpiredAttempt`**: Attempts can transition from `in_progress` to `expired` via multiple asynchronous entry points: the background `node-cron` sweep, on-access checks during attempt start (`startAssessmentAttempt`), submission (`submitAssessmentAttempt`), result retrieval (`getAttemptResult`), or history inspection (`getAssessmentHistory` / `getAttemptById`). To prevent duplicate scoring, inconsistent endTime assignments, or duplicate email triggers, `finalizeExpiredAttempt` uses an atomic `findOneAndUpdate({ _id: attempt._id, status: 'in_progress' }, updateDoc, { new: true })`. If the query matches 0 documents (indicating another concurrent thread already finalized the attempt), it immediately re-fetches and returns the existing finalized document without re-scoring or overwriting state.
17. **Fault-Tolerant In-App Notification Dispatch, Anti-Enumeration Ownership & Winning-Branch Guard**: In-app notifications are created via a decoupled `notificationService` in a non-blocking, fault-tolerant manner so that notification delivery failures never abort primary business transactions. To prevent resource enumeration and identity probing, `PATCH /api/notifications/:id/read` scopes updates directly to `{ _id: id, userId: req.user.id }` and returns 404 uniformly regardless of whether an ID exists under another user. Furthermore, expiry notifications (`assessment_expired`) are triggered strictly on the winning branch of `finalizeExpiredAttempt`'s atomic `findOneAndUpdate` update, guaranteeing that simultaneous executions across background cron sweeps and on-access requests generate exactly one notification.
18. **Candidate Dashboard Parallel Aggregation & Schema-Consistent Query Strategy**: The candidate dashboard aggregates disparate domain data (profile, bookings, attempts, notifications) into a single optimized payload. To ensure lightning-fast responses without N+1 query bottlenecks, all independent domain queries are dispatched concurrently via `Promise.all` after completing the on-access expiry sweep. Query filters strictly adhere to schema-verified reference fields (`user` for CandidateProfile, `candidate` for InterviewBooking, `candidateId` for AssessmentAttempt, `userId` for Notification). Resume presence is strictly validated against `profile?.resume?.url` length, and `nextUpcomingInterview` strictly selects the earliest confirmed booking whose slot starts in the future, returning `null` when no future interview is scheduled.
19. **Admin Dashboard Mutually-Exclusive Booking/Interview Partitioning, Null-Safe Orphan Fallback & Unified Activity Feed**: In `GET /api/admin/dashboard`, bookings and scheduled interview metrics are partitioned using a single-pass, mutually-exclusive bucketing model to guarantee mathematical consistency (`upcoming + completed + cancelled + rescheduled === totalBookings` and `totalScheduled === upcoming + completed`). Because completed interviews are not explicitly updated to `status: 'completed'` in current lifecycle handlers, temporal inspection is used: confirmed bookings with `slot.startTime > now` are bucketed as `upcoming`, while confirmed bookings with `slot.startTime <= now` or unresolvable/null slot references are bucketed as `completed`. This null guard prevents server crashes (`TypeError: Cannot read properties of null`) when interview slots have been deleted while bookings remain. The unified activity feed combines registrations, bookings, and attempts into a single normalized chronological timeline sorted descending by timestamp with configurable `?limit=N` clamped to 50.
20. **Defensive Security Hardening (Helmet, CORS, Dual-Tier Rate Limiting, Request Capping, NoSQL Sanitization & Leakage Protection)**: Comprehensive defense-in-depth across the API surface. Enforces secure HTTP headers via `helmet` (clickjacking, MIME sniffing, DNS prefetch, HSTS), restricts origins through an explicit `cors` allowlist with credential protection, mitigates DoS payload exhaustion via 10kb body size caps, strips NoSQL query injection characters (`$` and `.`) from body/query/params via middleware, eliminates CWE-209 input reflection in CastError messages, masks internal 500 error messages in production to protect database driver details, and guards against weak JWT secrets by enforcing a 32-character minimum secret in production environments.
21. **Atomic Cancel/Reschedule Guards, Partial Unique Index, Compensating Rollback & Pipeline Capacity Updates**:
    - Partial unique index configured on `InterviewBooking` on `{ candidate: 1, slot: 1 }` with `partialFilterExpression: { status: 'confirmed' }`, enforcing at the database engine level that a candidate can never hold multiple active confirmed bookings for the same interview slot.
    - `bookSlot`: hardened with MongoDB update pipeline `[ { $set: { bookedCount: { $add: ['$bookedCount', 1] }, status: { $cond: ... } } } ]` to eliminate race conditions, alongside code `11000` duplicate-key interception that rolls back claimed capacity and returns 409 Conflict.
    - `cancelBooking`: hardened with atomic transition `findOneAndUpdate({ _id: bookingId, candidate: candidateId, status: 'confirmed' }, { $set: { status: 'cancelled', cancelledAt: ... } }, { new: true })`. Strictly releases slot capacity and dispatches notifications on the winning branch using `updatedBooking.slot`, eliminating double-decrement and stale pre-fetch reference races.
    - `rescheduleBooking`: executes atomic four-step coordination with compensating rollbacks:
      1. Atomically claims target slot capacity via update pipeline.
      2. Atomically transitions old booking from `confirmed` to `rescheduled` using `findOneAndUpdate`. If lost race, immediately rolls back claimed target slot capacity and returns 400.
      3. Inserts new confirmed booking wrapped in try/catch; if code `11000` duplicate key is caught, rolls back claimed target slot capacity, reverts old booking back to `confirmed` (`rescheduledTo: null`), and returns a clean 409 Conflict.
      4. Releases old slot capacity strictly using `updatedOldBooking.slot`.
22. **OpenAPI 3.0 Documentation Architecture, Route-Level CSP Relaxation & Production Gating**:
    - Comprehensive OpenAPI 3.0.3 specification defined in `server/docs/swaggerSpec.js` with exact mappings for all 37 distinct endpoint paths and 50 operations across the system. Strictly excludes unimplemented endpoints.
    - Helmet CSP relaxation (`script-src: ["'self'", "'unsafe-inline'"]`, `style-src: ["'self'", "'unsafe-inline'"]`, `img-src: ["'self'", 'data:']`) is isolated strictly to the `/api-docs` and `/api-docs.json` routes. All other API routes (`/api/auth/*`, `/api/candidate/*`, `/api/admin/*`, `/health`, etc.) retain the strict, unrelaxed default CSP (`script-src 'self'`).
    - Environment gating dynamically disables documentation endpoints in production environments (`NODE_ENV === 'production'`) unless `ENABLE_SWAGGER === 'true'`, returning 404 with zero CSP relaxation.
23. **Deduplicated Axios 401 Interceptor-to-AuthContext Event Bridge**:
    - Because Axios response interceptors execute outside the React component tree, they cannot directly invoke `useNavigate` or update context state.
    - An explicit bridge is implemented: on encountering a 401 response, `services/api.js` inspects `localStorage.getItem('token')`. If present, it purges the token and dispatches a window event `auth:session-expired`.
    - Subsequent in-flight requests that also resolve to 401 find `localStorage.getItem('token') === null` and suppress event dispatch, preventing multiple redirects or redundant alerts.
    - `AuthContext` listens for `auth:session-expired`, resets user and token states to `null`, and navigates to `/login` with `state: { sessionExpired: true, message: ... }`.
24. **Explicit 403 Forbidden RBAC Route Enforcement**:
    - Rather than silently redirecting authenticated candidates who attempt to access admin routes to their candidate dashboard, `AdminRoute` explicitly redirects them to `/forbidden` (`<Navigate to="/forbidden" replace />`).
    - The dedicated `ForbiddenPage` displays an unambiguous 403 status and gives the user clear navigation options (return to candidate dashboard or home). This makes role-based authorization visible, verifiable, and prevents masking permissions boundaries.
25. **Password Reset Anti-Enumeration, Cryptographic Hashing, and Single-Use Token Lifecycle**:
    - `POST /api/auth/forgot-password`: Generates a 32-byte cryptographically random hex token via `crypto.randomBytes(32).toString('hex')`, stores its SHA-256 digest (`crypto.createHash('sha256').update(token).digest('hex')`) in `User.resetPasswordToken`, and sets a 15-minute expiration (`Date.now() + 15 * 60 * 1000`).
    - Anti-enumeration defense: Dispatches email only when the user exists, but uniformly returns 200 OK with identical generic message (`"If an account exists for this email, a reset link has been sent."`) regardless of whether the email is registered or unverified.
    - `PUT /api/auth/reset-password/:token`: Queries by SHA-256 hashed token with `$gt: Date.now()` on expiration and explicitly selects `+password +resetPasswordToken +resetPasswordExpire`. Updates password (triggering bcrypt pre-save hook) and explicitly unsets `resetPasswordToken` and `resetPasswordExpire` to `undefined`, guaranteeing single-use token invalidation against replay attacks.
    - Security rate-limiting: Extended `authLimiter` (15-minute window, 10 attempts per IP) across `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, and `/api/auth/reset-password` to defend against credential flooding and token brute-forcing.
26. **Role-Aware Post-Login Navigation with Preserved Return URL Sanitization**:
    - Preserved return URLs passed via location state (`from: location`) during route guard redirects are validated against the authenticated user's assigned role upon login.
    - If an admin authenticates after a candidate route redirect, or if a candidate authenticates after an admin route redirect, the cross-role return URL is discarded in favor of the role-appropriate destination (`/admin/dashboard` or `/candidate/dashboard`), preventing unauthorized landing states and eliminating redirect loops.
27. **Authoritative Backend Completion Precedence & Shared Fixture Cross-Tier Parity**:
    - Profile completion percentage is calculated on both tiers: client-side in `utils/profileCompletion.js` to provide real-time, optimistic feedback as fields are typed without waiting for network I/O, and server-side in `CandidateProfile.prototype.calculateCompletion()` as the single source of truth.
    - The UI strictly overwrites the optimistic score with the authoritative backend score returned in responses (`res.data.profile.profileCompletionPercentage` or `res.data.profileCompletionPercentage`) upon every save, upload, or deletion.
    - Cross-tier parity is enforced by a shared JSON fixture (`server/tests/fixtures/profileCompletionFixtures.json`) containing 14 permutation cases. It is evaluated on the backend via Jest (`server/tests/profileCompletion.test.js`) and on the client via `client/scripts/verify-profile-completion-parity.js`, ensuring zero divergence without requiring Babel transforms in backend Jest.
28. **Pre-Flight File Validation Mirroring Multer Configuration & Env Sync**:
    - Client pre-flight file validation (`utils/fileValidation.js`) strictly mirrors backend Multer upload configuration (`server/middleware/upload.js`) across accepted file extensions (`.pdf`, `.doc`, `.docx`), MIME types (`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), and size limit (`VITE_MAX_FILE_SIZE_MB` mirroring `MAX_FILE_SIZE_MB`).
    - Rejections occur before sending network requests, preventing wasteful bandwidth consumption, and emit identical user-facing error messages to the backend. Both `.env.example` files explicitly document that `VITE_MAX_FILE_SIZE_MB` and `MAX_FILE_SIZE_MB` must be kept manually in sync.
29. **Differentiated Booking Error Classification & Structured User Guidance**:
    - In `client/src/services/interviewService.js`, `classifyBookingError` inspects backend status codes (400, 403, 404, 409) and error messages returned by `interviewBookingController.js` to surface differentiated, actionable alerts:
      - 409 Capacity Collision (`"This interview slot is fully booked or no longer available."`) maps to category `'slot_full'`, warning that another candidate reserved the seat, and automatically marks the slot full in UI state.
      - 409/400 Duplicate Booking (`"You already have an active booking for this interview slot."`) maps to category `'duplicate_booking'`, titled "Already Reserved" with a direct link (`/candidate/bookings`) to view the reservation in My Interviews.
      - 400 Elapsed Session (`"Cannot book a past or ongoing interview slot."`) maps to category `'past_slot'`, alerting that the session has passed.
      - 403 Forbidden Ownership Mismatch maps to category `'permission_denied'`.
      - 400 Lost Atomic Race (`"This booking has already been cancelled or modified by another request."`) maps to category `'already_updated'` and triggers an automatic refresh.
30. **Client-Side Single Booking Resolution Preserving OpenAPI 3.0.3 Contract**:
    - To preserve the exact 37 paths and 50 operations documented in OpenAPI 3.0.3 without inventing custom backend endpoints, `InterviewDetailsPage.jsx` (`/candidate/bookings/:id`) resolves booking details via `interviewService.getBookingById(id)`, which fetches the authenticated candidate's bookings set (`GET /api/candidate/bookings`) and resolves the matching record. This maintains 100% backend contract integrity while providing instant navigation and full ownership security.
31. **Graceful Schema Default Fallbacks & Real Database Verification for Interview Slot Fields**:
    - In `InterviewSlot`, `description` and `meetingLink` default to empty strings (`''`). The client UI implements explicit, sensible fallback protections across all views:
      - Empty `description`: Renders `"No description provided"` in styled fallback spans on both `AvailableSlotsPage` and `InterviewDetailsPage`, preventing empty voids or distorted flex containers.
      - Empty `meetingLink`: On `InterviewDetailsPage`, suppresses non-functional "Enter Video Interview" and "Copy Link" buttons entirely, instead displaying a clean pending notice (`"Meeting link will be shared closer to the interview date. Please check back before your scheduled session time."`). On `MyBookingsPage`, cards display the pending notice text in place of an action button.
      - Integration tested end-to-end (`verify:interviews:real`) against a live Express server with real Mongoose documents in MongoDB, validating both populated fields (live join URLs, actual description text) and empty schema defaults, along with live cancellation capacity release verified directly inside the database engine.
32. **CORS `Date` Header Exposure & Fail-Loud Clock Integrity Verification for Authoritative Assessment Timing**:
    - Browsers restrict cross-origin access to non-safelisted response headers by default; the HTTP `Date` header is not exposed across origins (`http://localhost:5173` vs `http://localhost:5000`) without explicit opt-in. Express CORS configuration in `server/app.js` is configured with `exposedHeaders: ['Date']`.
    - In `client/src/services/assessmentService.js`, `extractAuthoritativeAttempt` validates that the `Date` header is present and a valid date timestamp. If missing, it throws a `ClockIntegrityError`, failing loudly with a high-visibility security alert rather than silently falling back to trusting the candidate's local client clock.
    - Clock skew is calculated as $\text{serverDate} - \text{clientTimeAtReceipt}$, anchoring all countdown math to authoritative server time and providing complete immunity to client machine clock manipulations.
33. **Authoritative Mount/Reload Reconciliation vs. Session-Scoped Answer Recovery**:
    - When `TakeAssessmentPage.jsx` mounts or reloads, it always makes an authoritative network request (`getAttemptById(attemptId)` or `startAssessmentAttempt(id)`) before mounting the arena.
    - If the backend returns `attempt.status !== 'in_progress'` (e.g. `status === 'expired'` finalized server-side by cron or on-access sweep while the tab was closed or reloading), the arena immediately renders the finalized notice and suppresses the timer, ignoring any local storage state.
    - `sessionStorage` is strictly scoped to candidate answer selections (`assessment_answers_${attemptId}`) to preserve selected radio options across accidental page refreshes, but never dictates attempt status or expiry timestamps.
34. **Dual-Signal Architecture: Ephemeral Session Toasts vs. Persistent In-App Database Notifications**:
    - The client-side toast notification system (`ToastContext`) and backend-persisted Notification documents (`Notification` collection in MongoDB) are intentionally designed as two distinct, complementary communication channels for the same underlying domain events, not a duplication bug.
    - Ephemeral toasts provide immediate, non-intrusive feedback during an active user session (e.g., "Interview slot booked successfully!", "Assessment submitted successfully!", "Notification marked as read"), auto-dismissing after 4 seconds to preserve workspace ergonomics.
    - Persistent backend notifications (`Notification` model) provide an enduring, queryable audit history accessible anytime via the candidate Notifications Center (`/candidate/notifications`), tracking read/unread status across devices and sessions, with pagination and badge counters.
35. **Authoritative Backend Consumption & Transparent Truncation Disclosure for Administrative Analytics**:
    - The Admin Dashboard strictly consumes aggregated metrics computed by the backend API (`data.interviewStats.totalScheduled`, `data.bookingStats.total`, `data.assessmentStats.averagePercentage`) rather than duplicating summations in browser memory. This eliminates arithmetic drift risks and enforces consistency with verified backend partitioning invariants (Architectural Decision #19).
    - Because `recentActivityFeed` is pre-sorted and truncated on the server based on `?limit=N`, client-side category filtering operates on an already-truncated set. To ensure administrators are never misled into believing a filtered subset represents the platform's full historical total, the UI renders an explicit contextual disclaimer (*"Filtered from your most recent N total activity events. Increase the feed limit (up to 50) to see more historical events."*) alongside dynamic limit selectors and match counters.
    - Analytics visualizations are implemented with zero-dependency, pure-React SVG chart primitives (`DonutChart`, `ProgressBarChart`, `ScoreGaugeRing`), guaranteeing high rendering performance, zero external bundling bloat, and pixel-perfect responsiveness across desktop, tablet, and mobile displays.
36. **ReDoS-Resistant Administrative Search & Authoritative Candidate Account Lifecycle Management**:
    - While NoSQL sanitization middleware (`server/app.js`) successfully removes keys starting with `$` or containing `.`, it leaves string *values* untouched. If user-supplied search queries are passed directly into `new RegExp(query, 'i')`, an attacker can inject catastrophic backtracking patterns (e.g. `((a+)+)+$`) that freeze the Node.js single-threaded event loop (ReDoS).
    - A dedicated escaping utility ([`server/utils/regexEscape.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/utils/regexEscape.js)) escapes all regex meta-characters (`. * + ? ^ $ { } ( ) | [ ] \`) before pattern instantiation in `adminCandidateController.js`. This guarantees that user queries with special symbols (e.g. `C++`, `(Node.js)`) are treated strictly as literal substrings and execute with linear time complexity.
    - Candidate account deactivation (`PATCH /api/admin/candidates/:id/status` setting `isActive: false`) integrates directly with our authentication middleware ([`server/middleware/auth.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/middleware/auth.js)) and login controller ([`server/controllers/authController.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/controllers/authController.js)). Because `authenticate` inspects `user.isActive` on every authenticated request, deactivation takes immediate effect, instantly returning 403 Forbidden and invalidating active candidate sessions without waiting for token expiration.
37. **Schema Foreign Key Discrepancy Reconciliation (`candidateId` vs `candidate`) in Aggregated Administrative 360 Views**:
    - `InterviewBooking` references candidate users via the `candidate` field ([`server/models/InterviewBooking.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/InterviewBooking.js)), whereas `AssessmentAttempt` references candidate users via `candidateId` and assessments via `assessmentId` ([`server/models/AssessmentAttempt.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/AssessmentAttempt.js)).
    - In `getAdminCandidateById` ([`server/controllers/adminCandidateController.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/controllers/adminCandidateController.js)), queries strictly query `InterviewBooking.find({ candidate: id })` and `AssessmentAttempt.find({ candidateId: id })`. Attempts are populated via `populate('assessmentId')` and normalized to `{ ...attempt, assessment: attempt.assessmentId }`, ensuring the candidate 360 detail view renders rich attempt history, scores, and pass/fail states without silent empty array fallbacks.

38. **Slot Deletion Cascade, Two-Tier Persistence & Atomic Administrative Booking Modification**:
    - **Prompt 23 Resolution & Validator Alignment**: Both `POST /api/admin/interview-slots` and `PUT /api/admin/interview-slots/:id` directly extract and persist `description` and `meetingLink` to MongoDB `InterviewSlot` documents. The previous gap where `interviewSlotValidator.js` omitted type checks was resolved by adding explicit string validation (max 2000 chars for description, max 500 chars for meetingLink). The administrative frontend (`AdminSlotsPage.jsx`) explicitly exposes both fields in Create and Edit modal forms with full validation.
    - **Atomic Slot Deletion Cascade**: When an administrator deletes an interview slot that has active bookings (`slot.bookedCount > 0`), the slot is marked as `status: 'cancelled'` and `bookedCount: 0` to preserve audit integrity. Every confirmed `InterviewBooking` referencing the slot is atomically transitioned via `findOneAndUpdate({ _id: booking._id, slot: slot._id, status: 'confirmed' }, { $set: { status: 'cancelled', cancelledAt: new Date() } }, { new: true })`. This guarantees that concurrent candidate modifications never result in inconsistent states or double notifications.
    - **Distinct Administrative Lifecycle Messaging**: Affected candidates receive both an in-app notification and an email with distinct administrative cancellation wording (*"Your interview booking for '[Title]' on [Time] was cancelled because the session was cancelled by an administrator"*), clearly distinguishing administrative schedule changes from candidate self-service cancellations.
    - **On-Behalf Administrative Operations (`adminCancelBooking` & `adminRescheduleBooking`)**: Administrators can cancel or reschedule bookings on a candidate's behalf via `PATCH /api/admin/bookings/:id/cancel` and `PATCH /api/admin/bookings/:id/reschedule`. Both endpoints adhere strictly to the established atomic-guard pipeline:
      1. Capacity is claimed atomically via update pipeline `[ { $set: { bookedCount: { $add: ['$bookedCount', 1] }, status: { $cond: ... } } } ]`.
      2. The previous booking is atomically transitioned from `confirmed` to `rescheduled`.
      3. A new confirmed booking is created for the candidate with code 11000 duplicate-key rollback guards.
      4. The previous slot's capacity is decremented.
      5. Email and in-app notifications are dispatched **strictly on the winning branch** as un-awaited, fire-and-forget promises with `.catch()` error logging, never blocking the HTTP response and never triggering on rollback branches.

39. **Assessment Lifecycle Management, Attempt-Aware Deletion Guard, Mid-Attempt Immunity & Answer Key Security**:
    - **Attempt-Aware Deletion Guard**: In `assessmentController.js` (`deleteAssessment`), deleting an assessment with existing candidate attempts corrupts candidates' permanent score reports and historical performance records (`getAssessmentHistory` and `getAttemptResult`). The controller checks `AssessmentAttempt.countDocuments({ assessmentId: req.params.id })`. If attempts exist (`attemptCount > 0`), the request is rejected with `400 Bad Request` and clear guidance: *"Cannot delete assessment with existing candidate attempts. Unpublish the assessment instead to preserve candidate attempt history."* When `attemptCount === 0`, the assessment is cleanly deleted and its questions are cascade-removed via `Question.deleteMany({ assessmentId: req.params.id })`.
    - **Defensive Fallback for Historical Attempt Records**: In `assessmentAttemptController.js`, `getAttemptResult` and `getAssessmentHistory` include defensive fallbacks when `attempt.assessmentId` is null (e.g. from legacy deletions), returning a safe mock object `{ title: 'Retired Assessment', difficulty: 'unknown', durationMinutes: 0 }` to guarantee candidate score reports never crash with null-reference errors.
    - **Mid-Attempt Unpublish Immunity**: Once a candidate initiates an assessment attempt while it is published (`startAssessmentAttempt`), an administrator unpublishing the assessment mid-attempt does NOT disrupt the candidate. `submitAssessmentAttempt` evaluates answers and finalizes attempts based strictly on the authoritative attempt record and its referenced questions, without querying or asserting `assessment.isPublished`. In-progress attempts remain 100% submittable, scoreable, and finalized to `'completed'` or `'expired'` normally.
    - **Authoritative Answer Key Security & Zero Leakage**: The Question Bank Studio (`/admin/assessments/:assessmentId/questions` and `/admin/questions`) is strictly the ONLY place where correct answers and marking explanations are displayed. Options render interactive radio selectors for admins to designate `correctOptionIndex` (with green badges and highlight borders). Candidate discovery endpoints (`GET /api/assessments/:id/questions` and `GET /api/candidate/assessments/:id/questions`) strictly project away `correctOptionIndex` and `explanation`, ensuring candidate clients never receive answer keys.

40. **Candidate Results Cross-Collection Aggregation & Strict Active Candidate Recipient Invariant for Targeted Broadcasts**:
    - **Verified Cross-Collection Aggregation Invariants (`/admin/results`)**:
      - `AssessmentAttempt` references candidates via `candidateId` ([`server/models/AssessmentAttempt.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/AssessmentAttempt.js)), while `CandidateProfile` references candidates via `user` ([`server/models/CandidateProfile.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/CandidateProfile.js)), and `AssessmentAttempt` references assessments via `assessmentId`.
      - In `getAdminResults` ([`server/controllers/adminResultController.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/controllers/adminResultController.js)), aggregation joins `users` on `AssessmentAttempt.candidateId === User._id`, `candidateprofiles` on `candidate._id === CandidateProfile.user`, and `assessments` on `AssessmentAttempt.assessmentId === Assessment._id`.
      - Search queries are sanitized against ReDoS using `escapeRegex`, matching literally across candidate `email`, profile `fullName`, and assessment `title`.
      - Aggregated metrics (`totalAttempts`, `completedCount`, `passedCount`, `passRate`, `averageScore`, `averagePercentage`) are computed via `$facet` within the database aggregation pipeline, eliminating arithmetic drift.
    - **Reused Canonical Broadcast with Strict Recipient Invariant (`POST /api/admin/notifications/broadcast`)**:
      - Instead of creating duplicate endpoints, the existing broadcast endpoint was extended to accept targeted recipient IDs via `userIds` (array or comma-separated string) or `candidateId`.
      - When targeted IDs are supplied, the backend strictly validates that recipients are existing, active candidate accounts: `User.find({ _id: { $in: targetIds }, role: 'candidate', isActive: true })`. Admins, non-candidate users, inactive/deactivated accounts, and nonexistent IDs are strictly excluded from delivery.
      - If no valid active candidates resolve from the provided IDs, the controller rejects the request with `400 Bad Request` (*"No active candidate accounts found for the specified recipient IDs"*).
    - **Platform Notifications Audit Feed (`GET /api/admin/notifications`)**:
      - Provides administrators with a paginated, searchable, and filterable audit view of all system notifications, populated with recipient email and candidate profile details.
    - **Administrative UI Modules**:
      - `AdminResultsPage.jsx`: Real-time KPI summaries, multi-attribute filtering (status, pass/fail, assessment, candidate), ReDoS-safe search, responsive attempts data table, and modal score report breakdown with topic performance cards.
      - `AdminBroadcastPage.jsx`: Notifications & Broadcast Center with operational KPIs, flexible audience selector (All Candidates / Platform-Wide / Specific Candidates), live announcement preview, and paginated platform notification audit feed.

41. **Unified Frontend Design System, Accessibility Standards, Responsive Breakpoints, and Shared UI Primitives**:
    - **Shared UI Primitives (`client/src/components/common/`)**: Standardized accessible UI components: `LoadingSpinner` (with polite aria-live regions), `EmptyState` (consistent zero-state cards with actionable CTAs), `Alert` (`role="alert"` banners with dismiss and retry handlers), `Modal` (focus-contained accessible dialogs with Escape key and overlay click listeners), `ConfirmModal` (specialized confirmation dialog for destructive or high-impact actions), and `StatCard` (unified metric cards with trend indicators).
    - **Modal CSS Backward-Compatibility Aliases**: Retained all modal class names (`.modal-body`, `.modal-footer`, `.modal-overlay`, `.modal-backdrop`, `.booking-modal-overlay`, `.modal-card`, `.modal-dialog`, and `.booking-modal-card`) as concurrent valid aliases in `client/src/index.css`, ensuring 100% selector stability across all existing Puppeteer verification suites.
    - **WCAG 2.1 AA Accessibility Standards**: Standardized high-contrast focus rings (`:focus-visible`), skip navigation links (`.skip-link` pointing to `#main-content`) across all layouts (`PublicLayout`, `CandidateLayout`, `AdminLayout`), form validation associations (`aria-invalid`, `aria-describedby`), accessible status badges, and semantic button attributes (`type="button"` on non-submit buttons).
    - **Standardized Responsive Breakpoints**: Structured global media queries (1024px desktop reflow, 768px tablet grid collapse, 640px mobile stacking) ensuring responsive KPI grids, full-width modal buttons on mobile, touch-friendly tap targets, and clean data table horizontal scrolling across candidate and admin portals.
    - **Dual-Signal User Feedback**: Standardized user feedback pairing non-blocking auto-dismissing action toasts (`ToastContext`) for immediate workflow confirmation with persistent inline alert banners and confirmation modals for destructive operations.
    - **Adoption Scope Policy for Shared Primitives**: The shared UI components in `client/src/components/common/` (`LoadingSpinner`, `EmptyState`, `Alert`, `Modal`, `ConfirmModal`, `StatCard`) are established as the canonical building blocks for all **new** pages, workflows, and features going forward. Retrofitting the 19 existing pages was intentionally avoided: their bespoke implementations were audited and confirmed already fully compliant, robust, accessible, and verified by 9 real-backend test suites. Replacing their internal DOM structures with the new primitives would have introduced high regression risk and unnecessary churn without functional benefit.

42. **Continuous State Carryover in E2E Multi-Persona User Journeys (`verify:journeys:real`)**:
    - Rather than isolating test scenarios into independent, teardown-heavy sandboxes, the continuous journey runner (`client/scripts/verify-continuous-journeys.js`) validates complete end-to-end user workflows sequentially with persistent state carried across both personas:
      1. Candidate persona establishes real database records: User account, profile details, resume upload, confirmed booking, and completed assessment attempt with 100% score (8/8 marks).
      2. Admin persona directly consumes and operates on those exact candidate records: the operations dashboard verifies live KPIs reflecting Clara's activity; the administrative reschedule atomically transfers Clara's booking to a newly created slot while adjusting capacity counts; the results view inspects Clara's score report; and the broadcast dispatch targets Clara's candidate ID specifically.
    - In the Question Studio (`AdminQuestionsPage.jsx`), modal creation forms initialize with 4 empty option slots (`options: ['', '', '', '']`), which are filled cleanly without triggering HTML5 `:invalid` constraints.

43. **Production-Readiness Audit, Non-Redundant Database Indexing, Bounded Pagination, and Security Hardening**:
    - **Non-Redundant MongoDB Indexing**: Audited indexes across all collections to eliminate duplicates while optimizing high-frequency query paths:
      - `User`: Added compound index `{ role: 1, isActive: 1 }` and sparse index `{ resetPasswordToken: 1 }`.
      - `InterviewSlot`: Added compound index `{ status: 1, startTime: 1 }` optimizing open-slot discovery.
      - `InterviewBooking`: Added compound index `{ candidate: 1, createdAt: -1 }` optimizing candidate history queries.
      - `Assessment`: Added `{ createdAt: -1 }`.
      - `AssessmentAttempt`: Added `{ candidateId: 1, createdAt: -1 }`.
      - `Notification`: Removed redundant single-field `index: true` on `userId` (covered by existing compound indexes `{ userId: 1, createdAt: -1 }` and `{ userId: 1, isRead: 1 }`), and added `{ createdAt: -1 }` for administrative feeds.
    - **Backward-Compatible List Pagination**:
      - `InterviewSlot` (`getAdminSlots`): Default `page=1`, `limit=50` (max 100). Preserved backward-compatible top-level `count` and added standard `pagination` metadata (`page`, `limit`, `totalPages`, `totalCount`, `hasMore`). `getAvailableSlots` bounded with default `limit=50`.
      - `InterviewBooking` (`getCandidateBookings`, `getAdminBookings`): Default `page=1`, `limit=50` (max 100), with standard `pagination` metadata and top-level `count` preserved.
      - `Assessment` (`getAdminAssessments`): Default `page=1`, `limit=50` (max 100) with standard `pagination` metadata. Aggregation for question and attempt counts scoped strictly to current page IDs (`{ $match: { assessmentId: { $in: pageAssessmentIds } } }`), eliminating O(N) database-wide scans.
    - **Security & Origin Restriction**:
      - `CORS`: Enforced strict production whitelist allowing only `process.env.CLIENT_URL` when `NODE_ENV === 'production'`, while allowing localhost developer origins in dev and test environments.
      - `Rate Limiting`: Configured environment-aware limits (strict 100 req/15 min in production, relaxed 1000 in dev/test to accommodate automated end-to-end suites). Mounted dedicated file upload limiter (20 req/15 min) on `POST /api/candidate/profile/resume`.
      - `Zero-Leakage Auth Tokens`: Rejected URL query-string JWT passing (`req.query.token`), strictly requiring standard `Authorization: Bearer <token>` headers to prevent credential leakage in server access logs and browser history.
    - **File Handling & Atomic Cleanup**:
      - In `candidateProfileController.js` (`uploadResume`), wrapped profile database persistence in `try...catch` with automatic `fs.unlinkSync` of `req.file.path` upon failure, preventing orphan files on disk.
      - Reused `GET /api/candidate/profile/resume` with `requireRole('candidate', 'admin')` supporting admin `?candidateId=...` filter, avoiding redundant endpoints and wiring directly into the administrative candidate details view via blob download.
    - **Structured Logging & PII Masking**:
      - Masked user email addresses (e.g. `c*****@smartprep.com`) in error and informational logs in `authController.js` and `emailService.js`, strictly preventing PII leakage.
    - **Environment Configuration**:
      - Updated `server/.env.example` with missing variables `EMAIL_FROM` and `ENABLE_SWAGGER=false`.

44. **Production Deployment Architecture, Ephemeral Filesystem Limitation, and Multi-PaaS Readiness**:
    - **Deployment Documentation ([DEPLOYMENT.md](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/DEPLOYMENT.md))**:
      - Comprehensive deployment guide established covering backend (Node.js/Express on Render/Railway/VPS), frontend (React 18 SPA on Vercel/Netlify), and MongoDB Atlas database connectivity.
      - Documented complete production environment variable matrices for backend (`PORT`, `NODE_ENV`, `CLIENT_URL`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `MAX_FILE_SIZE_MB`, `EMAIL_*`, `ENABLE_SWAGGER`) and frontend (`VITE_API_BASE_URL`, `VITE_MAX_FILE_SIZE_MB`).
      - Validated build pipeline: frontend production build executes `vite build` cleanly (134 modules transformed, outputting to `client/dist`), and backend start script executes `node server.js`.
      - Provided SPA client-side routing rewrites for Vercel (`client/vercel.json`) and Netlify (`client/public/_redirects`), eliminating 404 errors on deep-link refreshes.
    - **File Storage Tradeoff & Ephemeral Filesystem Limitation**:
      - The application retains local disk storage via Multer (`server/uploads/resumes/`) for zero-dependency operation.
      - **Critical Operational Limitation**: Standard cloud PaaS free/hobby tiers (Render, Railway, Fly.io, Heroku) use containerized **ephemeral filesystems**. Every deploy, restart, or dyno sleep wipes the local writable disk. Candidate database records in MongoDB persist, but the underlying resume file at `server/uploads/resumes/<uuid>.pdf` is lost, causing subsequent downloads to return `404 Not Found`.
      - **Mitigation & Fix**: For production workloads on ephemeral PaaS, attach a persistent volume mount (e.g. Render Persistent Disk mounted to `server/uploads/resumes`) or migrate to cloud object storage (AWS S3 / Cloudinary via `multer-s3`) as documented in [`DEPLOYMENT.md`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/DEPLOYMENT.md).
    - **Atlas & CORS Verification**:
      - Production CORS dynamically extracts whitelist origins from `process.env.CLIENT_URL` (supporting comma-separated origins) while isolating dev origins.
      - Database connectivity via `process.env.MONGODB_URI` natively supports Atlas cluster URIs (`mongodb+srv://...`) with automatic schema index construction and graceful connection timeout handling.

45. **Render & Railway Platform Deployment Orchestration, Blueprint & Volume Mount Specifications**:
    - **Platform Configuration Files**:
      - Root [`render.yaml`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/render.yaml): Blueprint specification defining web service with `rootDir: server`, `runtime: node`, build command `npm install`, start command `npm start`, and unauthenticated health check `/health` (also aliased to `/api/health`).
      - Server [`server/Procfile`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/Procfile): Generic PaaS process definition (`web: node server.js`) for Railway, Heroku, and Dokku.
    - **Platform-Specific Disk / Volume Mount Specifications**:
      - **Render**: Persistent disks are **not available on the Free tier** (requires paid Starter plan, $7/mo + $0.25/GB/mo disk). On free tier, resumes are ephemeral across redeploys. On paid plans, mount path is `/opt/render/project/src/server/uploads/resumes`.
      - **Railway**: Volumes supported on hobby plan ($5 credit). Mount path is `/app/server/uploads/resumes`.
    - **MongoDB Atlas Network Security**:
      - Dynamic outbound IP pools used by Render and Railway require `0.0.0.0/0` access list configuration in MongoDB Atlas Network Access.

46. **Frontend Production Deployment Configuration & PaaS CORS Interoperability**:
    - **Live Production Environments**:
      - **Frontend (Vercel)**: `https://smart-interview-scheduler-chi.vercel.app`
      - **Backend API (Render)**: `https://smart-interview-scheduler-api-flgk.onrender.com`
      - **Health Check Endpoints**: `https://smart-interview-scheduler-api-flgk.onrender.com/health` and `/api/health` (HTTP 200)
    - **Environment-Driven Base URL**: Modified `client/src/services/api.js` to strictly enforce `VITE_API_BASE_URL` in production builds (`import.meta.env.PROD`), permanently disabling `localhost:5000` fallback and stripping accidental trailing slashes.
    - **Production Environment Config**: Added `client/.env.production` with live Render backend URL (`https://smart-interview-scheduler-api-flgk.onrender.com/api`) and validated `client/.env.example`.
    - **Production Build Verification**: Executed `vite build` inside `client/`, confirming 0 errors and verifying through static bundle inspection that `localhost:5000` is completely eliminated and replaced by the Render backend URL.
    - **SPA Client-Side Routing**: Verified `client/vercel.json` rewrite rule `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` and `client/public/_redirects` to eliminate 404s on browser deep-link refreshes.
    - **Live Backend & CORS Handshake (Resolved)**: During initial deployment, cross-origin requests from Vercel to Render were blocked until `CLIENT_URL` on Render was updated to match `https://smart-interview-scheduler-chi.vercel.app`. Following Render's rolling restart, CORS preflight and credentials handling succeeded with zero errors.
    - **End-to-End Live Verification**: Candidate registration and onboarding flow was manually verified working against the live deployed stack (`POST /api/auth/register` succeeded over HTTPS with JWT token issuance, session storage, and dashboard redirect).

47. **Live Production Infrastructure, Security, and Cross-Platform Verification Audit (12 Dimensions)**:
    - **Live Operational Topology**:
      - Frontend: `https://smart-interview-scheduler-chi.vercel.app` (Vercel CDN + Edge Routing)
      - Backend: `https://smart-interview-scheduler-api-flgk.onrender.com` (Render Node.js Web Service)
      - Database: MongoDB Atlas (Multi-tenant M0 Cluster)
    - **Automated Verification Tooling**:
      - [`client/scripts/verify-production-api.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/client/scripts/verify-production-api.js) (`npm run verify:production:api`): Comprehensive 49-check automated audit covering Dimensions 1–10, featuring cold-start warmup retry tolerance (up to 90s), idempotent test fixture provisioning, candidate lifecycle, interview booking with atomic capacity checks, assessment scoring engine accuracy (100% score for correct answers), resume upload/download streaming, notification workflows, NoSQL injection resistance, clean JSON 404s, and 100% complete database cleanup.
      - [`client/scripts/verify-production-frontend.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/client/scripts/verify-production-frontend.js) (`npm run verify:production:frontend`): Headless Chrome Puppeteer audit covering Dimensions 11–12, testing deep-link SPA hard refreshes across `/`, `/login`, `/register`, `/forgot-password`, multi-device viewport responsiveness (Mobile 375x667, Tablet 768x1024, Desktop 1280x800) with zero horizontal overflow, form element accessibility, and zero unhandled client-side runtime errors.
      - Combined CI script (`npm run verify:production`): Executes both live audit suites sequentially.
    - **Verification Results**:
      - API & Database Audit: 49 / 49 checks passed (100% pass rate).
      - Frontend & Responsiveness Audit: 17 / 17 checks passed (100% pass rate).
      - Total Checks: 66 / 66 passed (100% overall pass rate).
      - Database Clean Slate: Zero residual test entities remaining in production MongoDB Atlas.

## Known Issues / Flagged Backend Discrepancies
- **[RESOLVED] Initial CORS Block on First Production Deployment**:
  - During the first deployment, cross-origin requests from the live Vercel frontend (`https://smart-interview-scheduler-chi.vercel.app`) to the Render backend (`https://smart-interview-scheduler-api-flgk.onrender.com`) were blocked by CORS because `CLIENT_URL` on Render was not yet set to the final Vercel domain.
  - **Resolution**: Setting `CLIENT_URL=https://smart-interview-scheduler-chi.vercel.app` in Render's environment dashboard resolved the issue after a rolling restart. End-to-end candidate registration was then manually verified working against the live deployed stack.
- **[RESOLVED] Standalone Admin Seeding Script (`npm run seed:admin`)**:
  - The public registration endpoint `/api/auth/register` strictly enforces `role: 'candidate'` for security, preventing public registration of admin accounts. Running administrator creation during every `server.js` boot was avoided to ensure startup idempotency and prevent accidental credential overwrites.
  - **Resolution**: Created standalone provisioning script [`server/scripts/seed-admin.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/scripts/seed-admin.js) registered as `npm run seed:admin`. The script explicitly checks if an administrator already exists in MongoDB Atlas; if so, it exits immediately without modifying passwords or accounts. Only if no admin exists does it create an initial administrator account.
- **[RESOLVED] Administrative Candidate Cascade Deletion Endpoint**:
  - In production, candidate testing and compliance (GDPR/right-to-erasure) required an atomic mechanism to completely remove candidate data across all relational models.
  - **Resolution**: Implemented `DELETE /api/admin/candidates/:id` in `server/controllers/adminCandidateController.js` and `server/routes/adminRoutes.js`. Atomically purges `User`, `CandidateProfile` (with local resume file unlinking from disk), `InterviewBooking` (releasing slot capacity and decrementing `bookedCount`), `AssessmentAttempt`, and `Notification` documents. Full automated test coverage added in `server/tests/adminCandidates.test.js` covering RBAC (401/403), validation (400/404), and multi-collection cascade cleanup.
- **[RESOLVED] Structured JSON 404 Fallback for Non-Existent API Routes**:
  - Unmatched routes previously fell through Express defaults, returning HTML error pages rather than uniform API error envelopes.
  - **Resolution**: Added a catch-all 404 middleware in `server/app.js` mounted before `errorHandler`, returning consistent `{ success: false, message: 'Route not found' }` with HTTP 404.
- **[RESOLVED] Reverse Proxy Trust & Preserved Production Auth Rate Limiter (10 req/15 min)**:
  - When hosted behind Render's reverse proxy, Express did not trust proxy headers by default, which can cause client IP resolution issues in rate limiting.
  - **Resolution**: Configured `app.set('trust proxy', 1)` in `server/app.js` to correctly resolve client IPs from `X-Forwarded-For` headers. Strictly preserved the 10 attempts per 15 minutes production limit on `authLimiter`, and streamlined the live audit script ([`verify-production-api.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/client/scripts/verify-production-api.js)) to consume only 3 auth requests per execution, leaving ample headroom and eliminating false-positive 429 lockouts.
- **GET /api/admin/candidates returns inactive candidates unless `?status=active` is passed**:
  - The endpoint `GET /api/admin/candidates` defaults to returning all registered candidate accounts regardless of their `isActive` state unless explicitly filtered by `?status=active` or `?status=inactive`. Frontend administrative tables correctly display active/inactive status badges to differentiate accounts.

## Future Work / Phase 8 & 9 Notes
- **Continuous E2E Multi-Persona User Journeys (Completed)**: Full 11-step candidate journey and 9-step admin journey automated and verified 100% pass via `npm run verify:journeys:real`, carrying authentic cross-collection state forward between user sessions.
- **Admin Candidate Results & Notifications Center (Completed)**: Searchable, filterable attempt results table with KPI cards and score report inspection modal, plus admin notification broadcast with strict active candidate validation and platform audit feed fully implemented and verified end-to-end.
- **Production-Readiness Audit & Hardening (Completed)**: All 10 production-readiness dimensions verified across 10 Puppeteer suites (100% pass) and 24 backend Jest suites (267/267 tests passing, 0 open handles).
- **Production Deployment Readiness (Completed)**: Environment variables documented, build and start commands confirmed, MongoDB Atlas and CORS configurations verified, resume storage tradeoffs and ephemeral filesystem limitations documented, and [`DEPLOYMENT.md`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/DEPLOYMENT.md), [`render.yaml`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/render.yaml), and [`server/Procfile`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/Procfile) created.
- **Live Production Audit & Hardening (Completed)**: Full 12-dimension verification across live Vercel frontend and Render backend passing 66/66 checks (100% pass rate) with 100% clean-slate database teardown.









