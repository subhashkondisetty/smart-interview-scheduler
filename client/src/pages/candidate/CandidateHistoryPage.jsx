import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import assessmentService from '../../services/assessmentService';

const CandidateHistoryPage = () => {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'topics'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'expired' | 'passed' | 'failed'

  const [history, setHistory] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [historyData, topicsData] = await Promise.all([
        assessmentService.getAssessmentHistory(),
        assessmentService.getTopicWisePerformance(),
      ]);

      setHistory(Array.isArray(historyData) ? historyData : []);
      setTopics(Array.isArray(topicsData) ? topicsData : []);
    } catch (err) {
      console.error('Failed to load candidate history and analytics:', err);
      setError('Unable to load attempt history and topic analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Summary KPIs
  const summaryKpis = useMemo(() => {
    const totalAttempts = history.length;
    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        passedCount: 0,
        passRate: 0,
        averageScore: 0,
        topTopic: 'N/A',
      };
    }

    const passedCount = history.filter((h) => h.passed).length;
    const passRate = Math.round((passedCount / totalAttempts) * 100);

    // Compute Average Score strictly across completed attempts (aligns with Decision #15 and Candidate Dashboard)
    const completedAttempts = history.filter((h) => h.status === 'completed');
    const averageScore =
      completedAttempts.length > 0
        ? Math.round(
            completedAttempts.reduce((acc, h) => acc + (h.percentage || 0), 0) / completedAttempts.length
          )
        : 0;

    // Find highest accuracy topic
    let topTopic = 'N/A';
    if (topics.length > 0) {
      const sortedTopics = [...topics].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
      topTopic = sortedTopics[0].topic;
    }

    return {
      totalAttempts,
      passedCount,
      passRate,
      averageScore,
      topTopic,
    };
  }, [history, topics]);

  // Filter attempt history
  const filteredHistory = useMemo(() => {
    return history.filter((att) => {
      if (statusFilter === 'completed') return att.status === 'completed';
      if (statusFilter === 'expired') return att.status === 'expired';
      if (statusFilter === 'passed') return Boolean(att.passed);
      if (statusFilter === 'failed') return !att.passed;
      return true; // 'all'
    });
  }, [history, statusFilter]);

  if (loading) {
    return (
      <div className="page-container" data-testid="loading-state">
        <div className="loading-spinner-container">
          <div className="spinner"></div>
          <p>Loading your attempt history and topic analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container" data-testid="error-state">
        <div className="error-card">
          <h3>Failed to Load Analytics</h3>
          <p>{error}</p>
          <button onClick={fetchData} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container candidate-history-page" data-testid="history-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attempt History & Topic Analytics</h1>
          <p className="page-subtitle">
            Track your assessment trajectory, review past submissions, and inspect topic-level technical strengths.
          </p>
        </div>
        <div className="header-actions">
          <Link to="/candidate/assessments" className="btn btn-primary">
            Browse Assessments →
          </Link>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <section className="history-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Attempts</span>
          <span className="kpi-value" data-testid="kpi-total-attempts">
            {summaryKpis.totalAttempts}
          </span>
          <span className="kpi-subtext">Completed & Expired</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Overall Pass Rate</span>
          <span className="kpi-value" data-testid="kpi-pass-rate">
            {summaryKpis.passRate}%
          </span>
          <span className="kpi-subtext">
            {summaryKpis.passedCount} of {summaryKpis.totalAttempts} passed
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Average Score</span>
          <span className="kpi-value" data-testid="kpi-avg-score">
            {summaryKpis.averageScore}%
          </span>
          <span className="kpi-subtext">Across completed attempts</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Strongest Domain</span>
          <span className="kpi-value kpi-value-text" data-testid="kpi-top-topic">
            {summaryKpis.topTopic}
          </span>
          <span className="kpi-subtext">Highest accuracy topic</span>
        </div>
      </section>

      {/* View Switcher Tabs */}
      <div className="view-tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          data-testid="tab-history"
        >
          <span className="tab-icon">📋</span> Attempt History ({history.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'topics' ? 'active' : ''}`}
          onClick={() => setActiveTab('topics')}
          data-testid="tab-topics"
        >
          <span className="tab-icon">📊</span> Topic Performance ({topics.length})
        </button>
      </div>

      {/* Tab 1: Attempt History View */}
      {activeTab === 'history' && (
        <div className="tab-pane-history">
          {/* Status Filter Pills */}
          <div className="filter-pills-bar">
            <span className="filter-label">Filter By:</span>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
              data-testid="filter-all"
            >
              All ({history.length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
              data-testid="filter-completed"
            >
              Completed ({history.filter((h) => h.status === 'completed').length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'expired' ? 'active' : ''}`}
              onClick={() => setStatusFilter('expired')}
              data-testid="filter-expired"
            >
              Expired ({history.filter((h) => h.status === 'expired').length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'passed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('passed')}
              data-testid="filter-passed"
            >
              Passed ({history.filter((h) => h.passed).length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'failed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('failed')}
              data-testid="filter-failed"
            >
              Failed ({history.filter((h) => !h.passed).length})
            </button>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="empty-state-card">
              <span className="empty-icon">📝</span>
              <h3>No attempts found</h3>
              <p>
                {statusFilter === 'all'
                  ? "You haven't attempted any assessments yet. Browse published assessments to get started."
                  : `No attempts found matching the "${statusFilter}" filter.`}
              </p>
              {statusFilter === 'all' ? (
                <Link to="/candidate/assessments" className="btn btn-primary">
                  Explore Assessments
                </Link>
              ) : (
                <button onClick={() => setStatusFilter('all')} className="btn btn-secondary">
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="history-cards-list">
              {filteredHistory.map((att) => {
                const assessment = att.assessment || {};
                const isPassed = Boolean(att.passed);
                const isExpired = att.status === 'expired';
                const attemptDate = att.createdAt
                  ? new Date(att.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'N/A';

                return (
                  <div
                    key={att.attemptId}
                    className="history-attempt-card"
                    data-testid="history-attempt-card"
                  >
                    <div className="attempt-card-main">
                      <div className="attempt-title-row">
                        <h3 className="attempt-title">{assessment.title || 'Technical Assessment'}</h3>
                        <div className="attempt-badges">
                          <span className="badge badge-outline">Attempt #{att.attemptNumber}</span>
                          {assessment.difficulty && (
                            <span
                              className={`badge badge-difficulty badge-${assessment.difficulty.toLowerCase()}`}
                            >
                              {assessment.difficulty}
                            </span>
                          )}
                          {isExpired ? (
                            <span
                              className="badge badge-warning"
                              data-testid="history-status-badge"
                            >
                              Expired
                            </span>
                          ) : (
                            <span
                              className="badge badge-neutral"
                              data-testid="history-status-badge"
                            >
                              Completed
                            </span>
                          )}
                          {isPassed ? (
                            <span className="badge badge-success">Passed</span>
                          ) : (
                            <span className="badge badge-danger">Not Passed</span>
                          )}
                        </div>
                      </div>

                      <div className="attempt-meta-row">
                        <span className="meta-item">
                          📅 {attemptDate}
                        </span>
                        <span className="meta-separator">•</span>
                        <span className="meta-item">
                          ⏱️ Time taken: {att.timeTakenMinutes} mins
                        </span>
                        <span className="meta-separator">•</span>
                        <span className="meta-item">
                          Passing requirement: {assessment.passingPercentage ?? 60}%
                        </span>
                      </div>
                    </div>

                    <div className="attempt-card-score-box">
                      <div className="score-summary">
                        <span className="score-pct-large">{att.percentage}%</span>
                        <span className="score-marks-small">
                          {att.score} / {att.totalMarks} marks
                        </span>
                      </div>

                      <Link
                        to={`/candidate/attempts/${att.attemptId}/result`}
                        className="btn btn-outline btn-sm btn-view-report"
                        data-testid={`btn-view-result-${att.attemptId}`}
                      >
                        View Score Report →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Topic Performance Analytics View */}
      {activeTab === 'topics' && (
        <div className="tab-pane-topics">
          {/* Architectural Decision #15 Note */}
          <div className="alert alert-info topic-aggregation-note">
            <span className="alert-icon">💡</span>
            <div>
              <strong>Scoring Policy:</strong> Topic mastery analytics aggregate completed assessments only.
              Expired or abandoned attempts are excluded to prevent skewed accuracy metrics.
            </div>
          </div>

          {topics.length === 0 ? (
            <div className="empty-state-card">
              <span className="empty-icon">📊</span>
              <h3>No topic metrics available yet</h3>
              <p>
                Complete your first technical assessment to generate topic-wise mastery analytics and skill breakdowns.
              </p>
              <Link to="/candidate/assessments" className="btn btn-primary">
                Take an Assessment
              </Link>
            </div>
          ) : (
            <div className="topic-performance-grid">
              {topics.map((t, idx) => {
                const accuracy = t.accuracy ?? 0;
                const masteryLevel =
                  accuracy >= 80 ? 'Mastered' : accuracy >= 60 ? 'Proficient' : 'Needs Practice';
                const badgeClass =
                  accuracy >= 80
                    ? 'badge-success'
                    : accuracy >= 60
                    ? 'badge-info'
                    : 'badge-warning';

                return (
                  <div
                    key={idx}
                    className="topic-performance-card"
                    data-testid="topic-performance-card"
                  >
                    <div className="topic-perf-header">
                      <div>
                        <h3 className="topic-name" data-testid="topic-name">
                          {t.topic || 'General'}
                        </h3>
                        <span className="topic-attempts-count">
                          {t.totalAttempts} {t.totalAttempts === 1 ? 'attempt' : 'attempts'} evaluated
                        </span>
                      </div>
                      <span className={`badge ${badgeClass}`}>{masteryLevel}</span>
                    </div>

                    <div className="topic-perf-progress-section">
                      <div className="progress-value-row">
                        <span className="progress-label">Overall Accuracy</span>
                        <span className="progress-pct" data-testid="topic-accuracy">
                          {accuracy}%
                        </span>
                      </div>
                      <div className="topic-progress-bar-bg">
                        <div
                          className={`topic-progress-bar-fill ${badgeClass}`}
                          style={{ width: `${Math.min(100, Math.max(0, accuracy))}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="topic-perf-stats-grid">
                      <div className="stat-box">
                        <span className="stat-label">Marks Scored</span>
                        <span className="stat-value">
                          {t.score} / {t.totalMarks}
                        </span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">Question Accuracy</span>
                        <span className="stat-value">
                          {t.correctCount} / {t.totalQuestions} ({t.questionAccuracy}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CandidateHistoryPage;
