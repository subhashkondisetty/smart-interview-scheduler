import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';

const CandidateDashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await api.get('/candidate/dashboard');
        if (isMounted && res.data?.data) {
          setDashboardData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load candidate dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const targetRole = dashboardData?.targetRole;
  const completionPct = dashboardData?.profileCompletionPercentage ?? 0;
  const upcomingInterview = dashboardData?.nextUpcomingInterview;
  const recentAttemptsCount = dashboardData?.recentAttempts?.length ?? 0;
  const unreadCount = dashboardData?.unreadNotificationsCount ?? 0;
  const pendingActions = dashboardData?.pendingActions || [];

  return (
    <div className="page-container candidate-dashboard" data-testid="candidate-dashboard-page">
      <div className="dashboard-header">
        <div className="badge-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <span className="badge badge-candidate">Candidate Space</span>
          {targetRole ? (
            <span className="badge badge-target-role" data-testid="dashboard-target-role-badge">
              🎯 {targetRole}
            </span>
          ) : (
            <Link to="/candidate/profile" className="badge badge-outline" data-testid="dashboard-target-role-badge">
              🎯 Target Role: Not set • Set in profile
            </Link>
          )}
        </div>
        <h1>Candidate Dashboard</h1>
        <p className="welcome-text">
          Welcome back, <strong>{user?.email}</strong>! This overview aggregates your preparation roadmap and metrics.
        </p>
      </div>

      <div className="dashboard-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👤</div>
          <div className="metric-info">
            <span className="metric-label">Profile Completion</span>
            <span className="metric-value">{loading ? '--%' : `${completionPct}%`}</span>
          </div>
          <Link to="/candidate/profile" className="metric-link">Manage Profile →</Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📅</div>
          <div className="metric-info">
            <span className="metric-label">Upcoming Interview</span>
            <span className="metric-value">
              {upcomingInterview ? (upcomingInterview.slot?.title || 'Scheduled') : 'None'}
            </span>
          </div>
          <Link to="/candidate/slots" className="metric-link">Book Interview →</Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📝</div>
          <div className="metric-info">
            <span className="metric-label">Recent Attempts</span>
            <span className="metric-value">{loading ? '0' : recentAttemptsCount}</span>
          </div>
          <Link to="/candidate/assessments" className="metric-link">Take Assessments →</Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔔</div>
          <div className="metric-info">
            <span className="metric-label">Unread Notifications</span>
            <span className="metric-value">{loading ? '0' : unreadCount}</span>
          </div>
          <Link to="/candidate/notifications" className="metric-link">View Notifications →</Link>
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div className="dashboard-preview-card" style={{ marginTop: '24px' }}>
          <h3>Pending Action Items:</h3>
          <ul>
            {pendingActions.map((action, idx) => (
              <li key={idx}>⚠️ {action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CandidateDashboardPage;
