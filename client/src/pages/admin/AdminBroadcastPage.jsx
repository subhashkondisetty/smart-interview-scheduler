import React, { useState, useEffect, useCallback, useMemo } from 'react';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminBroadcastPage = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Candidates list for targeted recipient picker
  const [candidatesList, setCandidatesList] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Modal & Form State
  const [showSendModal, setShowSendModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Send Form Fields
  const [deliveryTarget, setDeliveryTarget] = useState('candidates'); // 'candidates' | 'all' | 'specific'
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [notificationType, setNotificationType] = useState('admin_broadcast');
  const [message, setMessage] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');

  // Audit Filter State
  const [typeFilter, setTypeFilter] = useState('all');
  const [feedSearch, setFeedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Load Candidates for Targeted Selector
  const loadCandidates = async () => {
    try {
      setCandidatesLoading(true);
      const res = await adminService.getCandidates({ status: 'active', limit: 100 });
      setCandidatesList(res.candidates || []);
    } catch (err) {
      console.error('Failed to load candidate list:', err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  // Fetch Notifications Audit Feed
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 20,
      };

      if (typeFilter && typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (feedSearch.trim()) {
        params.search = feedSearch.trim();
      }

      const res = await adminService.getAdminNotifications(params);
      setNotifications(res.notifications || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch platform notifications:', err);
      setError(err.response?.data?.message || 'Failed to load notifications audit feed.');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, feedSearch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Open Send Modal
  const openSendModal = () => {
    setDeliveryTarget('candidates');
    setSelectedCandidateIds([]);
    setNotificationType('admin_broadcast');
    setMessage('');
    setFormError(null);
    setShowSendModal(true);
  };

  // Toggle candidate selection
  const toggleCandidateSelection = (cId) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  // Submit Send Notification
  const handleSendSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!message.trim()) {
      setFormError('Notification message is required.');
      return;
    }

    if (deliveryTarget === 'specific' && selectedCandidateIds.length === 0) {
      setFormError('Please select at least one candidate recipient.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        message: message.trim(),
        type: notificationType,
      };

      if (deliveryTarget === 'candidates') {
        payload.role = 'candidate';
      } else if (deliveryTarget === 'specific') {
        payload.userIds = selectedCandidateIds;
      }
      // If deliveryTarget === 'all', role is omitted to broadcast platform-wide

      const res = await adminService.sendNotification(payload);
      const recipientCount = res.data?.recipientCount ?? selectedCandidateIds.length;

      const successMsg =
        deliveryTarget === 'specific'
          ? `Targeted notification successfully delivered to ${recipientCount} candidate(s).`
          : `Broadcast notification successfully dispatched to ${recipientCount} user(s).`;

      setSuccessMessage(successMsg);
      toast.success(successMsg);

      setShowSendModal(false);
      setMessage('');
      setSelectedCandidateIds([]);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to send notification:', err);
      const errMsg =
        err.response?.data?.message || err.response?.data?.error || 'Failed to dispatch notification.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered candidate list for picker
  const filteredCandidates = useMemo(() => {
    if (!candidateSearch.trim()) return candidatesList;
    const query = candidateSearch.toLowerCase().trim();
    return candidatesList.filter(
      (c) =>
        c.email?.toLowerCase().includes(query) ||
        c.profile?.fullName?.toLowerCase().includes(query) ||
        c.profile?.headline?.toLowerCase().includes(query)
    );
  }, [candidatesList, candidateSearch]);

  // Compute Audit Metrics
  const auditMetrics = useMemo(() => {
    const total = pagination.total || notifications.length;
    const broadcastCount = notifications.filter((n) => n.type === 'admin_broadcast').length;
    const otherCount = notifications.length - broadcastCount;
    return { total, broadcastCount, otherCount };
  }, [notifications, pagination.total]);

  // Format Helper
  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
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

  return (
    <div className="page-container admin-broadcast-page" data-testid="admin-broadcast-page">
      {/* Header */}
      <div className="page-header d-flex justify-between align-center flex-wrap mb-4">
        <div>
          <h1 className="page-title">Admin Notifications & Broadcast Center</h1>
          <p className="page-description text-muted">
            Broadcast platform announcements to candidates or dispatch targeted alerts to specific candidates.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={openSendModal}
            className="btn btn-primary"
            data-testid="open-send-notification-btn"
          >
            📢 Send Notification
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible mb-4" role="alert" data-testid="send-success-alert">
          <span>✓ {successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="close-btn" aria-label="Close">
            ×
          </button>
        </div>
      )}

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
        <div className="kpi-card" data-testid="kpi-total-notifications">
          <span className="kpi-label">Platform Notifications</span>
          <span className="kpi-value">{auditMetrics.total}</span>
          <span className="kpi-subtext">Total recorded delivery events</span>
        </div>
        <div className="kpi-card" data-testid="kpi-broadcast-notifications">
          <span className="kpi-label">Admin Broadcasts</span>
          <span className="kpi-value text-primary">{auditMetrics.broadcastCount}</span>
          <span className="kpi-subtext">Announcements & system bulletins</span>
        </div>
        <div className="kpi-card" data-testid="kpi-active-candidates">
          <span className="kpi-label">Available Candidates</span>
          <span className="kpi-value text-success">{candidatesList.length}</span>
          <span className="kpi-subtext">Active student & applicant accounts</span>
        </div>
      </div>

      {/* Audit Log Filter Bar */}
      <div className="filter-panel card mb-4">
        <div className="filter-row flex-wrap align-center">
          {/* Search Box */}
          <div className="search-group flex-1">
            <input
              type="text"
              id="feed-search"
              data-testid="feed-search"
              className="form-control"
              placeholder="Search notification messages..."
              value={feedSearch}
              onChange={(e) => {
                setFeedSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Type Filter Pills */}
          <div className="filter-pills">
            <span className="filter-label">Category:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'admin_broadcast', label: '📢 Broadcasts' },
              { id: 'booking_confirmed', label: '📅 Bookings' },
              { id: 'assessment_completed', label: '📝 Assessments' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pill-btn ${typeFilter === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setTypeFilter(cat.id);
                  setPage(1);
                }}
                data-testid={`filter-type-${cat.id}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchNotifications}
            className="btn btn-outline btn-sm"
            title="Refresh audit log"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Notifications Audit Table */}
      {loading ? (
        <div className="loading-container card text-center p-5">
          <div className="spinner"></div>
          <p className="mt-3 text-muted">Loading platform notification records...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state card text-center p-5">
          <span className="empty-icon" style={{ fontSize: '3rem' }}>🔔</span>
          <h3>No Notifications Found</h3>
          <p className="text-muted">
            {auditMetrics.total === 0
              ? 'No notifications have been recorded yet.'
              : 'No notification records matched your current search criteria.'}
          </p>
          <button onClick={openSendModal} className="btn btn-primary mt-3">
            Send First Announcement
          </button>
        </div>
      ) : (
        <div className="table-responsive card">
          <table className="data-table" data-testid="notifications-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Category</th>
                <th>Notification Message</th>
                <th>Sent At</th>
                <th>Read Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n._id} data-testid={`notification-row-${n._id}`}>
                  {/* Recipient */}
                  <td>
                    <div className="recipient-cell">
                      <span className="font-semibold text-dark">
                        {n.userId?.email || 'Platform User'}
                      </span>
                      {n.userId?.role && (
                        <span className="badge badge-role badge-secondary mt-1">
                          {n.userId.role.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category Type */}
                  <td>
                    <span
                      className={`badge badge-type ${
                        n.type === 'admin_broadcast'
                          ? 'badge-primary'
                          : n.type.includes('booking')
                          ? 'badge-info'
                          : 'badge-secondary'
                      }`}
                    >
                      {n.type === 'admin_broadcast'
                        ? '📢 Broadcast'
                        : n.type.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Message */}
                  <td>
                    <div className="notification-message-cell">
                      <span className="message-content">{n.message}</span>
                    </div>
                  </td>

                  {/* Sent Date */}
                  <td>
                    <span className="text-muted text-sm">{formatTimestamp(n.createdAt)}</span>
                  </td>

                  {/* Read status */}
                  <td>
                    {n.isRead ? (
                      <span className="badge badge-success">✓ Read</span>
                    ) : (
                      <span className="badge badge-warning">● Unread</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination-bar p-3 d-flex justify-between align-center border-top">
              <span className="text-muted text-sm">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total notifications)
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

      {/* SEND NOTIFICATION MODAL */}
      {showSendModal && (
        <div className="modal-overlay" data-testid="send-notification-modal">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>Dispatch Notification</h3>
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="close-btn"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSendSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger mb-3" role="alert" data-testid="send-form-error">
                    {formError}
                  </div>
                )}

                {/* Delivery Target Selector */}
                <div className="form-group mb-4">
                  <label className="font-semibold mb-2 d-block">Delivery Audience *</label>
                  <div className="delivery-target-options d-flex gap-3 flex-wrap">
                    <label className={`radio-card card p-3 flex-1 ${deliveryTarget === 'candidates' ? 'selected border-primary' : ''}`}>
                      <input
                        type="radio"
                        name="deliveryTarget"
                        value="candidates"
                        checked={deliveryTarget === 'candidates'}
                        onChange={() => setDeliveryTarget('candidates')}
                        data-testid="target-all-candidates-radio"
                      />
                      <div className="ml-2">
                        <strong className="d-block">All Candidates</strong>
                        <span className="text-muted text-xs">Broadcast to all active candidate accounts</span>
                      </div>
                    </label>

                    <label className={`radio-card card p-3 flex-1 ${deliveryTarget === 'specific' ? 'selected border-primary' : ''}`}>
                      <input
                        type="radio"
                        name="deliveryTarget"
                        value="specific"
                        checked={deliveryTarget === 'specific'}
                        onChange={() => setDeliveryTarget('specific')}
                        data-testid="target-specific-candidates-radio"
                      />
                      <div className="ml-2">
                        <strong className="d-block">Specific Candidate(s)</strong>
                        <span className="text-muted text-xs">Target individual selected candidate(s)</span>
                      </div>
                    </label>

                    <label className={`radio-card card p-3 flex-1 ${deliveryTarget === 'all' ? 'selected border-primary' : ''}`}>
                      <input
                        type="radio"
                        name="deliveryTarget"
                        value="all"
                        checked={deliveryTarget === 'all'}
                        onChange={() => setDeliveryTarget('all')}
                        data-testid="target-all-users-radio"
                      />
                      <div className="ml-2">
                        <strong className="d-block">Platform-Wide</strong>
                        <span className="text-muted text-xs">Broadcast to all active platform users</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Specific Candidate Selector (When targeted) */}
                {deliveryTarget === 'specific' && (
                  <div className="candidate-picker-container card p-3 mb-4 bg-light" data-testid="candidate-picker">
                    <div className="d-flex justify-between align-center mb-2">
                      <label className="font-semibold text-sm">
                        Select Target Candidates ({selectedCandidateIds.length} selected):
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ maxWidth: '250px' }}
                        placeholder="Filter candidates..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        data-testid="candidate-picker-search"
                      />
                    </div>

                    <div className="candidate-checkbox-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {candidatesLoading ? (
                        <p className="text-muted text-center p-3">Loading candidates list...</p>
                      ) : filteredCandidates.length === 0 ? (
                        <p className="text-muted text-center p-3">No matching candidates found.</p>
                      ) : (
                        filteredCandidates.map((c) => {
                          const isSelected = selectedCandidateIds.includes(c._id);
                          return (
                            <label
                              key={c._id}
                              className={`candidate-picker-item d-flex align-center p-2 border-bottom ${
                                isSelected ? 'bg-primary-light' : ''
                              }`}
                              style={{ cursor: 'pointer' }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCandidateSelection(c._id)}
                                data-testid={`candidate-checkbox-${c._id}`}
                              />
                              <div className="ml-2">
                                <span className="font-semibold text-sm">
                                  {c.profile?.fullName || 'Unprofiled Candidate'}
                                </span>
                                <span className="text-muted text-xs ml-2">({c.email})</span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Notification Type Selector */}
                <div className="form-group mb-3">
                  <label htmlFor="notification-type" className="font-semibold">Notification Type</label>
                  <select
                    id="notification-type"
                    data-testid="notification-type-select"
                    className="form-control"
                    value={notificationType}
                    onChange={(e) => setNotificationType(e.target.value)}
                  >
                    <option value="admin_broadcast">📢 Announcement (admin_broadcast)</option>
                    <option value="system_alert">⚠️ System Alert (system_alert)</option>
                    <option value="reminder">🔔 Reminder Note (reminder)</option>
                  </select>
                </div>

                {/* Message Input */}
                <div className="form-group mb-3">
                  <div className="d-flex justify-between align-center mb-1">
                    <label htmlFor="notification-message" className="font-semibold">
                      Notification Message *
                    </label>
                    <span className="text-muted text-xs">{message.length} / 1000 characters</span>
                  </div>
                  <textarea
                    id="notification-message"
                    data-testid="notification-message-input"
                    className="form-control"
                    rows={4}
                    placeholder="Type the announcement or direct candidate notification message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={1000}
                    required
                  />
                </div>

                {/* Live Candidate Notification Preview */}
                {message.trim() && (
                  <div className="candidate-preview-box card p-3 mb-2 bg-light border">
                    <span className="text-xs text-muted font-semibold text-uppercase d-block mb-2">
                      Candidate Notification Preview
                    </span>
                    <div className="d-flex align-start gap-3">
                      <span style={{ fontSize: '1.5rem' }}>
                        {notificationType === 'admin_broadcast' ? '📢' : notificationType === 'system_alert' ? '⚠️' : '🔔'}
                      </span>
                      <div className="flex-1">
                        <span className="font-semibold text-sm d-block text-dark">
                          {notificationType === 'admin_broadcast'
                            ? 'Announcement'
                            : notificationType.replace(/_/g, ' ')}
                        </span>
                        <p className="text-sm text-muted mt-1 mb-0">{message}</p>
                        <span className="text-xs text-muted mt-1 d-block">Just now</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  data-testid="submit-notification-btn"
                >
                  {submitting ? 'Dispatching...' : 'Dispatch Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBroadcastPage;
