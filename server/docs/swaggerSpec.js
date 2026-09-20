/**
 * OpenAPI 3.0.3 Specification
 * Smart Interview Scheduler & Mock Assessment Platform API
 *
 * Strictly covers all currently implemented routes across:
 * - Authentication (/api/auth)
 * - Admin Operations (/api/admin)
 * - Candidate Operations (/api/candidate)
 * - Public Discovery (/api/interview-slots, /api/assessments)
 * - In-App Notifications (/api/notifications)
 * - Health Check (/health)
 */

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Interview Scheduler & Mock Assessment Platform API',
    version: '1.0.0',
    description:
      'Robust backend API for scheduling mock interviews, administering timed assessments, automated scoring, real-time analytics, and role-based notifications.',
    contact: {
      name: 'Platform Engineering Team',
    },
  },
  servers: [
    {
      url: process.env.BASE_URL || 'http://localhost:5000',
      description: 'API Server',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'User registration, authentication, logout, and token introspection' },
    { name: 'Admin - Dashboard & Metrics', description: 'Platform analytics, aggregate counts, and unified activity feed' },
    { name: 'Admin - Interview Slots', description: 'Interviewer slot creation, update, overlap prevention, and lifecycle management' },
    { name: 'Admin - Bookings', description: 'Platform-wide interview booking management and filtering' },
    { name: 'Admin - Assessments', description: 'Assessment creation, publishing lifecycle, and configuration' },
    { name: 'Admin - Questions', description: 'Assessment question bank management and evaluation rules' },
    { name: 'Admin - Notifications', description: 'System-wide and targeted broadcast messaging' },
    { name: 'Candidate - Profile & Resume', description: 'Candidate profile management and resume upload/download' },
    { name: 'Candidate - Bookings', description: 'Atomic slot reservation, cancellation, and rescheduling' },
    { name: 'Candidate - Assessments & Attempts', description: 'Assessment attempts, atomic test submissions, and scoring evaluation' },
    { name: 'Candidate - Performance & History', description: 'Historical attempts, detailed breakdown, and topic-wise analytics' },
    { name: 'Public Discovery', description: 'Publicly discoverable available slots and published assessments' },
    { name: 'Notifications', description: 'Authenticated user notifications and read receipts' },
    { name: 'System', description: 'Health check and operational diagnostics' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JSON Web Token in the header: Bearer <token>',
      },
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Detailed error message' },
          errors: {
            type: 'array',
            items: { type: 'string' },
            example: ['Validation error details'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          role: { type: 'string', enum: ['candidate', 'admin'], example: 'candidate' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CandidateProfile: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '607f1f77bcf86cd799439022' },
          user: { type: 'string', example: '507f1f77bcf86cd799439011' },
          contactDetails: {
            type: 'object',
            properties: {
              phone: { type: 'string', example: '+1234567890' },
              location: { type: 'string', example: 'San Francisco, CA' },
              github: { type: 'string', example: 'https://github.com/janedoe' },
              linkedin: { type: 'string', example: 'https://linkedin.com/in/janedoe' },
            },
          },
          headline: { type: 'string', example: 'Full Stack Software Engineer' },
          bio: { type: 'string', example: 'Passionate software developer with 4 years experience in MERN stack.' },
          skills: { type: 'array', items: { type: 'string' }, example: ['Node.js', 'React', 'MongoDB'] },
          targetRole: {
            type: 'string',
            enum: [
              'Frontend Developer',
              'Backend Developer',
              'Full Stack Developer',
              'Mobile Developer',
              'Data Scientist/ML Engineer',
              'DevOps Engineer',
              'QA/SDET',
              'Other',
            ],
            nullable: true,
            example: 'Full Stack Developer',
          },
          profileCompletionPercentage: { type: 'number', example: 85 },
          resume: {
            type: 'object',
            properties: {
              url: { type: 'string', example: '/api/candidate/profile/resume' },
              originalName: { type: 'string', example: 'resume.pdf' },
              uploadedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      InterviewSlot: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '607f1f77bcf86cd799439099' },
          title: { type: 'string', example: 'System Design Mock Interview' },
          description: { type: 'string', example: '45-minute technical mock interview' },
          interviewerName: { type: 'string', example: 'Senior Staff Engineer' },
          startTime: { type: 'string', format: 'date-time', example: '2026-10-15T10:00:00.000Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-10-15T10:45:00.000Z' },
          durationMinutes: { type: 'number', example: 45 },
          capacity: { type: 'number', example: 1 },
          bookedCount: { type: 'number', example: 0 },
          status: { type: 'string', enum: ['available', 'booked', 'cancelled'], example: 'available' },
          createdBy: { type: 'string', example: '507f1f77bcf86cd799439033' },
        },
      },
      InterviewBooking: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '707f1f77bcf86cd799439011' },
          candidate: { type: 'string', example: '507f1f77bcf86cd799439011' },
          slot: { $ref: '#/components/schemas/InterviewSlot' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'rescheduled'], example: 'confirmed' },
          notes: { type: 'string', example: 'Focus on distributed caching and concurrency.' },
          cancelledAt: { type: 'string', format: 'date-time', nullable: true },
          rescheduledTo: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Assessment: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '607f1f77bcf86cd799439044' },
          title: { type: 'string', example: 'Full Stack JavaScript Mastery' },
          description: { type: 'string', example: 'Evaluate async JS, React, and Express architecture.' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], example: 'intermediate' },
          durationMinutes: { type: 'number', example: 30 },
          passingPercentage: { type: 'number', example: 70 },
          maxAttempts: { type: 'number', example: 3 },
          isPublished: { type: 'boolean', example: true },
          createdBy: { type: 'string', example: '507f1f77bcf86cd799439033' },
        },
      },
      Question: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '807f1f77bcf86cd799439001' },
          assessmentId: { type: 'string', example: '607f1f77bcf86cd799439044' },
          text: { type: 'string', example: 'What is the output of typeof null in JavaScript?' },
          options: {
            type: 'array',
            items: { type: 'string' },
            example: ['null', 'object', 'undefined', 'number'],
          },
          correctOptionIndex: { type: 'number', minimum: 0, maximum: 3, example: 1 },
          marks: { type: 'number', example: 2 },
          topic: { type: 'string', example: 'JavaScript Basics' },
          explanation: { type: 'string', example: 'In JS, typeof null returns object due to legacy implementation.' },
        },
      },
      AssessmentAttempt: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '707f1f77bcf86cd799439055' },
          candidateId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          assessmentId: { type: 'string', example: '607f1f77bcf86cd799439044' },
          attemptNumber: { type: 'number', example: 1 },
          status: { type: 'string', enum: ['in_progress', 'completed', 'expired'], example: 'completed' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time', nullable: true },
          expiresAt: { type: 'string', format: 'date-time' },
          score: { type: 'number', example: 18 },
          totalMarks: { type: 'number', example: 20 },
          percentage: { type: 'number', example: 90 },
          passed: { type: 'boolean', example: true },
          topicBreakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string', example: 'Algorithms' },
                score: { type: 'number', example: 8 },
                totalMarks: { type: 'number', example: 10 },
                correctCount: { type: 'number', example: 4 },
                totalQuestions: { type: 'number', example: 5 },
              },
            },
          },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '907f1f77bcf86cd799439001' },
          userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          type: {
            type: 'string',
            enum: ['booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'assessment_completed', 'assessment_expired', 'broadcast', 'general'],
            example: 'booking_confirmed',
          },
          message: { type: 'string', example: 'Your interview booking is confirmed.' },
          isRead: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'System health check',
        description: 'Public health status verification endpoint',
        responses: {
          200: {
            description: 'API is running healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    message: { type: 'string', example: 'Smart Interview Scheduler API is running' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new candidate',
        description: 'Creates a new candidate account. Role is immutably set to candidate (privilege escalation ignored).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'John Doe' },
                  email: { type: 'string', format: 'email', example: 'john@example.com' },
                  password: { type: 'string', minLength: 6, example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Registration successful' },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation failure or user already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticates a user and returns a signed JSON Web Token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'john@example.com' },
                  password: { type: 'string', example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Missing credentials or invalid format', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Invalid email or password', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'User account deactivated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'User logout',
        description: 'Updates lastLogoutAt timestamp to immediately invalidate previously issued JWTs.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Logged out successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          401: { description: 'Unauthorized or token invalid', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get authenticated user details',
        description: 'Returns the profile and account details of the currently authenticated token bearer.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Authenticated user profile retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized or token expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/ping': {
      get: {
        tags: ['Admin - Dashboard & Metrics'],
        summary: 'Admin role verification ping',
        description: 'Returns confirmation that caller has active admin privileges.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Admin access confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden (Candidate role)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/dashboard': {
      get: {
        tags: ['Admin - Dashboard & Metrics'],
        summary: 'Get admin dashboard aggregate metrics',
        description:
          'Returns system metrics: total candidates, scheduled interviews (upcoming vs completed), assessments stats, booking breakdown, and a unified recent activity feed.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum items to return in recent activity feed (1-50, default 10)',
            required: false,
            schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
          },
        ],
        responses: {
          200: {
            description: 'Admin dashboard metrics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        candidates: {
                          type: 'object',
                          properties: { total: { type: 'number', example: 42 } },
                        },
                        interviews: {
                          type: 'object',
                          properties: {
                            totalScheduled: { type: 'number', example: 15 },
                            upcoming: { type: 'number', example: 8 },
                            completed: { type: 'number', example: 7 },
                          },
                        },
                        assessments: {
                          type: 'object',
                          properties: {
                            totalPublished: { type: 'number', example: 5 },
                            totalAttempts: { type: 'number', example: 25 },
                            averageScore: { type: 'number', example: 78.5 },
                          },
                        },
                        bookings: {
                          type: 'object',
                          properties: {
                            total: { type: 'number', example: 18 },
                            upcoming: { type: 'number', example: 8 },
                            completed: { type: 'number', example: 7 },
                            cancelled: { type: 'number', example: 2 },
                            rescheduled: { type: 'number', example: 1 },
                          },
                        },
                        recentActivity: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              type: { type: 'string', enum: ['registration', 'booking', 'assessment_attempt'] },
                              title: { type: 'string' },
                              timestamp: { type: 'string', format: 'date-time' },
                              metadata: { type: 'object' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/interview-slots': {
      post: {
        tags: ['Admin - Interview Slots'],
        summary: 'Create an interview slot',
        description: 'Creates a new interview slot with automatic temporal overlap validation against non-cancelled slots.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'startTime', 'endTime'],
                properties: {
                  title: { type: 'string', example: 'System Design Mock' },
                  description: { type: 'string', example: 'Distributed systems deep dive' },
                  interviewerName: { type: 'string', example: 'Staff Engineer' },
                  startTime: { type: 'string', format: 'date-time', example: '2026-11-01T14:00:00.000Z' },
                  endTime: { type: 'string', format: 'date-time', example: '2026-11-01T14:45:00.000Z' },
                  durationMinutes: { type: 'number', example: 45 },
                  capacity: { type: 'number', default: 1, minimum: 1, example: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Interview slot created successfully',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { slot: { $ref: '#/components/schemas/InterviewSlot' } } } } } } },
          },
          400: { description: 'Validation failure or overlapping slot detected', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Admin - Interview Slots'],
        summary: 'List all interview slots (Admin)',
        description: 'Retrieves all interview slots including booked and past slots.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'All interview slots retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'number', example: 12 },
                    data: { type: 'object', properties: { slots: { type: 'array', items: { $ref: '#/components/schemas/InterviewSlot' } } } },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/interview-slots/{id}': {
      get: {
        tags: ['Admin - Interview Slots'],
        summary: 'Get interview slot by ID',
        description: 'Fetches details of a specific interview slot.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Interview slot details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { slot: { $ref: '#/components/schemas/InterviewSlot' } } } } } } } },
          404: { description: 'Interview slot not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      put: {
        tags: ['Admin - Interview Slots'],
        summary: 'Update an interview slot',
        description: 'Updates slot timing, capacity, or metadata with overlap validation.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  interviewerName: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  capacity: { type: 'number', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Slot updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { slot: { $ref: '#/components/schemas/InterviewSlot' } } } } } } } },
          400: { description: 'Validation failure or overlap detected', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Slot not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Admin - Interview Slots'],
        summary: 'Delete an interview slot',
        description: 'Deletes an interview slot if it has no active bookings.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Interview slot deleted successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          400: { description: 'Cannot delete slot with active bookings', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Slot not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/bookings': {
      get: {
        tags: ['Admin - Bookings'],
        summary: 'List all bookings (Admin)',
        description: 'Retrieves all bookings platform-wide with candidate and slot populated. Supports status, slotId, and candidateId filters.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'rescheduled'] } },
          { name: 'slotId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'candidateId', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Bookings list retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'number', example: 5 },
                    data: { type: 'object', properties: { bookings: { type: 'array', items: { $ref: '#/components/schemas/InterviewBooking' } } } },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/assessments': {
      post: {
        tags: ['Admin - Assessments'],
        summary: 'Create a new assessment',
        description: 'Creates an assessment specification. Assessments default to unpublished (isPublished: false).',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'durationMinutes', 'passingPercentage'],
                properties: {
                  title: { type: 'string', example: 'Data Structures & Algorithms' },
                  description: { type: 'string', example: '30-minute evaluation on trees and graphs' },
                  difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
                  durationMinutes: { type: 'number', minimum: 5, maximum: 180, example: 30 },
                  passingPercentage: { type: 'number', minimum: 1, maximum: 100, example: 60 },
                  maxAttempts: { type: 'number', minimum: 1, default: 3, example: 3 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Assessment created successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { assessment: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          400: { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Admin - Assessments'],
        summary: 'List all assessments (Admin)',
        description: 'Retrieves all assessments (both published and draft).',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Assessments list retrieved',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, count: { type: 'number' }, data: { type: 'object', properties: { assessments: { type: 'array', items: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          },
        },
      },
    },
    '/api/admin/assessments/{id}': {
      get: {
        tags: ['Admin - Assessments'],
        summary: 'Get assessment by ID (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Assessment details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { assessment: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          404: { description: 'Assessment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      put: {
        tags: ['Admin - Assessments'],
        summary: 'Update assessment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                  durationMinutes: { type: 'number' },
                  passingPercentage: { type: 'number' },
                  maxAttempts: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Assessment updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { assessment: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          404: { description: 'Assessment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Admin - Assessments'],
        summary: 'Delete assessment',
        description: 'Deletes an assessment and cascades to delete all associated questions.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Assessment and questions deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          404: { description: 'Assessment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/assessments/{id}/publish': {
      patch: {
        tags: ['Admin - Assessments'],
        summary: 'Toggle assessment publish state',
        description: 'Flips isPublished boolean to control public visibility for candidate discovery.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Assessment publish status toggled', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'Assessment published successfully' }, data: { type: 'object', properties: { assessment: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          404: { description: 'Assessment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/assessments/{assessmentId}/questions': {
      post: {
        tags: ['Admin - Questions'],
        summary: 'Create question for assessment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'assessmentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text', 'options', 'correctOptionIndex', 'marks', 'topic'],
                properties: {
                  text: { type: 'string', example: 'What is the time complexity of QuickSort average case?' },
                  options: { type: 'array', items: { type: 'string' }, minItems: 2, example: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(1)'] },
                  correctOptionIndex: { type: 'number', minimum: 0, example: 1 },
                  marks: { type: 'number', minimum: 1, example: 2 },
                  topic: { type: 'string', example: 'Algorithms' },
                  explanation: { type: 'string', example: 'Average case partitioning yields O(n log n).' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Question created successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { question: { $ref: '#/components/schemas/Question' } } } } } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Parent assessment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Admin - Questions'],
        summary: 'List questions for assessment (Admin with answers)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'assessmentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Questions list with correct answers',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, count: { type: 'number' }, data: { type: 'object', properties: { questions: { type: 'array', items: { $ref: '#/components/schemas/Question' } } } } } } } },
          },
        },
      },
    },
    '/api/admin/assessments/{assessmentId}/questions/{questionId}': {
      get: {
        tags: ['Admin - Questions'],
        summary: 'Get question details by ID (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'assessmentId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'questionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Question details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { question: { $ref: '#/components/schemas/Question' } } } } } } } },
          404: { description: 'Question not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      put: {
        tags: ['Admin - Questions'],
        summary: 'Update question',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'assessmentId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'questionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  correctOptionIndex: { type: 'number' },
                  marks: { type: 'number' },
                  topic: { type: 'string' },
                  explanation: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Question updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { question: { $ref: '#/components/schemas/Question' } } } } } } } },
          404: { description: 'Question not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Admin - Questions'],
        summary: 'Delete question',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'assessmentId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'questionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Question deleted successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          404: { description: 'Question not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/admin/notifications/broadcast': {
      post: {
        tags: ['Admin - Notifications'],
        summary: 'Broadcast in-app notification',
        description: 'Sends notification to all registered candidates or all users.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'Platform maintenance scheduled for Sunday at 02:00 UTC.' },
                  type: { type: 'string', default: 'broadcast', example: 'broadcast' },
                  recipientRole: { type: 'string', enum: ['candidate', 'all'], default: 'candidate' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Broadcast notification dispatched',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Broadcast notification sent successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        recipientCount: { type: 'number', example: 45 },
                        type: { type: 'string', example: 'broadcast' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/ping': {
      get: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Candidate role verification ping',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Candidate access confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/dashboard': {
      get: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Get candidate dashboard summary',
        description:
          'Aggregates profile completion score, upcoming interview, assessment attempt history count, and unread notification count.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Candidate dashboard data retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        profileCompletionPercentage: { type: 'number', example: 75 },
                        hasResume: { type: 'boolean', example: true },
                        nextUpcomingInterview: { $ref: '#/components/schemas/InterviewBooking', nullable: true },
                        interviewCounts: {
                          type: 'object',
                          properties: {
                            upcoming: { type: 'number', example: 1 },
                            past: { type: 'number', example: 2 },
                          },
                        },
                        assessmentStats: {
                          type: 'object',
                          properties: {
                            completedAttempts: { type: 'number', example: 4 },
                            averageScorePercentage: { type: 'number', example: 82.5 },
                          },
                        },
                        unreadNotificationCount: { type: 'number', example: 3 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/candidate/profile': {
      get: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Get candidate profile',
        description: 'Returns profile details and calculated completion percentage.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Candidate profile details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { profile: { $ref: '#/components/schemas/CandidateProfile' }, completionPercentage: { type: 'number', example: 80 } } } } } } } },
        },
      },
      put: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Update candidate profile',
        description: 'Updates candidate profile details, recalculating completion percentage.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  contactDetails: {
                    type: 'object',
                    properties: {
                      phone: { type: 'string' },
                      location: { type: 'string' },
                      github: { type: 'string' },
                      linkedin: { type: 'string' },
                    },
                  },
                  headline: { type: 'string', maxLength: 100 },
                  bio: { type: 'string', maxLength: 500 },
                  skills: { type: 'array', items: { type: 'string' } },
                  targetRole: {
                    type: 'string',
                    enum: [
                      'Frontend Developer',
                      'Backend Developer',
                      'Full Stack Developer',
                      'Mobile Developer',
                      'Data Scientist/ML Engineer',
                      'DevOps Engineer',
                      'QA/SDET',
                      'Other',
                    ],
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { profile: { $ref: '#/components/schemas/CandidateProfile' } } } } } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/profile/resume': {
      post: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Upload or replace resume',
        description: 'Accepts multipart/form-data with "resume" field. Allowed: PDF, DOC, DOCX up to 5MB.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['resume'],
                properties: {
                  resume: { type: 'string', format: 'binary', description: 'Resume file' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Resume uploaded successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { resume: { type: 'object' }, profileCompletionPercentage: { type: 'number' } } } } } } } },
          400: { description: 'Invalid file format or missing file', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          413: { description: 'File exceeds 5MB limit', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Delete resume',
        description: 'Removes the candidate resume file from server disk and resets profile completion score.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Resume deleted successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          404: { description: 'No resume found to delete', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Candidate - Profile & Resume'],
        summary: 'Download candidate resume',
        description: 'Downloads the authenticated candidate resume file.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Resume file stream', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          404: { description: 'No resume found on server or profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/bookings': {
      post: {
        tags: ['Candidate - Bookings'],
        summary: 'Book an interview slot',
        description: 'Atomically reserves an available interview slot with capacity guard and duplicate prevention.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slotId'],
                properties: {
                  slotId: { type: 'string', example: '607f1f77bcf86cd799439099' },
                  notes: { type: 'string', example: 'Focus on database transactions.' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Interview slot booked successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { booking: { $ref: '#/components/schemas/InterviewBooking' } } } } } } } },
          400: { description: 'Past slot or already booked pre-flight check', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Interview slot not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Slot fully booked or duplicate key code 11000 conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Candidate - Bookings'],
        summary: 'Get candidate own bookings',
        description: 'Retrieves booking history for the authenticated candidate.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Candidate bookings list',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, count: { type: 'number' }, data: { type: 'object', properties: { bookings: { type: 'array', items: { $ref: '#/components/schemas/InterviewBooking' } } } } } } } },
          },
        },
      },
    },
    '/api/candidate/bookings/{id}/cancel': {
      patch: {
        tags: ['Candidate - Bookings'],
        summary: 'Cancel an interview booking',
        description: 'Atomically cancels confirmed booking, releases slot capacity, and restores availability.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Booking cancelled successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { booking: { $ref: '#/components/schemas/InterviewBooking' } } } } } } } },
          400: { description: 'Already cancelled or modified by competing request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden (Attempting to cancel another candidate booking)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Interview booking not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/bookings/{id}/reschedule': {
      patch: {
        tags: ['Candidate - Bookings'],
        summary: 'Reschedule an interview booking',
        description: 'Atomically claims target slot capacity and releases old slot with double-compensating rollback protection.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newSlotId'],
                properties: {
                  newSlotId: { type: 'string', example: '607f1f77bcf86cd799439088' },
                  notes: { type: 'string', example: 'Updated reschedule note.' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Booking rescheduled successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        newBooking: { $ref: '#/components/schemas/InterviewBooking' },
                        previousBooking: { $ref: '#/components/schemas/InterviewBooking' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Rescheduling non-confirmed booking, same slot, or lost transition race', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden (Ownership mismatch)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Interview booking not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Target slot full or duplicate key code 11000 conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/assessments/history': {
      get: {
        tags: ['Candidate - Performance & History'],
        summary: 'Get past assessment attempts history',
        description: 'Returns historical completed and expired attempts with on-access expiry sweep.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Assessment attempt history retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'number' },
                    data: {
                      type: 'object',
                      properties: {
                        history: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              attemptId: { type: 'string' },
                              assessment: { $ref: '#/components/schemas/Assessment' },
                              attemptNumber: { type: 'number' },
                              status: { type: 'string' },
                              score: { type: 'number' },
                              totalMarks: { type: 'number' },
                              percentage: { type: 'number' },
                              passed: { type: 'boolean' },
                              timeTakenSeconds: { type: 'number' },
                              timeTakenMinutes: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/candidate/assessments/{id}/start': {
      post: {
        tags: ['Candidate - Assessments & Attempts'],
        summary: 'Start an assessment attempt',
        description:
          'Initiates an assessment attempt. If an active in-progress attempt already exists, safely resumes it (200). If time expired, auto-finalizes and starts next attempt.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Active assessment attempt resumed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'Active assessment attempt in progress' }, data: { type: 'object', properties: { attempt: { $ref: '#/components/schemas/AssessmentAttempt' } } } } } } } },
          201: { description: 'New assessment attempt started', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { attempt: { $ref: '#/components/schemas/AssessmentAttempt' } } } } } } } },
          400: { description: 'Invalid assessment ID or max attempts reached', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Assessment not found or unpublished', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/performance/topic-wise': {
      get: {
        tags: ['Candidate - Performance & History'],
        summary: 'Get topic-wise performance breakdown',
        description: 'Aggregates topic mastery metrics strictly from completed assessment attempts.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Topic-wise performance analysis',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        topics: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              topic: { type: 'string', example: 'Algorithms' },
                              score: { type: 'number', example: 24 },
                              totalMarks: { type: 'number', example: 30 },
                              accuracy: { type: 'number', example: 80.0 },
                              correctCount: { type: 'number', example: 12 },
                              totalQuestions: { type: 'number', example: 15 },
                              questionAccuracy: { type: 'number', example: 80.0 },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/candidate/attempts': {
      get: {
        tags: ['Candidate - Performance & History'],
        summary: 'Get candidate attempts list',
        description: 'Lists all attempts for candidate with optional assessmentId filter and on-access expiry sweep.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'assessmentId', in: 'query', required: false, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Attempts list retrieved',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, count: { type: 'number' }, data: { type: 'object', properties: { attempts: { type: 'array', items: { $ref: '#/components/schemas/AssessmentAttempt' } } } } } } } },
          },
        },
      },
    },
    '/api/candidate/attempts/{attemptId}/result': {
      get: {
        tags: ['Candidate - Performance & History'],
        summary: 'Get evaluated assessment attempt result',
        description: 'Returns evaluated attempt score, percentage, passing status, and topic breakdown.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Attempt result details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { result: { type: 'object' } } } } } } } },
          400: { description: 'Invalid attempt ID', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden (Not authorized to view attempt)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Assessment attempt not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/attempts/{attemptId}': {
      get: {
        tags: ['Candidate - Performance & History'],
        summary: 'Get attempt details by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Attempt details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { attempt: { $ref: '#/components/schemas/AssessmentAttempt' } } } } } } } },
          400: { description: 'Invalid attempt ID', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden (Ownership mismatch)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Assessment attempt not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/candidate/attempts/{attemptId}/submit': {
      post: {
        tags: ['Candidate - Assessments & Attempts'],
        summary: 'Submit assessment attempt',
        description: 'Server evaluates answers, computes score/topic breakdown, and atomically transitions status to completed.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['answers'],
                properties: {
                  answers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['questionId'],
                      properties: {
                        questionId: { type: 'string' },
                        selectedOptionIndex: { type: 'number', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Assessment submitted successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { attempt: { $ref: '#/components/schemas/AssessmentAttempt' } } } } } } } },
          400: { description: 'Time expired or already submitted/finalized by competing request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'Forbidden (Ownership mismatch)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Attempt or underlying assessment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/interview-slots': {
      get: {
        tags: ['Public Discovery'],
        summary: 'Discover available interview slots (Public)',
        description: 'Public endpoint listing future available slots with bookedCount < capacity.',
        responses: {
          200: {
            description: 'Available interview slots list',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, count: { type: 'number' }, data: { type: 'object', properties: { slots: { type: 'array', items: { $ref: '#/components/schemas/InterviewSlot' } } } } } } } },
          },
        },
      },
    },
    '/api/assessments': {
      get: {
        tags: ['Public Discovery'],
        summary: 'Discover published assessments (Public)',
        description: 'Public endpoint listing all active published mock assessments.',
        responses: {
          200: {
            description: 'Published assessments list',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, count: { type: 'number' }, data: { type: 'object', properties: { assessments: { type: 'array', items: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          },
        },
      },
    },
    '/api/assessments/{id}': {
      get: {
        tags: ['Public Discovery'],
        summary: 'Get published assessment details (Public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Assessment details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { assessment: { $ref: '#/components/schemas/Assessment' } } } } } } } },
          404: { description: 'Assessment not found or is unpublished', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/assessments/{id}/questions': {
      get: {
        tags: ['Public Discovery'],
        summary: 'Get candidate questions for assessment (Sanitized)',
        description: 'Returns question options and text. Answers and explanations are strictly excluded to maintain secrecy.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Sanitized questions without answer keys',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'number' },
                    data: {
                      type: 'object',
                      properties: {
                        questions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              _id: { type: 'string' },
                              assessmentId: { type: 'string' },
                              text: { type: 'string' },
                              options: { type: 'array', items: { type: 'string' } },
                              marks: { type: 'number' },
                              topic: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Assessment not found or unpublished', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get user notifications',
        description: 'Returns paginated in-app notifications for the authenticated user.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          200: {
            description: 'Notifications list retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'number' },
                    unreadCount: { type: 'number' },
                    pagination: { type: 'object' },
                    data: { type: 'object', properties: { notifications: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'All notifications marked as read', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark single notification as read',
        description: 'Marks notification as read. Returns 404 uniformly for nonexistent IDs or notifications owned by other users (anti-enumeration).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Notification marked as read', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', properties: { notification: { $ref: '#/components/schemas/Notification' } } } } } } } },
          400: { description: 'Invalid notification ID', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Notification not found (anti-enumeration protection)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
};

module.exports = swaggerSpec;
