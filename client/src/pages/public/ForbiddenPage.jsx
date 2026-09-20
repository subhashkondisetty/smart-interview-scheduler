import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const ForbiddenPage = () => {
  const { isAuthenticated, isCandidate } = useAuth();

  return (
    <div className="page-container status-page forbidden-page">
      <div className="status-card">
        <div className="status-icon">🛡️</div>
        <span className="badge badge-danger">403 Forbidden</span>
        <h1 className="status-title">Access Denied</h1>
        <p className="status-message">
          You do not have administrative privileges to access this resource. This route is strictly reserved for platform administrators.
        </p>

        <div className="status-actions">
          {isAuthenticated && isCandidate && (
            <Link to="/candidate/dashboard" className="btn btn-primary">
              Return to Candidate Dashboard →
            </Link>
          )}
          <Link to="/" className="btn btn-outline">
            Return to Home
          </Link>
          {!isAuthenticated && (
            <Link to="/login" className="btn btn-secondary">
              Sign In with Admin Account
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
