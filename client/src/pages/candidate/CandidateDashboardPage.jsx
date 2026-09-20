import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const CandidateDashboardPage = () => {
  const { user } = useAuth();

  return (
    <div className="page-container candidate-dashboard">
      <div className="dashboard-header">
        <span className="badge badge-scaffold">Phase 6 Scaffold • Stub Page</span>
        <h1>Candidate Dashboard</h1>
        <p className="welcome-text">
          Welcome back, <strong>{user?.email}</strong>! This overview aggregates your preparation roadmap.
        </p>
      </div>

      <div className="dashboard-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👤</div>
          <div className="metric-info">
            <span className="metric-label">Profile Completion</span>
            <span className="metric-value">--%</span>
          </div>
          <Link to="/candidate/profile" className="metric-link">Manage Profile →</Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📅</div>
          <div className="metric-info">
            <span className="metric-label">Upcoming Interview</span>
            <span className="metric-value">None</span>
          </div>
          <Link to="/candidate/slots" className="metric-link">Book Interview →</Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📝</div>
          <div className="metric-info">
            <span className="metric-label">Completed Attempts</span>
            <span className="metric-value">0</span>
          </div>
          <Link to="/candidate/assessments" className="metric-link">Take Assessments →</Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔔</div>
          <div className="metric-info">
            <span className="metric-label">Unread Notifications</span>
            <span className="metric-value">0</span>
          </div>
          <Link to="/candidate/notifications" className="metric-link">View Notifications →</Link>
        </div>
      </div>

      <div className="dashboard-preview-card">
        <h3>Backend Integration Planned for Phase 7:</h3>
        <ul>
          <li>Consolidated endpoint: <code>GET /api/candidate/dashboard</code></li>
          <li>Next upcoming interview countdown and direct meeting details</li>
          <li>Pending action checklist (profile completion, resume upload, pending assessments)</li>
        </ul>
      </div>
    </div>
  );
};

export default CandidateDashboardPage;
