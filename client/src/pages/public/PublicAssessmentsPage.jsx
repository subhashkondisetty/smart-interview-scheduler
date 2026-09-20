import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const PublicAssessmentsPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="page-container stub-page">
      <div className="stub-header">
        <span className="badge badge-scaffold">Phase 6 Scaffold • Stub Page</span>
        <h2>Explore Technical Assessments</h2>
        <p className="stub-description">
          Browse published mock quizzes, test difficulty levels, and durations.
        </p>
      </div>

      <div className="stub-body">
        <div className="info-card">
          <h4>Planned Functionality (Phase 7):</h4>
          <ul>
            <li>Fetches published assessments via <code>GET /api/assessments</code></li>
            <li>Displays title, difficulty badge, duration, question count, and passing threshold</li>
            <li>Direct link to start or resume assessment attempts</li>
          </ul>

          <div className="stub-actions">
            {isAuthenticated ? (
              <Link to="/candidate/assessments" className="btn btn-primary">
                View Candidate Assessments →
              </Link>
            ) : (
              <Link to="/login" className="btn btn-outline">
                Sign In to Take Assessments →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicAssessmentsPage;
