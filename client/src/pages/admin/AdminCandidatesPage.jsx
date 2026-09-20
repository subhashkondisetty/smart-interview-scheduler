import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminCandidatesPage = () => {
  const toast = useToast();

  const [candidates, setCandidates] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Status toggle confirmation modal state
  const [modalCandidate, setModalCandidate] = useState(null);

  // Debounce search query input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, statusFilter, experienceFilter, sortBy, sortOrder]);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        experienceLevel: experienceFilter !== 'all' ? experienceFilter : undefined,
        sortBy,
        sortOrder,
      };

      const data = await adminService.getCandidates(params);
      setCandidates(data.candidates || []);
      if (data.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
      setError(err.response?.data?.message || 'Failed to load candidates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter, experienceFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Handle status toggle confirmation
  const handleConfirmStatusToggle = async () => {
    if (!modalCandidate) return;

    setActionLoading(true);
    const targetStatus = !modalCandidate.isActive;
    const actionLabel = targetStatus ? 'enabled' : 'deactivated';

    try {
      await adminService.updateCandidateStatus(modalCandidate._id, targetStatus);
      toast.success(
        `Candidate account for ${modalCandidate.email} has been ${actionLabel}.`
      );
      setModalCandidate(null);
      fetchCandidates();
    } catch (err) {
      console.error('Failed to update candidate status:', err);
      toast.error(
        err.response?.data?.message || `Failed to ${targetStatus ? 'enable' : 'deactivate'} candidate.`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setExperienceFilter('all');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const startIndex = useMemo(() => {
    if (pagination.total === 0) return 0;
    return (pagination.page - 1) * pagination.limit + 1;
  }, [pagination.page, pagination.limit, pagination.total]);

  const endIndex = useMemo(() => {
    return Math.min(pagination.page * pagination.limit, pagination.total);
  }, [pagination.page, pagination.limit, pagination.total]);

  return (
    <div className="page-container admin-candidates-container">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <span className="badge badge-primary">Administrative Oversight</span>
          <h2>Manage Candidates</h2>
          <p className="page-subtitle">
            Oversee registered candidate accounts, inspect technical profiles, and manage system access.
          </p>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="candidates-kpi-grid">
        <div className="candidate-kpi-card">
          <div className="kpi-icon total-icon">👥</div>
          <div className="kpi-details">
            <span className="kpi-label">Total Candidates</span>
            <span className="kpi-val" data-testid="total-candidates-count">{summary.total}</span>
          </div>
        </div>

        <div className="candidate-kpi-card">
          <div className="kpi-icon active-icon">✅</div>
          <div className="kpi-details">
            <span className="kpi-label">Active Accounts</span>
            <span className="kpi-val text-success" data-testid="active-candidates-count">{summary.active}</span>
          </div>
        </div>

        <div className="candidate-kpi-card">
          <div className="kpi-icon inactive-icon">🚫</div>
          <div className="kpi-details">
            <span className="kpi-label">Deactivated Accounts</span>
            <span className="kpi-val text-danger" data-testid="inactive-candidates-count">{summary.inactive}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="candidates-filter-toolbar">
        {/* Search Bar */}
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by candidate name, email, skills, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="candidates-search-input"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="filter-pill-group" role="tablist">
          <button
            className={`filter-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
            data-testid="status-filter-all"
          >
            All ({summary.total})
          </button>
          <button
            className={`filter-pill-btn ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
            data-testid="status-filter-active"
          >
            Active ({summary.active})
          </button>
          <button
            className={`filter-pill-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('inactive')}
            data-testid="status-filter-inactive"
          >
            Inactive ({summary.inactive})
          </button>
        </div>

        {/* Experience Dropdown */}
        <div className="filter-select-wrapper">
          <select
            className="filter-select"
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
            data-testid="experience-filter-select"
          >
            <option value="all">All Experience Levels</option>
            <option value="entry">Entry Level</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior Level</option>
            <option value="lead">Lead / Principal</option>
          </select>
        </div>

        {/* Items Per Page */}
        <div className="limit-selector-wrapper">
          <span className="limit-label">Show:</span>
          <select
            className="limit-select"
            value={pagination.limit}
            onChange={(e) =>
              setPagination((prev) => ({
                ...prev,
                limit: parseInt(e.target.value, 10),
                page: 1,
              }))
            }
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger candidates-alert">
          <p>{error}</p>
          <button onClick={fetchCandidates} className="btn btn-outline btn-sm">
            Retry
          </button>
        </div>
      )}

      {/* Main Candidate Table */}
      <div className="candidates-table-card">
        {loading ? (
          <div className="candidates-loading-state" data-testid="candidates-loading-spinner">
            <div className="spinner"></div>
            <p>Loading candidates data from real backend...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="candidates-empty-state" data-testid="candidates-empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No candidates found</h3>
            <p className="text-muted">
              {searchQuery || statusFilter !== 'all' || experienceFilter !== 'all'
                ? 'No candidate matches the selected filters or search terms.'
                : 'No candidates have registered on the platform yet.'}
            </p>
            {(searchQuery || statusFilter !== 'all' || experienceFilter !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="btn btn-secondary btn-sm mt-3"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="candidates-table" data-testid="candidates-data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Experience & Skills</th>
                  <th>Profile Completion</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((cand) => {
                  const hasProfile = cand.profile && cand.profile.fullName;
                  const displayName = hasProfile ? cand.profile.fullName : 'Unprofiled Candidate';
                  const headline = cand.profile?.headline || 'No headline provided';
                  const completion = cand.profile?.profileCompletionPercentage || 0;
                  const skills = cand.profile?.skills || [];
                  const experienceLevel = cand.profile?.experienceLevel || 'entry';

                  return (
                    <tr key={cand._id} data-testid={`candidate-row-${cand._id}`}>
                      {/* Candidate Name & Email */}
                      <td>
                        <div className="candidate-cell">
                          <div className="candidate-avatar">
                            {displayName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="candidate-info">
                            <strong className="candidate-name" data-testid="candidate-display-name">
                              {displayName}
                            </strong>
                            <span className="candidate-email">{cand.email}</span>
                            <span className="candidate-headline">{headline}</span>
                          </div>
                        </div>
                      </td>

                      {/* Experience Level & Skills */}
                      <td>
                        <div className="experience-cell">
                          <span className={`exp-badge exp-${experienceLevel}`}>
                            {experienceLevel.toUpperCase()}
                          </span>
                          <div className="skills-chip-list">
                            {skills.slice(0, 3).map((skill, idx) => (
                              <span key={idx} className="skill-chip">
                                {skill}
                              </span>
                            ))}
                            {skills.length > 3 && (
                              <span className="skill-chip skill-more">
                                +{skills.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Profile Completion */}
                      <td>
                        <div className="completion-cell">
                          <div className="completion-bar-bg">
                            <div
                              className={`completion-bar-fill ${
                                completion >= 80 ? 'fill-high' : completion >= 50 ? 'fill-mid' : 'fill-low'
                              }`}
                              style={{ width: `${completion}%` }}
                            ></div>
                          </div>
                          <span className="completion-text">{completion}%</span>
                        </div>
                      </td>

                      {/* Account Status Badge */}
                      <td>
                        <span
                          className={`status-pill ${cand.isActive ? 'status-active' : 'status-inactive'}`}
                          data-testid={`candidate-status-badge-${cand._id}`}
                        >
                          {cand.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td className="text-muted text-sm">
                        {formatDate(cand.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="action-buttons-group">
                          <Link
                            to={`/admin/candidates/${cand._id}`}
                            className="btn btn-outline btn-sm view-360-btn"
                            data-testid={`view-candidate-btn-${cand._id}`}
                          >
                            View 360
                          </Link>

                          <button
                            onClick={() => setModalCandidate(cand)}
                            className={`btn btn-sm ${
                              cand.isActive ? 'btn-danger-outline' : 'btn-success-outline'
                            }`}
                            data-testid={`toggle-status-btn-${cand._id}`}
                          >
                            {cand.isActive ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && candidates.length > 0 && (
          <div className="candidates-pagination-bar">
            <div className="pagination-info">
              Showing <span className="font-semibold">{startIndex}</span> to{' '}
              <span className="font-semibold">{endIndex}</span> of{' '}
              <span className="font-semibold">{pagination.total}</span> candidates
            </div>

            <div className="pagination-controls">
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                data-testid="pagination-prev-btn"
              >
                Previous
              </button>

              <div className="pagination-page-indicator">
                Page {pagination.page} of {pagination.totalPages}
              </div>

              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                data-testid="pagination-next-btn"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {modalCandidate && (
        <div className="modal-backdrop" data-testid="status-toggle-modal">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>
                {modalCandidate.isActive ? 'Deactivate Candidate Account' : 'Reactivate Candidate Account'}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setModalCandidate(null)}
                disabled={actionLoading}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to{' '}
                <strong>{modalCandidate.isActive ? 'deactivate' : 'reactivate'}</strong> the candidate
                account for <code>{modalCandidate.email}</code>?
              </p>
              {modalCandidate.isActive ? (
                <div className="modal-alert-warning">
                  ⚠️ <strong>Immediate Effect:</strong> This candidate will be immediately blocked
                  from accessing protected candidate endpoints, and any current sessions will receive
                  a 403 Forbidden response.
                </div>
              ) : (
                <div className="modal-alert-info">
                  ℹ️ This candidate will regain full access to their dashboard, interview bookings,
                  and assessment portal.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setModalCandidate(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className={`btn btn-sm ${
                  modalCandidate.isActive ? 'btn-danger' : 'btn-success'
                }`}
                onClick={handleConfirmStatusToggle}
                disabled={actionLoading}
                data-testid="confirm-status-toggle-btn"
              >
                {actionLoading
                  ? 'Updating...'
                  : modalCandidate.isActive
                  ? 'Confirm Deactivate'
                  : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCandidatesPage;
