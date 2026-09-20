import React, { useState, useEffect, useCallback, useMemo } from 'react';
import adminService from '../../services/adminService';

const AdminResultsPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assessmentsList, setAssessmentsList] = useState([]);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalAttempts: 0,
    completedCount: 0,
    passedCount: 0,
    passRate: 0,
    averageScore: 0,
    averagePercentage: 0,
  });

  // Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [passedFilter, setPassedFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Detail Modal State
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Load Assessments for dropdown
  useEffect(() => {
    const loadAssessments = async () => {
      try {
        const list = await adminService.getAssessments();
        setAssessmentsList(list);
      } catch (err) {
        console.error('Failed to load assessments for filter:', err);
      }
    };
    loadAssessments();
  }, []);

  // Fetch Results
  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 10,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (selectedAssessmentId && selectedAssessmentId !== 'all') {
        params.assessmentId = selectedAssessmentId;
      }
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (passedFilter && passedFilter !== 'all') {
        params.passed = passedFilter === 'passed';
      }

      const res = await adminService.getResults(params);

      setResults(res.results || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
      if (res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch candidate results:', err);
      setError(err.response?.data?.message || 'Failed to load candidate results.');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedAssessmentId, statusFilter, passedFilter]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Open Detail Modal
  const openDetailModal = async (attemptId) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const detail = await adminService.getResultById(attemptId);
      setSelectedAttempt(detail);
    } catch (err) {
      console.error('Failed to load attempt result details:', err);
      setError('Failed to load attempt details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Close Detail Modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedAttempt(null);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAssessmentId('all');
    setStatusFilter('all');
    setPassedFilter('all');
    setPage(1);
  };

  // Format Helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '—';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return '—';
    const diffSec = Math.round((end - start) / 1000);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="page-container admin-results-page" data-testid="admin-results-page">
      {/* Header */}
      <div className="page-header d-flex justify-between align-center flex-wrap mb-4">
        <div>
          <h1 className="page-title">Candidate Assessment Results</h1>
          <p className="page-description text-muted">
            Inspect all candidate evaluations, scores, topic breakdown benchmarks, and pass/fail statuses.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={fetchResults}
            className="btn btn-outline"
            title="Refresh results feed"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible mb-4" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-btn" aria-label="Close">
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid mb-4">
        <div className="kpi-card" data-testid="kpi-total-attempts">
          <span className="kpi-label">Total Attempts</span>
          <span className="kpi-value">{metrics.totalAttempts}</span>
          <span className="kpi-subtext">Across all assessments</span>
        </div>
        <div className="kpi-card" data-testid="kpi-passed-attempts">
          <span className="kpi-label">Passed Attempts</span>
          <span className="kpi-value text-success">{metrics.passedCount}</span>
          <span className="kpi-subtext">Met passing score threshold</span>
        </div>
        <div className="kpi-card" data-testid="kpi-pass-rate">
          <span className="kpi-label">Overall Pass Rate</span>
          <span className="kpi-value">{metrics.passRate}%</span>
          <span className="kpi-subtext">
            {metrics.passedCount} of {metrics.totalAttempts} total
          </span>
        </div>
        <div className="kpi-card" data-testid="kpi-avg-score">
          <span className="kpi-label">Platform Avg Score</span>
          <span className="kpi-value text-primary">{metrics.averagePercentage}%</span>
          <span className="kpi-subtext">Avg points: {metrics.averageScore} pts</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-panel card mb-4">
        <div className="filter-row flex-wrap align-center">
          {/* Search Box */}
          <div className="search-group flex-1">
            <input
              type="text"
              id="search-results-input"
              data-testid="search-results-input"
              className="form-control"
              placeholder="Search by candidate name, email, or assessment title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Assessment Filter Dropdown */}
          <div className="filter-select-group">
            <label htmlFor="filter-assessment" className="filter-label">
              Assessment:
            </label>
            <select
              id="filter-assessment"
              data-testid="filter-assessment"
              className="form-control"
              value={selectedAssessmentId}
              onChange={(e) => {
                setSelectedAssessmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Assessments</option>
              {assessmentsList.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.title} ({a.difficulty})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Pills */}
          <div className="filter-pills">
            <span className="filter-label">Status:</span>
            {['all', 'completed', 'expired', 'in_progress'].map((st) => (
              <button
                key={st}
                type="button"
                className={`pill-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                data-testid={`filter-status-${st}`}
              >
                {st === 'in_progress' ? 'In Progress' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* Result Filter (Passed / Failed) */}
          <div className="filter-pills">
            <span className="filter-label">Result:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'passed', label: 'Passed' },
              { id: 'failed', label: 'Failed' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                className={`pill-btn ${passedFilter === r.id ? 'active' : ''}`}
                onClick={() => {
                  setPassedFilter(r.id);
                  setPage(1);
                }}
                data-testid={`filter-result-${r.id}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-outline btn-sm"
            title="Reset all filters"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Table Content */}
      {loading ? (
        <div className="loading-container card text-center p-5">
          <div className="spinner"></div>
          <p className="mt-3 text-muted">Loading candidate attempt records...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state card text-center p-5">
          <span className="empty-icon" style={{ fontSize: '3rem' }}>📊</span>
          <h3>No Candidate Results Found</h3>
          <p className="text-muted">
            {metrics.totalAttempts === 0
              ? 'No candidate assessment attempts have been recorded yet.'
              : 'No attempts matched your current search and filter criteria.'}
          </p>
          {(searchQuery || selectedAssessmentId !== 'all' || statusFilter !== 'all' || passedFilter !== 'all') && (
            <button onClick={handleResetFilters} className="btn btn-primary mt-3">
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive card">
          <table className="data-table" data-testid="results-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Assessment</th>
                <th>Attempt</th>
                <th>Score</th>
                <th>Status</th>
                <th>Result</th>
                <th>Completed Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr key={item._id} data-testid={`result-row-${item._id}`}>
                  {/* Candidate info */}
                  <td>
                    <div className="candidate-info-cell">
                      <span className="font-semibold text-dark">
                        {item.candidate?.fullName || 'Unprofiled Candidate'}
                      </span>
                      <span className="text-muted text-xs">{item.candidate?.email}</span>
                      {item.candidate?.experienceLevel && (
                        <span className="badge badge-experience mt-1">
                          {item.candidate.experienceLevel.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Assessment title & difficulty */}
                  <td>
                    <div className="assessment-title-cell">
                      <span className="font-semibold">{item.assessment?.title}</span>
                      <span className={`badge badge-difficulty badge-${item.assessment?.difficulty} mt-1`}>
                        {item.assessment?.difficulty}
                      </span>
                    </div>
                  </td>

                  {/* Attempt number */}
                  <td>
                    <span className="badge badge-attempt">#{item.attemptNumber}</span>
                  </td>

                  {/* Score & Percentage */}
                  <td>
                    <div className="score-cell">
                      <span className="score-pct font-bold">
                        {item.status === 'in_progress' ? '—' : `${item.percentage}%`}
                      </span>
                      <span className="score-pts text-muted text-xs">
                        {item.status === 'in_progress' ? 'Running' : `${item.score} / ${item.totalMarks} pts`}
                      </span>
                    </div>
                  </td>

                  {/* Lifecycle Status */}
                  <td>
                    <span
                      className={`badge badge-status ${
                        item.status === 'completed'
                          ? 'badge-success'
                          : item.status === 'expired'
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}
                    >
                      {item.status === 'in_progress' ? 'In Progress' : item.status.toUpperCase()}
                    </span>
                  </td>

                  {/* Pass / Fail Outcome */}
                  <td>
                    {item.status === 'in_progress' ? (
                      <span className="text-muted text-xs">—</span>
                    ) : item.passed ? (
                      <span className="badge badge-pass">✓ PASSED</span>
                    ) : (
                      <span className="badge badge-fail">✕ FAILED</span>
                    )}
                  </td>

                  {/* Date & Duration */}
                  <td>
                    <div className="timestamp-cell">
                      <span>{formatDate(item.endTime || item.createdAt)}</span>
                      {item.endTime && (
                        <span className="text-muted text-xs">
                          Time: {formatDuration(item.startTime, item.endTime)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => openDetailModal(item._id)}
                      className="btn btn-outline-primary btn-xs"
                      data-testid={`view-result-btn-${item._id}`}
                      title="Inspect full score report & topic breakdown"
                    >
                      View Report →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination-bar p-3 d-flex justify-between align-center border-top">
              <span className="text-muted text-sm">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total results)
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev}
                  className="btn btn-outline btn-xs mr-2"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNext}
                  className="btn btn-outline btn-xs"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL: Full Score Report Inspection */}
      {showDetailModal && (
        <div className="modal-overlay" data-testid="result-detail-modal">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>Assessment Score Report Inspection</h3>
              <button
                type="button"
                onClick={closeDetailModal}
                className="close-btn"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {detailLoading || !selectedAttempt ? (
                <div className="text-center p-5">
                  <div className="spinner"></div>
                  <p className="mt-3 text-muted">Loading complete attempt breakdown...</p>
                </div>
              ) : (
                <div className="attempt-detail-content">
                  {/* Candidate & Test Header Strip */}
                  <div className="detail-hero card p-4 mb-4">
                    <div className="d-flex justify-between align-center flex-wrap">
                      <div>
                        <span className="badge badge-primary mb-2">Attempt #{selectedAttempt.attemptNumber}</span>
                        <h2>{selectedAttempt.assessment?.title}</h2>
                        <p className="text-muted">
                          Candidate: <strong>{selectedAttempt.candidate?.fullName}</strong> ({selectedAttempt.candidate?.email})
                        </p>
                      </div>
                      <div className="detail-hero-score text-right">
                        <div className="huge-percentage font-bold text-primary" style={{ fontSize: '2.5rem' }}>
                          {selectedAttempt.status === 'in_progress' ? '—' : `${selectedAttempt.percentage}%`}
                        </div>
                        <div>
                          {selectedAttempt.status === 'in_progress' ? (
                            <span className="badge badge-info">In Progress</span>
                          ) : selectedAttempt.passed ? (
                            <span className="badge badge-pass font-bold">✓ PASSED EVALUATION</span>
                          ) : (
                            <span className="badge badge-fail font-bold">✕ FAILED EVALUATION</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="detail-meta-grid mt-3 pt-3 border-top d-flex gap-4 flex-wrap">
                      <div>
                        <span className="meta-label text-muted text-xs">Total Score:</span>
                        <div className="font-semibold">{selectedAttempt.score} / {selectedAttempt.totalMarks} points</div>
                      </div>
                      <div>
                        <span className="meta-label text-muted text-xs">Passing Requirement:</span>
                        <div className="font-semibold">{selectedAttempt.assessment?.passingPercentage}%</div>
                      </div>
                      <div>
                        <span className="meta-label text-muted text-xs">Duration Taken:</span>
                        <div className="font-semibold">{formatDuration(selectedAttempt.startTime, selectedAttempt.endTime)}</div>
                      </div>
                      <div>
                        <span className="meta-label text-muted text-xs">Submitted At:</span>
                        <div className="font-semibold">{formatDate(selectedAttempt.endTime || selectedAttempt.updatedAt)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Topic-Wise Performance Breakdown */}
                  {selectedAttempt.topicBreakdown && selectedAttempt.topicBreakdown.length > 0 && (
                    <div className="topic-breakdown-section mb-4">
                      <h4>Topic-Wise Benchmark Breakdown</h4>
                      <div className="topic-cards-grid mt-3">
                        {selectedAttempt.topicBreakdown.map((t, idx) => (
                          <div key={idx} className="topic-card card p-3">
                            <div className="d-flex justify-between align-center mb-2">
                              <span className="font-semibold">{t.topic}</span>
                              <span className="badge badge-outline">{t.percentage}%</span>
                            </div>
                            <div className="progress-bar-bg" style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px' }}>
                              <div
                                className="progress-bar-fill"
                                style={{
                                  height: '100%',
                                  width: `${t.percentage}%`,
                                  background: t.percentage >= (selectedAttempt.assessment?.passingPercentage || 60) ? '#10b981' : '#ef4444',
                                  borderRadius: '4px',
                                }}
                              ></div>
                            </div>
                            <div className="d-flex justify-between text-muted text-xs mt-2">
                              <span>Score: {t.score} / {t.totalMarks} pts</span>
                              <span>Correct: {t.correctCount} / {t.totalQuestions}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Answers Outcome Summary */}
                  {selectedAttempt.answers && selectedAttempt.answers.length > 0 && (
                    <div className="answers-summary-section mb-3">
                      <h4>Question Outcome Breakdown ({selectedAttempt.answers.length} questions)</h4>
                      <div className="table-responsive mt-2">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Topic</th>
                              <th>Outcome</th>
                              <th>Marks Awarded</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAttempt.answers.map((ans, aIdx) => (
                              <tr key={aIdx}>
                                <td>{aIdx + 1}</td>
                                <td>{ans.topic || 'General'}</td>
                                <td>
                                  {ans.selectedOptionIndex === null || ans.selectedOptionIndex === undefined ? (
                                    <span className="badge badge-secondary">Unanswered</span>
                                  ) : ans.isCorrect ? (
                                    <span className="badge badge-success">✓ Correct</span>
                                  ) : (
                                    <span className="badge badge-danger">✕ Incorrect</span>
                                  )}
                                </td>
                                <td>{ans.marksAwarded} pts</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={closeDetailModal}
                className="btn btn-secondary"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminResultsPage;
