import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminBookingsPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const querySlotId = searchParams.get('slotId') || '';
  const queryCandidateId = searchParams.get('candidateId') || '';

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlotFilter, setSelectedSlotFilter] = useState(querySlotId);
  const [selectedCandidateFilter, setSelectedCandidateFilter] = useState(queryCandidateId);

  // Action Modals state
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [reschedulingBooking, setReschedulingBooking] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedNewSlotId, setSelectedNewSlotId] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Sync state if URL query params change
  useEffect(() => {
    setSelectedSlotFilter(querySlotId);
    setSelectedCandidateFilter(queryCandidateId);
  }, [querySlotId, queryCandidateId]);

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (selectedSlotFilter) params.slotId = selectedSlotFilter;
      if (selectedCandidateFilter) params.candidateId = selectedCandidateFilter;

      const data = await adminService.getBookings(params);
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setError(err.response?.data?.message || 'Failed to load bookings feed');
      toast.error('Unable to fetch bookings.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedSlotFilter, selectedCandidateFilter, toast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Fetch available slots when reschedule modal opens
  const openRescheduleModal = async (booking) => {
    setReschedulingBooking(booking);
    setSelectedNewSlotId('');
    setRescheduleNotes(booking.notes || '');
    try {
      setSlotsLoading(true);
      const slots = await adminService.getAvailableSlots();
      // Exclude current slot
      const currentSlotId = booking.slot?._id || booking.slot;
      const validSlots = slots.filter((s) => s._id !== currentSlotId);
      setAvailableSlots(validSlots);
      if (validSlots.length > 0) {
        setSelectedNewSlotId(validSlots[0]._id);
      }
    } catch (err) {
      console.error('Failed to load available slots:', err);
      toast.error('Could not fetch available slots for rescheduling.');
    } finally {
      setSlotsLoading(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = bookings.length;
    let confirmed = 0;
    let cancelled = 0;
    let rescheduled = 0;
    let completed = 0;

    bookings.forEach((b) => {
      if (b.status === 'confirmed') confirmed += 1;
      else if (b.status === 'cancelled') cancelled += 1;
      else if (b.status === 'rescheduled') rescheduled += 1;
      else if (b.status === 'completed') completed += 1;
    });

    return { total, confirmed, cancelled, rescheduled, completed };
  }, [bookings]);

  // Filtered by client-side text search (candidate email, slot title, interviewer)
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b) => {
      const email = b.candidate?.email?.toLowerCase() || '';
      const title = b.slot?.title?.toLowerCase() || '';
      const interviewer = b.slot?.interviewerName?.toLowerCase() || '';
      const notes = b.notes?.toLowerCase() || '';
      return email.includes(q) || title.includes(q) || interviewer.includes(q) || notes.includes(q);
    });
  }, [bookings, searchQuery]);

  // Handle Cancel on Candidate's Behalf
  const handleCancelConfirm = async () => {
    if (!cancellingBooking) return;
    setActionLoading(true);

    try {
      await adminService.adminCancelBooking(cancellingBooking._id);
      toast.success(
        `Booking for ${cancellingBooking.candidate?.email || 'candidate'} was successfully cancelled. Capacity was released and notification sent.`
      );
      setCancellingBooking(null);
      fetchBookings();
    } catch (err) {
      console.error('Admin cancel booking failed:', err);
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reschedule on Candidate's Behalf
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!reschedulingBooking || !selectedNewSlotId) {
      toast.error('Please select an available interview slot to reschedule to.');
      return;
    }
    setActionLoading(true);

    try {
      await adminService.adminRescheduleBooking(reschedulingBooking._id, {
        newSlotId: selectedNewSlotId,
        notes: rescheduleNotes.trim(),
      });

      toast.success(
        `Booking for ${reschedulingBooking.candidate?.email || 'candidate'} was successfully rescheduled! New booking confirmed and candidate notified.`
      );
      setReschedulingBooking(null);
      fetchBookings();
    } catch (err) {
      console.error('Admin reschedule booking failed:', err);
      toast.error(err.response?.data?.message || 'Failed to reschedule booking');
    } finally {
      setActionLoading(false);
    }
  };

  // Clear slot or candidate URL filter
  const handleClearSlotFilter = () => {
    setSelectedSlotFilter('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('slotId');
    setSearchParams(newParams);
  };

  const handleClearCandidateFilter = () => {
    setSelectedCandidateFilter('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('candidateId');
    setSearchParams(newParams);
  };

  const handleClearAllFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setSelectedSlotFilter('');
    setSelectedCandidateFilter('');
    setSearchParams({});
  };

  return (
    <div className="admin-bookings-page page-container">
      {/* Page Header */}
      <div className="page-header flex-between">
        <div>
          <span className="badge badge-primary">Supervision Console</span>
          <h2>Manage Interview Bookings</h2>
          <p className="subtitle">
            Oversee scheduled candidate mock interviews, manage attendance, and perform cancellations or rescheduling on candidate behalf.
          </p>
        </div>
        <Link to="/admin/slots" className="btn btn-outline">
          ← View Interview Slots
        </Link>
      </div>

      {/* KPI Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Bookings</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">Across all statuses</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-label">Confirmed (Active)</div>
          <div className="stat-value text-success">{stats.confirmed}</div>
          <div className="stat-sub">Upcoming scheduled sessions</div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-label">Rescheduled</div>
          <div className="stat-value text-info">{stats.rescheduled}</div>
          <div className="stat-sub">Moved to alternative slots</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-label">Cancelled</div>
          <div className="stat-value text-muted">{stats.cancelled}</div>
          <div className="stat-sub">By candidate or administrator</div>
        </div>
      </div>

      {/* Contextual Active Filters Notice */}
      {(selectedSlotFilter || selectedCandidateFilter) && (
        <div className="filter-banner card flex-between mb-3">
          <div className="filter-banner-text">
            <strong>Active Filter Applied:</strong>{' '}
            {selectedSlotFilter && (
              <span className="filter-tag">
                Slot ID: <code>{selectedSlotFilter}</code>
                <button
                  type="button"
                  onClick={handleClearSlotFilter}
                  className="tag-remove-btn"
                  title="Remove slot filter"
                >
                  ✕
                </button>
              </span>
            )}
            {selectedCandidateFilter && (
              <span className="filter-tag">
                Candidate ID: <code>{selectedCandidateFilter}</code>
                <button
                  type="button"
                  onClick={handleClearCandidateFilter}
                  className="tag-remove-btn"
                  title="Remove candidate filter"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="btn btn-outline btn-xs"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="controls-bar card">
        <div className="status-pills">
          {['all', 'confirmed', 'cancelled', 'rescheduled', 'completed'].map((status) => (
            <button
              key={status}
              type="button"
              className={`pill-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'all' ? ` (${stats.total})` : ` (${stats[status] || 0})`}
            </button>
          ))}
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search candidate email, title, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="clear-btn"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Table Area */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading candidate bookings...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">
          <p>{error}</p>
          <button onClick={fetchBookings} className="btn btn-outline btn-sm mt-2">
            Retry
          </button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📋</div>
          <h3>No bookings match criteria</h3>
          <p>
            {searchQuery || selectedSlotFilter || selectedCandidateFilter
              ? 'No interview bookings found for your current search and filters.'
              : 'No candidate bookings have been recorded yet.'}
          </p>
          <button onClick={handleClearAllFilters} className="btn btn-outline btn-sm">
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bookings-table-container card">
          <table className="data-table" data-testid="admin-bookings-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Interview Session</th>
                <th>Scheduled Date & Time</th>
                <th>Meeting Link</th>
                <th>Status</th>
                <th>Candidate Notes</th>
                <th>Booked On</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => {
                const slot = booking.slot;
                const candidate = booking.candidate;

                const scheduledTime = slot?.startTime
                  ? new Date(slot.startTime).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : 'Slot Not Available';

                const bookedAtFormatted = new Date(booking.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                const statusBadgeClass =
                  booking.status === 'confirmed'
                    ? 'badge-success'
                    : booking.status === 'rescheduled'
                    ? 'badge-info'
                    : booking.status === 'cancelled'
                    ? 'badge-danger'
                    : 'badge-secondary';

                return (
                  <tr key={booking._id} data-testid={`booking-row-${booking._id}`}>
                    <td className="candidate-cell">
                      {candidate ? (
                        <div>
                          <Link
                            to={`/admin/candidates/${candidate._id}`}
                            className="candidate-email-link"
                            title="View Candidate 360"
                          >
                            <strong>{candidate.email}</strong>
                          </Link>
                          <div className="candidate-sub">
                            <span className="role-pill">{candidate.role || 'candidate'}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted italic">Unknown Candidate</span>
                      )}
                    </td>
                    <td>
                      {slot ? (
                        <div>
                          <strong>{slot.title || 'Technical Interview'}</strong>
                          <div className="text-muted text-xs">
                            With: {slot.interviewerName || 'Interviewer'} • {slot.durationMinutes}m
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted italic">Slot Removed</span>
                      )}
                    </td>
                    <td>
                      <span className="date-time-badge">{scheduledTime}</span>
                    </td>
                    <td className="meeting-link-cell">
                      {slot?.meetingLink ? (
                        <a
                          href={slot.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-pill"
                          title={slot.meetingLink}
                        >
                          🔗 Enter Video
                        </a>
                      ) : (
                        <span className="text-muted italic">Pending</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </td>
                    <td className="notes-cell">
                      {booking.notes ? (
                        <span className="notes-text" title={booking.notes}>
                          {booking.notes.length > 40
                            ? `${booking.notes.substring(0, 40)}...`
                            : booking.notes}
                        </span>
                      ) : (
                        <span className="text-muted italic">None</span>
                      )}
                    </td>
                    <td className="text-muted text-xs">{bookedAtFormatted}</td>
                    <td className="text-right actions-cell">
                      {booking.status === 'confirmed' ? (
                        <div className="btn-group">
                          <button
                            type="button"
                            onClick={() => openRescheduleModal(booking)}
                            className="btn btn-secondary btn-xs"
                            title="Reschedule on candidate's behalf"
                            data-testid={`reschedule-btn-${booking._id}`}
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingBooking(booking)}
                            className="btn btn-danger-outline btn-xs"
                            title="Cancel on candidate's behalf"
                            data-testid={`cancel-btn-${booking._id}`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted text-xs italic">No actions</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ADMIN CANCEL ON CANDIDATE BEHALF MODAL */}
      {cancellingBooking && (
        <div className="modal-overlay" onClick={() => setCancellingBooking(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            data-testid="admin-cancel-modal"
          >
            <div className="modal-header">
              <h3 className="text-danger">Cancel Booking on Candidate's Behalf</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setCancellingBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                You are about to cancel the interview reservation for{' '}
                <strong>{cancellingBooking.candidate?.email || 'this candidate'}</strong>.
              </p>

              <div className="booking-summary-box card-subtle mt-2 mb-3">
                <div>
                  <strong>Session:</strong> {cancellingBooking.slot?.title || 'Mock Interview'}
                </div>
                <div>
                  <strong>Scheduled For:</strong>{' '}
                  {cancellingBooking.slot?.startTime
                    ? new Date(cancellingBooking.slot.startTime).toLocaleString('en-US')
                    : 'Scheduled Time'}
                </div>
                <div>
                  <strong>Interviewer:</strong>{' '}
                  {cancellingBooking.slot?.interviewerName || 'Assigned Interviewer'}
                </div>
              </div>

              <div className="alert alert-info">
                <strong>Automatic Lifecycle Actions:</strong>
                <ul className="mb-0 mt-1">
                  <li>Slot capacity will be released and returned to available state.</li>
                  <li>
                    The candidate will receive an administrative cancellation email and in-app
                    notification.
                  </li>
                  <li>This action is recorded in audit logs.</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCancellingBooking(null)}
                disabled={actionLoading}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelConfirm}
                disabled={actionLoading}
                data-testid="confirm-cancel-btn"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN RESCHEDULE ON CANDIDATE BEHALF MODAL */}
      {reschedulingBooking && (
        <div className="modal-overlay" onClick={() => setReschedulingBooking(null)}>
          <div
            className="modal-card modal-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="admin-reschedule-modal"
          >
            <div className="modal-header">
              <h3>Reschedule Interview on Candidate's Behalf</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setReschedulingBooking(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit}>
              <div className="modal-body">
                <div className="current-slot-notice mb-3">
                  <span className="badge badge-secondary mb-1">Current Session</span>
                  <div>
                    <strong>{reschedulingBooking.slot?.title || 'Mock Interview'}</strong> for{' '}
                    <strong>{reschedulingBooking.candidate?.email}</strong>
                  </div>
                  <div className="text-muted text-xs">
                    {reschedulingBooking.slot?.startTime
                      ? new Date(reschedulingBooking.slot.startTime).toLocaleString('en-US')
                      : 'N/A'}
                  </div>
                </div>

                {slotsLoading ? (
                  <div className="loading-container py-3">
                    <div className="spinner"></div>
                    <p>Loading available alternative interview slots...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="alert alert-warning">
                    <strong>No available future slots found:</strong>
                    <p className="mb-0 mt-1">
                      There are currently no other open, upcoming interview slots with available
                      capacity. Please create a new slot in{' '}
                      <Link to="/admin/slots" className="alert-link">
                        Manage Slots
                      </Link>{' '}
                      first.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="select-new-slot">
                        Select Target Interview Slot <span className="text-danger">*</span>
                      </label>
                      <select
                        id="select-new-slot"
                        className="select-field"
                        value={selectedNewSlotId}
                        onChange={(e) => setSelectedNewSlotId(e.target.value)}
                        required
                        data-testid="reschedule-slot-select"
                      >
                        {availableSlots.map((slot) => {
                          const timeStr = new Date(slot.startTime).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          });
                          const availableSeats = slot.capacity - slot.bookedCount;

                          return (
                            <option key={slot._id} value={slot._id}>
                              {timeStr} — {slot.title || 'Technical Interview'} ({slot.interviewerName} •{' '}
                              {availableSeats} seat(s) left)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="reschedule-notes">Administrative Notes (Optional)</label>
                      <textarea
                        id="reschedule-notes"
                        className="textarea-field"
                        rows="3"
                        placeholder="Reason for reschedule or instructions for the candidate..."
                        value={rescheduleNotes}
                        onChange={(e) => setRescheduleNotes(e.target.value)}
                      ></textarea>
                    </div>

                    <div className="alert alert-info mt-2">
                      <p className="mb-0 text-xs">
                        <strong>Atomic Transition:</strong> The new slot capacity will be reserved,
                        the old slot capacity freed, and an administrative reschedule confirmation email
                        and in-app notification sent to {reschedulingBooking.candidate?.email}.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setReschedulingBooking(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || slotsLoading || availableSlots.length === 0}
                  data-testid="confirm-reschedule-btn"
                >
                  {actionLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookingsPage;
