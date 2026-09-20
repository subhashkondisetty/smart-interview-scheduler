import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const HomePage = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <span className="badge badge-hero">🚀 SDE Interview & Assessment Engine</span>
          <h1 className="hero-headline">
            Master Technical Interviews with Confidence
          </h1>
          <p className="hero-description">
            Schedule real-time mock interviews with guaranteed capacity protection, attempt strictly timed MCQ assessments with privacy-shielded question scoring, and pinpoint skill gaps with topic analytics.
          </p>

          <div className="hero-cta-group">
            {isAuthenticated ? (
              <Link
                to={isAdmin ? '/admin/dashboard' : '/candidate/dashboard'}
                className="btn btn-primary btn-lg"
              >
                Go to {isAdmin ? 'Admin Console' : 'Candidate Dashboard'} →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Create Candidate Account
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="hero-stats-row">
          <div className="stat-box">
            <span className="stat-number">100%</span>
            <span className="stat-label">Atomic Race Protection</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">0%</span>
            <span className="stat-label">Client Answer Leakage</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">2-Min</span>
            <span className="stat-label">Auto-Expiry Sweeps</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">RBAC</span>
            <span className="stat-label">Role-Isolated Navigation</span>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="landing-section">
        <div className="section-heading">
          <h2>Core Platform Pillars</h2>
          <p>Everything you need for comprehensive software engineering interview preparation.</p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon">📅</div>
            <h3>Atomic Slot Scheduling</h3>
            <p>
              Book interview slots with MongoDB-level concurrency guards that prevent overbooking. Compensating rollback protects rescheduling transactions.
            </p>
            <Link to="/slots" className="pillar-link">
              Explore Available Slots →
            </Link>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">⏱️</div>
            <h3>Timed Mock Assessments</h3>
            <p>
              Simulate high-stakes coding assessments with synchronized timers, maximum attempt enforcement, and zero answer key exposure.
            </p>
            <Link to="/assessments" className="pillar-link">
              Browse Quiz Catalog →
            </Link>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">📊</div>
            <h3>Topic-Wise Analytics</h3>
            <p>
              Gain actionable insights with aggregated topic proficiency metrics, detailed question scorecards, and historical progress tracking.
            </p>
            <span className="badge badge-info">Candidate Dashboard</span>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">🔔</div>
            <h3>In-App Notifications</h3>
            <p>
              Stay updated with instantaneous confirmation alerts, schedule changes, assessment results, and administrative platform broadcasts.
            </p>
            <span className="badge badge-info">Real-Time Updates</span>
          </div>
        </div>
      </section>

      {/* How It Works Workflow */}
      <section className="landing-section bg-alt">
        <div className="section-heading">
          <h2>How SmartPrep Works</h2>
          <p>A streamlined four-step path to interview readiness.</p>
        </div>

        <div className="workflow-steps">
          <div className="step-card">
            <div className="step-badge">1</div>
            <h4>Register & Profile</h4>
            <p>Sign up as a candidate, add your professional details, and upload your resume with automated completion scoring.</p>
          </div>

          <div className="step-card">
            <div className="step-badge">2</div>
            <h4>Book an Interview</h4>
            <p>Select an available mock interview slot with an experienced interviewer. Need to adjust? Reschedule in one click.</p>
          </div>

          <div className="step-card">
            <div className="step-badge">3</div>
            <h4>Solve Assessments</h4>
            <p>Take timed technical quizzes under test conditions. Auto-expiry sweeps ensure strict fairness and deadline adherence.</p>
          </div>

          <div className="step-card">
            <div className="step-badge">4</div>
            <h4>Review & Improve</h4>
            <p>Review comprehensive score reports, topic-wise breakdown percentages, and prepare for your real-world job interviews.</p>
          </div>
        </div>
      </section>

      {/* Dual Perspective: Candidate vs Admin */}
      <section className="landing-section">
        <div className="section-heading">
          <h2>Built for Both Candidates & Administrators</h2>
          <p>Dedicated environments tailored to specific preparation and coordination workflows.</p>
        </div>

        <div className="perspective-grid">
          <div className="perspective-card candidate-perspective">
            <div className="perspective-header">
              <span className="role-badge role-candidate">Candidate Experience</span>
              <h3>Prepare & Perform</h3>
            </div>
            <ul className="perspective-list">
              <li>✓ Real-time interview slot booking with instant confirmation</li>
              <li>✓ Resume upload with file validation (PDF, DOC, DOCX up to 5MB)</li>
              <li>✓ Timed MCQ quizzes with instant scoring and explanation feedback</li>
              <li>✓ Topic-wise analytics dashboard tracking strength & growth areas</li>
            </ul>
            <div className="perspective-action">
              <Link to="/register" className="btn btn-primary btn-block">
                Start as Candidate
              </Link>
            </div>
          </div>

          <div className="perspective-card admin-perspective">
            <div className="perspective-header">
              <span className="role-badge role-admin">Administrator Console</span>
              <h3>Coordinate & Supervise</h3>
            </div>
            <ul className="perspective-list">
              <li>✓ Dynamic interview slot capacity and overlap prevention</li>
              <li>✓ Assessment publishing engine with question bank management</li>
              <li>✓ Platform analytics with partitioned booking metrics and KPI feeds</li>
              <li>✓ Broadcast notification system for platform-wide announcements</li>
            </ul>
            <div className="perspective-action">
              <Link to="/login" className="btn btn-outline btn-block">
                Admin Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="landing-cta-banner">
        <h2>Ready to Supercharge Your Engineering Career?</h2>
        <p>Join hundreds of candidates practicing with SmartPrep today.</p>
        <div className="cta-actions">
          <Link to="/register" className="btn btn-primary btn-lg">
            Get Started Free
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Already Have an Account? Log In
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
