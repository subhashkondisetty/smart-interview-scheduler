require('dotenv').config();
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('./app');
const { startExpiryCron } = require('./services/cronService');
const User = require('./models/User');
const CandidateProfile = require('./models/CandidateProfile');
const InterviewSlot = require('./models/InterviewSlot');
const InterviewBooking = require('./models/InterviewBooking');
const Assessment = require('./models/Assessment');
const Question = require('./models/Question');
const Notification = require('./models/Notification');

const PORT = process.env.PORT || 5000;

async function startDev() {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'local_development_secret_key_minimum_32_characters_for_jwt_auth';
  process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

  let mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('[Dev Server] Initializing in-memory MongoDB engine (mongodb-memory-server)...');
    const mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;
    console.log(`[Dev Server] In-memory MongoDB engine running at: ${mongoUri}`);
  }

  await mongoose.connect(mongoUri);
  console.log(`[Dev Server] Connected to MongoDB.`);

  // Seed sample demo accounts if database is empty
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    console.log('[Dev Server] Seeding demo administrator and candidate accounts...');

    // 1. Admin User
    const adminUser = await User.create({
      email: 'admin@smartprep.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });

    // 2. Candidate Users
    const candidateUser = await User.create({
      email: 'candidate@smartprep.com',
      password: 'Password123!',
      role: 'candidate',
      isActive: true,
    });

    const candidateUser2 = await User.create({
      email: 'alex.dev@smartprep.com',
      password: 'Password123!',
      role: 'candidate',
      isActive: true,
    });

    // 3. Profiles
    const profile1 = new CandidateProfile({
      user: candidateUser._id,
      fullName: 'Sarah Connor',
      phone: '+1 (555) 234-5678',
      location: 'San Francisco, CA',
      headline: 'Senior Full Stack Engineer | React & Node.js Specialist',
      bio: 'Passionate full-stack developer with 5+ years of experience designing scalable microservices, high-performance UI systems, and cloud infrastructure.',
      githubUrl: 'https://github.com/sarahconnor',
      linkedinUrl: 'https://linkedin.com/in/sarahconnor',
      portfolioUrl: 'https://sarahconnor.dev',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'MongoDB', 'Docker', 'GraphQL'],
      experienceLevel: 'senior',
      yearsOfExperience: 5,
      education: [
        {
          institution: 'University of California, Berkeley',
          degree: 'B.S. in Computer Science',
          fieldOfStudy: 'Computer Science',
          graduationYear: 2020,
          gpa: '3.85',
        },
      ],
      resume: {
        url: '/uploads/resumes/demo-resume.pdf',
        fileName: 'demo-resume.pdf',
        originalName: 'Sarah_Connor_Senior_FullStack_Resume.pdf',
        uploadedAt: new Date(),
      },
    });
    profile1.profileCompletionPercentage = profile1.calculateCompletion();
    await profile1.save();

    const profile2 = new CandidateProfile({
      user: candidateUser2._id,
      fullName: 'Alex Rivera',
      phone: '+1 (555) 876-5432',
      location: 'Austin, TX',
      headline: 'Staff Cloud Infrastructure Architect',
      bio: 'Specialist in distributed consensus, Kubernetes operators, multi-region database failover, and high-throughput systems.',
      skills: ['Distributed Systems', 'Kubernetes', 'Go', 'AWS', 'Raft Protocol', 'PostgreSQL'],
      experienceLevel: 'lead',
      yearsOfExperience: 8,
      education: [
        {
          institution: 'University of Texas at Austin',
          degree: 'M.S. in Software Engineering',
          fieldOfStudy: 'Distributed Systems',
          graduationYear: 2018,
          gpa: '3.92',
        },
      ],
    });
    profile2.profileCompletionPercentage = profile2.calculateCompletion();
    await profile2.save();

    // 4. Interview Slots
    const tomorrow10am = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow10am.setHours(10, 0, 0, 0);
    const tomorrow2pm = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow2pm.setHours(14, 0, 0, 0);
    const dayAfter11am = new Date(Date.now() + 48 * 60 * 60 * 1000);
    dayAfter11am.setHours(11, 0, 0, 0);
    const nextWeek3pm = new Date(Date.now() + 96 * 60 * 60 * 1000);
    nextWeek3pm.setHours(15, 0, 0, 0);

    const slot1 = await InterviewSlot.create({
      title: 'Full-Stack System Design Mock Panel',
      interviewerName: 'Marcus Vance (Principal Architect)',
      startTime: tomorrow10am,
      endTime: new Date(tomorrow10am.getTime() + 45 * 60000),
      durationMinutes: 45,
      capacity: 2,
      bookedCount: 1,
      status: 'available',
      meetingLink: 'https://meet.google.com/smart-design-panel',
      description: 'In-depth mock interview focusing on distributed caching strategies, microservices boundaries, database sharding, and real-time event streaming.',
      createdBy: adminUser._id,
    });

    const slot2 = await InterviewSlot.create({
      title: 'Frontend Architecture & React Patterns',
      interviewerName: 'Elena Rostova (Staff Frontend Engineer)',
      startTime: tomorrow2pm,
      endTime: new Date(tomorrow2pm.getTime() + 45 * 60000),
      durationMinutes: 45,
      capacity: 1,
      bookedCount: 0,
      status: 'available',
      meetingLink: 'https://meet.google.com/smart-frontend-mock',
      description: 'Focus on concurrent rendering, custom hooks, global state tradeoffs, Web Vitals optimization, and CSS architecture.',
      createdBy: adminUser._id,
    });

    const slot3 = await InterviewSlot.create({
      title: 'Distributed Systems & Scalability Evaluation',
      interviewerName: 'Dr. Aris Thorne (Distinguished Engineer)',
      startTime: dayAfter11am,
      endTime: new Date(dayAfter11am.getTime() + 60 * 60000),
      durationMinutes: 60,
      capacity: 1,
      bookedCount: 1,
      status: 'booked',
      meetingLink: 'https://meet.google.com/smart-dist-systems',
      description: 'Consensus mechanisms, Raft/Paxos trade-offs, vector clocks, and resilient partition tolerance across heterogeneous cloud availability zones.',
      createdBy: adminUser._id,
    });

    const slot4 = await InterviewSlot.create({
      title: 'Data Structures & Algorithmic Problem Solving',
      interviewerName: 'Priya Sharma (Senior Tech Lead)',
      startTime: nextWeek3pm,
      endTime: new Date(nextWeek3pm.getTime() + 45 * 60000),
      durationMinutes: 45,
      capacity: 3,
      bookedCount: 0,
      status: 'available',
      meetingLink: 'https://meet.google.com/smart-algo-mock',
      description: 'Interactive pair coding with dynamic programming, graph traversals, topological sort, and optimal memory management.',
      createdBy: adminUser._id,
    });

    // 5. Bookings
    await InterviewBooking.create({
      candidate: candidateUser._id,
      slot: slot1._id,
      status: 'confirmed',
      notes: 'Focus on event-driven architectures with Kafka and eventual consistency.',
    });

    await InterviewBooking.create({
      candidate: candidateUser2._id,
      slot: slot3._id,
      status: 'confirmed',
      notes: 'Interested in exploring Raft leader election edge cases under network split.',
    });

    // 6. Assessments & Questions
    const assess1 = await Assessment.create({
      title: 'Full Stack Engineering Evaluation',
      description: 'Assess core competencies across modern JavaScript, React concurrency, Node.js asynchronous runtimes, and RESTful API design.',
      difficulty: 'intermediate',
      durationMinutes: 30,
      passingPercentage: 70,
      maxAttempts: 3,
      isPublished: true,
      createdBy: adminUser._id,
    });

    await Question.create([
      {
        assessmentId: assess1._id,
        text: 'In React 18, which hook is best suited to defer rendering a non-urgent UI update to keep the main thread responsive?',
        options: ['useDeferredValue', 'useLayoutEffect', 'useImperativeHandle', 'useRef'],
        correctOptionIndex: 0,
        marks: 10,
        topic: 'React',
        difficulty: 'intermediate',
      },
      {
        assessmentId: assess1._id,
        text: 'In the Node.js event loop, which phase processes callbacks scheduled with process.nextTick()?',
        options: [
          'Immediately after the current operation finishes, before moving to the next event loop phase',
          'During the Poll phase only',
          'During the Timers phase after setTimeout',
          'At the start of the Check phase before setImmediate',
        ],
        correctOptionIndex: 0,
        marks: 10,
        topic: 'Node.js',
        difficulty: 'advanced',
      },
      {
        assessmentId: assess1._id,
        text: 'What HTTP status code should be returned when an atomic update fails due to an optimistic concurrency version mismatch?',
        options: ['409 Conflict', '400 Bad Request', '404 Not Found', '500 Internal Server Error'],
        correctOptionIndex: 0,
        marks: 10,
        topic: 'API Design',
        difficulty: 'intermediate',
      },
    ]);

    const assess2 = await Assessment.create({
      title: 'Cloud Architecture & Distributed Systems',
      description: 'Evaluate your mastery of horizontal scaling, microservices design patterns, CAP theorem nuances, and data replication strategies.',
      difficulty: 'advanced',
      durationMinutes: 45,
      passingPercentage: 65,
      maxAttempts: 2,
      isPublished: true,
      createdBy: adminUser._id,
    });

    await Question.create([
      {
        assessmentId: assess2._id,
        text: 'According to the CAP theorem, in the presence of a network partition (P), what trade-off must a distributed system make?',
        options: [
          'Choose between Consistency (C) and Availability (A)',
          'Choose between Performance (P) and Latency (L)',
          'Discard durability guarantees',
          'Revert immediately to single-node architecture',
        ],
        correctOptionIndex: 0,
        marks: 10,
        topic: 'Distributed Systems',
        difficulty: 'advanced',
      },
      {
        assessmentId: assess2._id,
        text: 'Which distributed consensus algorithm decomposes consensus into leader election, log replication, and safety?',
        options: ['Raft', 'Paxos', 'Two-Phase Commit', 'Gossip Protocol'],
        correctOptionIndex: 0,
        marks: 10,
        topic: 'Distributed Systems',
        difficulty: 'advanced',
      },
    ]);

    // 7. Notifications
    await Notification.create([
      {
        userId: candidateUser._id,
        title: 'Interview Booking Confirmed',
        message: 'Your mock interview "Full-Stack System Design Mock Panel" with Marcus Vance has been confirmed.',
        type: 'booking_confirmed',
        isRead: false,
      },
      {
        userId: candidateUser._id,
        title: 'Welcome to SmartPrep!',
        message: 'Welcome to Smart Interview Scheduler! Complete your profile to unlock personalized assessment recommendations.',
        type: 'system',
        isRead: true,
      },
    ]);

    console.log('[Dev Server] Demo accounts & database documents seeded successfully!');
  }

  // Start background auto-expiry cron task
  startExpiryCron();

  // Start Express API server
  const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 SmartPrep Backend API running on port ${PORT}`);
    console.log(`  🔗 API Root:         http://localhost:${PORT}/api`);
    console.log(`  📚 Swagger Docs:     http://localhost:${PORT}/api-docs`);
    console.log(`======================================================\n`);
  });

  const gracefulShutdown = async () => {
    console.log('\nShutting down dev server...');
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

startDev().catch((err) => {
  console.error('[Dev Server] Failed to start:', err);
  process.exit(1);
});