import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const PublicSlotsPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="page-container stub-page">
      <div className="stub-header">
        <span className="badge badge-scaffold">Phase 6 Scaffold • Stub Page</span>
        <h2>Available Interview Slots (Discovery)</h2>
        <p className="stub-description">
          Public browse interface for viewing upcoming available interview slots. Candidates must authenticate to book slots.
        </p>
      </div>

      <div className="stub-body">
        <div className="info-card">
          <h4>Planned Functionality (Phase 7):</h4>
          <ul>
            <li>Fetches live upcoming slots via <code>GET /api/interview-slots</code></li>
            <li>Displays date, time window, interviewer, and available capacity</li>
            <li>Direct "Book Slot" action with authenticated session verification</li>
          </ul>

          <div className="stub-actions">
            {isAuthenticated ? (
              <Link to="/candidate/slots" className="btn btn-primary">
                Go to Booking Portal →
              </Link>
            ) : (
              <Link to="/login" className="btn btn-outline">
                Sign In to Book Slots →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicSlotsPage;
