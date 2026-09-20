import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import adminService from '../../services/adminService';
import DonutChart from '../../components/charts/DonutChart';
import ProgressBarChart from '../../components/charts/ProgressBarChart';
import ScoreGaugeRing from '../../components/charts/ScoreGaugeRing';

/**
 * Format timestamp into relative human readable string.
 */
const formatTimeAgo = (isoString) => {
  if (!isoString) return 'Recently';
  const now = new Date();
  const date = new Date(isoString);
  const diffSecs = Math.max(0, Math.floor((now - date) / 1000));

  if (diffSecs < 60) return 'Just now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 172800) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const AdminDashboardPage = () => {
  const { user } = useAuth();

  // Data & Lifecycle state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Activity Feed controls
  const [feedLimit, setFeedLimit] = useState(10);
  const [activityFilter, setActivityFilter] = useState('all'); // 'all' | 'candidate_registered' | 'interview_booking' | 'assessment_attempt'

  // Fetch Dashboard Aggregates
  const fetchDashboard = useCallback(async (limit = feedLimit) => {
    try {
      setLoading(true);
      setError(null);
      const metrics = await adminService.getDashboardMetrics({ limit });
      setData(metrics);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load admin dashboard metrics:', err);
      setError(err.response?.data?.message || 'Unable to retrieve administrative dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [feedLimit]);

  useEffect(() => {
    fetchDashboard(feedLimit);
  }, [fetchDashboard, feedLimit]);

  // Handle changing feed limit
  const handleLimitChange = (newLimit) => {
    setFeedLimit(newLimit);
  };

  // 1. Authoritative Total Interviews Scheduled
  // Read directly from interviewStats.totalScheduled, avoiding duplicate client-side addition
  const totalInterviewsScheduled = useMemo(() => {
    return data?.interviewStats?.totalScheduled ?? data?.totalInterviewsScheduled ?? 0;
  }, [data]);

  // 2. Booking Partitioning Data for Donut Chart
  const bookingChartData = useMemo(() => {
    const stats = data?.bookingStats || {};
    return [
      {
        key: 'upcoming',
        label: 'Upcoming',
        value: stats.upcoming || 0,
        color: '#3b82f6', // Blue
      },
      {
        key: 'completed',
        label: 'Completed',
        value: stats.completed || 0,
        color: '#10b981', // Green
      },
      {
        key: 'cancelled',
        label: 'Cancelled',
        value: stats.cancelled || 0,
        color: '#ef4444', // Red
      },
      {
        key: 'rescheduled',
        label: 'Rescheduled',
        value: stats.rescheduled || 0,
        color: '#f59e0b', // Amber
      },
    ];
  }, [data]);

  // 3. Assessment Progress Data
  const assessmentProgressItems = useMemo(() => {
    const aStats = data?.assessmentStats || {};
    const totalAssessments = aStats.totalAssessments || 0;
    const publishedCount = aStats.publishedCount || 0;
    const totalAttempts = aStats.totalAttempts || 0;
    const completedAttempts = aStats.completedAttempts || 0;

    return [
      {
        label: 'Assessments Published',
        value: publishedCount,
        max: totalAssessments,
        color: '#4f46e5',
        subtext: `of ${totalAssessments} live`,
      },
      {
        label: 'Attempt Completion Rate',
        value: completedAttempts,
        max: totalAttempts,
        color: '#10b981',
        subtext: `of ${totalAttempts} attempts`,
      },
    ];
  }, [data]);

  // 4. Filtered Recent Activity Feed
  const rawFeed = data?.recentActivityFeed || [];
  const filteredFeed = useMemo(() => {
    if (activityFilter === 'all') return rawFeed;
    return rawFeed.filter((item) => item.type === activityFilter);
  }, [rawFeed, activityFilter]);

  // Activity item badge and icon helper
  const getActivityMeta = (type, details = {}) => {
    switch (type) {
      case 'candidate_registered':
        return {
          icon: '👤',
          label: 'Candidate Registration',
          badgeClass: 'badge-primary',
        };
      case 'interview_booking': {
        const isCancelled = details.status === 'cancelled';
        const isRescheduled = details.status === 'rescheduled';
        return {
          icon: '📅',
          label: `Interview ${details.status || 'Booking'}`,
          badgeClass: isCancelled ? 'badge-danger' : isRescheduled ? 'badge-warning' : 'badge-info',
        };
      }
      case 'assessment_attempt': {
        const isExpired = details.status === 'expired';
        const isCompleted = details.status === 'completed';
        return {
          icon: '📝',
          label: `Assessment ${details.status || 'Attempt'}`,
          badgeClass: isCompleted ? 'badge-success' : isExpired ? 'badge-warning' : 'badge-secondary',
        };
      }
      default:
        return {
          icon: '⚡',
          label: 'System Event',
          badgeClass: 'badge-secondary',
        };
    }
  };

  if (loading && !data) {
    return (
      <div className="page-container admin-dashboard" data-testid="admin-dashboard-loading">
        <div className="auth-loading-screen">
          <div className="spinner" />
          <p>Loading administrative dashboard metrics...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-container admin-dashboard" data-testid="admin-dashboard-error">
        <div className="error-card">
          <h2>Failed to Load Dashboard</h2>
          <p>{error}</p>
          <button onClick={() => fetchDashboard(feedLimit)} className="btn btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const {
    totalCandidates = 0,
    interviewStats = {},
    bookingStats = {},
    assessmentStats = {},
  } = data || {};

  return (
    <div className="page-container admin-dashboard" data-testid="admin-dashboard">
      {/* 1. Header Banner */}
      <div className="admin-header-row">
        <div>
          <div className="admin-title-badge-row">
            <h1 className="admin-page-title" data-testid="admin-page-title">
              Operations Overview
            </h1>
            <span className="badge badge-success">System Active</span>
          </div>
          <p className="admin-welcome-text">
            Signed in as <strong>{user?.email}</strong>. Real-time platform aggregates and operational metrics.
          </p>
        </div>

        <div className="admin-header-actions">
          {lastRefreshed && (
            <span className="last-refreshed-text" data-testid="last-refreshed">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm btn-refresh"
            onClick={() => fetchDashboard(feedLimit)}
            disabled={loading}
            data-testid="btn-refresh-dashboard"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      {/* 2. Top KPI Stat Cards Grid (5 Authoritative Metrics) */}
      <div className="admin-metrics-strip" data-testid="admin-stat-cards-grid">
        {/* Total Candidates */}
        <div className="admin-stat-card" data-testid="stat-card-candidates">
          <div className="stat-card-top">
            <span className="stat-card-icon icon-candidates">👥</span>
            <Link to="/admin/candidates" className="stat-card-link" data-testid="link-manage-candidates">
              Manage →
            </Link>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value" data-testid="stat-value-candidates">
              {totalCandidates}
            </span>
            <span className="stat-card-label">Total Candidates</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-card-subtext">Active student & applicant accounts</span>
          </div>
        </div>

        {/* Scheduled Interviews (Read directly from interviewStats.totalScheduled) */}
        <div className="admin-stat-card" data-testid="stat-card-interviews">
          <div className="stat-card-top">
            <span className="stat-card-icon icon-interviews">📅</span>
            <Link to="/admin/bookings" className="stat-card-link" data-testid="link-manage-bookings">
              Manage →
            </Link>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value" data-testid="stat-value-interviews">
              {totalInterviewsScheduled}
            </span>
            <span className="stat-card-label">Scheduled Interviews</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-card-subtext" data-testid="stat-subtext-interviews">
              {interviewStats.upcoming || 0} upcoming • {interviewStats.completed || 0} completed
            </span>
          </div>
        </div>

        {/* Published Assessments */}
        <div className="admin-stat-card" data-testid="stat-card-assessments">
          <div className="stat-card-top">
            <span className="stat-card-icon icon-assessments">📝</span>
            <Link to="/admin/assessments" className="stat-card-link" data-testid="link-manage-assessments">
              Catalog →
            </Link>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value" data-testid="stat-value-assessments">
              {assessmentStats.publishedCount || 0}
            </span>
            <span className="stat-card-label">Live Assessments</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-card-subtext">
              of {assessmentStats.totalAssessments || 0} total created
            </span>
          </div>
        </div>

        {/* Platform Assessment Attempts */}
        <div className="admin-stat-card" data-testid="stat-card-attempts">
          <div className="stat-card-top">
            <span className="stat-card-icon icon-attempts">🎯</span>
            <span className="stat-card-trend">All Time</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value" data-testid="stat-value-attempts">
              {assessmentStats.totalAttempts || 0}
            </span>
            <span className="stat-card-label">Candidate Attempts</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-card-subtext">
              {assessmentStats.completedAttempts || 0} completed evaluations
            </span>
          </div>
        </div>

        {/* Average Candidate Score */}
        <div className="admin-stat-card" data-testid="stat-card-avg-score">
          <div className="stat-card-top">
            <span className="stat-card-icon icon-score">📈</span>
            <span className="stat-card-trend">Platform Avg</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value" data-testid="stat-value-avg-score">
              {assessmentStats.averagePercentage || 0}%
            </span>
            <span className="stat-card-label">Avg Test Score</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-card-subtext">
              Avg score: {assessmentStats.averageScore || 0} pts
            </span>
          </div>
        </div>
      </div>

      {/* 3. Visual Charts Grid (Interactive SVG Charts) */}
      <div className="admin-charts-grid" data-testid="admin-charts-grid">
        {/* Panel 1: Interview Booking Lifecycle & Partitioning (Donut Chart) */}
        <div className="admin-chart-card" data-testid="chart-card-bookings">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-card-title">Interview Booking Breakdown</h2>
              <p className="chart-card-subtitle">
                Mutually-exclusive lifecycle status partitioning ({bookingStats.total || 0} total reservations)
              </p>
            </div>
            <Link to="/admin/bookings" className="btn btn-outline btn-sm">
              View All
            </Link>
          </div>

          <div className="chart-card-body">
            <DonutChart
              data={bookingChartData}
              size={210}
              strokeWidth={26}
              centerLabel="Bookings"
              centerValue={bookingStats.total || 0}
            />
          </div>
        </div>

        {/* Panel 2: Assessment Engagement & Performance (Gauge + Progress Bars) */}
        <div className="admin-chart-card" data-testid="chart-card-assessments">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-card-title">Assessment Health & Proficiency</h2>
              <p className="chart-card-subtitle">
                Candidate completion progress and platform performance benchmarks
              </p>
            </div>
            <Link to="/admin/assessments" className="btn btn-outline btn-sm">
              Catalog
            </Link>
          </div>

          <div className="chart-card-body assessment-analytics-flex">
            {/* Average Score Gauge */}
            <div className="gauge-wrapper-col">
              <ScoreGaugeRing
                percentage={assessmentStats.averagePercentage || 0}
                scoreValue={assessmentStats.averageScore || 0}
                label="Avg Score"
                size={160}
                strokeWidth={16}
              />
            </div>

            {/* Horizontal Distribution Bars */}
            <div className="progress-bars-col">
              <ProgressBarChart items={assessmentProgressItems} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Activity Feed (2fr) + Operations Shortcuts (1fr) */}
      <div className="admin-content-grid">
        {/* Recent Activity Feed */}
        <div className="admin-activity-section" data-testid="admin-activity-section">
          <div className="activity-section-header">
            <div>
              <h2 className="section-title">Recent Platform Activity</h2>
              <p className="section-subtitle">
                Unified chronological timeline of registrations, bookings, and test submissions
              </p>
            </div>

            {/* Feed Limit Controls */}
            <div className="activity-limit-selector" data-testid="activity-limit-controls">
              <span className="limit-label">Limit:</span>
              {[5, 10, 25, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`btn-limit ${feedLimit === num ? 'active' : ''}`}
                  onClick={() => handleLimitChange(num)}
                  data-testid={`btn-limit-${num}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="activity-filter-bar">
            <div className="activity-filter-pills" data-testid="activity-filter-pills">
              <button
                type="button"
                className={`filter-pill ${activityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActivityFilter('all')}
                data-testid="filter-all"
              >
                All ({rawFeed.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${activityFilter === 'candidate_registered' ? 'active' : ''}`}
                onClick={() => setActivityFilter('candidate_registered')}
                data-testid="filter-registrations"
              >
                Registrations
              </button>
              <button
                type="button"
                className={`filter-pill ${activityFilter === 'interview_booking' ? 'active' : ''}`}
                onClick={() => setActivityFilter('interview_booking')}
                data-testid="filter-interviews"
              >
                Interviews
              </button>
              <button
                type="button"
                className={`filter-pill ${activityFilter === 'assessment_attempt' ? 'active' : ''}`}
                onClick={() => setActivityFilter('assessment_attempt')}
                data-testid="filter-assessments"
              >
                Assessments
              </button>
            </div>

            {/* Match Counter */}
            <span className="filter-match-count" data-testid="filter-match-count">
              Showing {filteredFeed.length} of {rawFeed.length}
            </span>
          </div>

          {/* Explicit Context Guidance Note */}
          <div className="activity-feed-disclaimer" data-testid="activity-feed-disclaimer">
            <span className="disclaimer-icon">ℹ️</span>
            <span className="disclaimer-text">
              Filtered from your most recent <strong>{feedLimit}</strong> total activity events. Increase the feed limit (up to 50) to see more historical events.
            </span>
          </div>

          {/* Feed List */}
          <div className="activity-feed-list" data-testid="activity-feed-list">
            {filteredFeed.length === 0 ? (
              <div className="empty-state-card activity-empty" data-testid="activity-empty-state">
                <span className="empty-icon">📭</span>
                <h3>No activity matches</h3>
                <p>
                  No events found for this filter within the latest {feedLimit} records. Try selecting "All" or increasing the feed limit.
                </p>
              </div>
            ) : (
              filteredFeed.map((item) => {
                const meta = getActivityMeta(item.type, item.details);
                return (
                  <div
                    key={item.id}
                    className="activity-item-card"
                    data-testid="activity-item"
                    data-activity-type={item.type}
                  >
                    <div className="activity-icon-col">
                      <span className="activity-type-icon">{meta.icon}</span>
                    </div>

                    <div className="activity-body-col">
                      <div className="activity-meta-row">
                        <span
                          className={`badge ${meta.badgeClass} activity-badge`}
                          data-testid="activity-badge"
                        >
                          {meta.label}
                        </span>
                        <span className="activity-timestamp" title={item.timestamp}>
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="activity-message" data-testid="activity-message">
                        {item.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Operations Console */}
        <div className="admin-shortcuts-section" data-testid="admin-shortcuts-section">
          <div className="shortcuts-card">
            <h2 className="shortcuts-title">Operations Console</h2>
            <p className="shortcuts-subtitle">Quick access to primary administration workflows</p>

            <div className="shortcuts-list">
              <Link to="/admin/candidates" className="shortcut-item" data-testid="shortcut-candidates">
                <div className="shortcut-icon">👥</div>
                <div className="shortcut-text">
                  <strong>Manage Candidates</strong>
                  <span>Oversee registrations, view candidate 360 profiles, toggle access</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </Link>

              <Link to="/admin/slots" className="shortcut-item" data-testid="shortcut-slots">
                <div className="shortcut-icon">⏱️</div>
                <div className="shortcut-text">
                  <strong>Manage Interview Slots</strong>
                  <span>Create availability, define capacities, set meeting links</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </Link>

              <Link to="/admin/bookings" className="shortcut-item" data-testid="shortcut-bookings">
                <div className="shortcut-icon">📅</div>
                <div className="shortcut-text">
                  <strong>Candidate Bookings</strong>
                  <span>Review reservations, track attendance, manage reschedules</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </Link>

              <Link to="/admin/assessments" className="shortcut-item" data-testid="shortcut-assessments">
                <div className="shortcut-icon">📝</div>
                <div className="shortcut-text">
                  <strong>Assessment Catalog</strong>
                  <span>Configure tests, update passing rates, publish evaluations</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </Link>

              <Link to="/admin/questions" className="shortcut-item" data-testid="shortcut-questions">
                <div className="shortcut-icon">💡</div>
                <div className="shortcut-text">
                  <strong>Question Bank</strong>
                  <span>Maintain questions, assign topic tags, author answer keys</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </Link>

              <Link to="/admin/broadcast" className="shortcut-item" data-testid="shortcut-broadcast">
                <div className="shortcut-icon">📢</div>
                <div className="shortcut-text">
                  <strong>System Broadcast</strong>
                  <span>Send announcements to all registered platform candidates</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
