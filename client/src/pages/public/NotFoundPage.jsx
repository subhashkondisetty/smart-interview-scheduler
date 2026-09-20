import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="page-container status-page notfound-page">
      <div className="status-card">
        <div className="status-icon">🔍</div>
        <span className="badge badge-warning">404 Not Found</span>
        <h1 className="status-title">Page Not Found</h1>
        <p className="status-message">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="status-actions">
          <Link to="/" className="btn btn-primary">
            Return to Home →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
