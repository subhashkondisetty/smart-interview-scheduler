import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import interviewService, { classifyBookingError } from '../../services/interviewService';
import { useToast } from '../../context/ToastContext';

const MyBookingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Data state
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);

  // Active status filter tab
  const [activeTab, setActiveTab] = useState('all');

  // Cancel modal state
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Reschedule modal state
  const [reschedulingBooking, setReschedulingBooking] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [targetSlotId, setTargetSlotId] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);

  // 1. Fetch Candidate Bookings
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await interviewService.getCandidateBookings();
      setBookings(data);
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Failed to load your interview bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // 2. Metrics Breakdown
  const metrics = useMemo(() => {
    const now = new Date();
    let upcoming = 0;
    let completed = 0;
    let cancelled = 0;
    let rescheduled = 0;

    bookings.forEach((b) => {
      if (b.status === 'confirmed') {
        const start = b.slot ? new Date(b.slot.startTime) : null;
        if (start && start > now) {
          upcoming++;
        } else {
          completed++;
        }
      } else if (b.status === 'cancelled') {
        cancelled++;
      } else if (b.status === 'rescheduled') {
        rescheduled++;
      }
    });

    return {
      total: bookings.length,
      upcoming,
      completed,
      cancelled,
      rescheduled,
    };
  }, [bookings]);

  // 3. Filtered List
  const filteredBookings = useMemo(() => {
    const now = new Date();

    return bookings.filter((b) => {
      if (activeTab === 'all') return true;

      if (activeTab === 'upcoming') {
        if (b.status !== 'confirmed') return false;
        const start = b.slot ? new Date(b.slot.startTime) : null;
        return start && start > now;
      }

      if (activeTab === 'completed') {
        if (b.status !== 'confirmed') return false;
        const start = b.slot ? new Date(b.slot.startTime) : null;
        return !start || start <= now;
      }

      if (activeTab === 'cancelled') {
        return b.status === 'cancelled';
      }

      if (activeTab === 'rescheduled') {
        return b.status === 'rescheduled';
      }

      return true;
    });
  }, [bookings, activeTab]);

  // 4. Cancel Handlers
  const handleOpenCancelModal = (booking) => {
    setCancellingBooking(booking);
    setCancelError(null);
  };

  const handleCloseCancelModal = () => {
    setCancellingBooking(null);
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;

    try {
      setCancelSubmitting(true);
      setCancelError(null);

      await interviewService.cancelBooking(cancellingBooking._id);

      toast.info('Interview booking cancelled.');
      setActionAlert({
        type: 'success',
        message: 'Your interview booking was cancelled successfully. Slot capacity has been released.',
      });

      handleCloseCancelModal();
      fetchBookings();
    } catch (err) {
      const classified = classifyBookingError(err);
      setCancelError(classified);
      // If booking was already modified in another tab, refresh
      if (classified.category === 'already_updated') {
        fetchBookings();
      }
    } finally {
      setCancelSubmitting(false);
    }
  };

  // 5. Reschedule Handlers
  const handleOpenRescheduleModal = async (booking) => {
    setReschedulingBooking(booking);
    setTargetSlotId('');
    setRescheduleNotes(booking.notes || '');
    setRescheduleError(null);

    try {
      setLoadingSlots(true);
      const allSlots = await interviewService.getAvailableSlots();
      // Exclude current slot
      const currentSlotId = booking.slot?._id || booking.slot;
      const validAlternatives = allSlots.filter((s) => s._id !== currentSlotId);
      setAvailableSlots(validAlternatives);
    } catch (err) {
      setRescheduleError({
        title: 'Error',
        message: 'Could not fetch available slots for rescheduling.',
      });
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleCloseRescheduleModal = () => {
    setReschedulingBooking(null);
    setAvailableSlots([]);
    setTargetSlotId('');
    setRescheduleError(null);
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!reschedulingBooking || !targetSlotId) return;

    try {
      setRescheduleSubmitting(true);
      setRescheduleError(null);

      await interviewService.rescheduleBooking(reschedulingBooking._id, {
        newSlotId: targetSlotId,
        notes: rescheduleNotes,
      });

      toast.success('Interview rescheduled successfully!');
      setActionAlert({
        type: 'success',
        message: 'Your interview session has been rescheduled successfully.',
      });

      handleCloseRescheduleModal();
      fetchBookings();
    } catch (err) {
      const classified = classifyBookingError(err);
      setRescheduleError(classified);

      // If target slot is full, reload alternatives
      if (classified.category === 'slot_full') {
        interviewService.getAvailableSlots().then((slots) => {
          const currentSlotId = reschedulingBooking.slot?._id || reschedulingBooking.slot;
          setAvailableSlots(slots.filter((s) => s._id !== currentSlotId));
        });
      }
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Helpers
  const formatDateTime = (isoString) => {
    if (!isoString) return 'Unspecified time';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeRange = (startIso, endIso) => {
    if (!startIso) return '';
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;
    const startStr = start.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (!end) return startStr;
    const endStr = end.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${startStr} - ${endStr}`;
  };

  const getStatusBadge = (booking) => {
    const now = new Date();
    const start = booking.slot ? new Date(booking.slot.startTime) : null;

    if (booking.status === 'confirmed') {
      if (start && start > now) {
        return <span className="badge badge-success" data-testid={`status-badge-${booking._id}`}>✓ Confirmed (Upcoming)</span>;
      }
      return <span className="badge badge-info" data-testid={`status-badge-${booking._id}`}>✓ Completed</span>;
    }

    if (booking.status === 'cancelled') {
      return <span className="badge badge-danger" data-testid={`status-badge-${booking._id}`}>✕ Cancelled</span>;
    }

    if (booking.status === 'rescheduled') {
      return <span className="badge badge-warning" data-testid={`status-badge-${booking._id}`}>🔄 Rescheduled</span>;
    }

    return <span className="badge badge-secondary">{booking.status}</span>;
  };

  return (
    <div className="page-container my-bookings-page" data-testid="my-bookings-page">
      {/* Header */}
      <div className="bookings-page-header">
        <div>
          <span className="badge badge-candidate">Interview Management</span>
          <h1 className="page-title">My Interview Bookings</h1>
          <p className="page-subtitle">
            Review your upcoming mock interviews, access join links, or cancel and reschedule sessions as needed.
          </p>
        </div>
        <div className="header-actions">
          <Link to="/candidate/slots" className="btn btn-primary" data-testid="link-book-new-slot">
            + Book Another Interview
          </Link>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`} data-testid="alert-action-notification">
          <span className="alert-icon">{actionAlert.type === 'success' ? '✓' : '⚠'}</span>
          <span>{actionAlert.message}</span>
          <button
            type="button"
            className="alert-close-btn"
            onClick={() => setActionAlert(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Global Fetch Error */}
      {fetchError && (
        <div className="alert alert-error" data-testid="alert-fetch-error">
          <span className="alert-icon">⚠</span>
          <span>{fetchError}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={fetchBookings}>
            Retry
          </button>
        </div>
      )}

      {/* Metrics Summary Strip */}
      <div className="bookings-metrics-strip" data-testid="bookings-metrics-strip">
        <div className="metric-box">
          <span className="metric-box-val" data-testid="metric-total-bookings">{metrics.total}</span>
          <span className="metric-box-lbl">Total Sessions</span>
        </div>
        <div className="metric-box">
          <span className="metric-box-val metric-val-success" data-testid="metric-upcoming-bookings">{metrics.upcoming}</span>
          <span className="metric-box-lbl">Upcoming Confirmed</span>
        </div>
        <div className="metric-box">
          <span className="metric-box-val metric-val-info" data-testid="metric-completed-bookings">{metrics.completed}</span>
          <span className="metric-box-lbl">Completed</span>
        </div>
        <div className="metric-box">
          <span className="metric-box-val metric-val-danger" data-testid="metric-cancelled-bookings">{metrics.cancelled}</span>
          <span className="metric-box-lbl">Cancelled</span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bookings-tabs-bar" data-testid="bookings-tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          data-testid="tab-all"
        >
          All ({metrics.total})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
          data-testid="tab-upcoming"
        >
          Upcoming ({metrics.upcoming})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
          data-testid="tab-completed"
        >
          Completed ({metrics.completed})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
          data-testid="tab-cancelled"
        >
          Cancelled ({metrics.cancelled})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'rescheduled' ? 'active' : ''}`}
          onClick={() => setActiveTab('rescheduled')}
          data-testid="tab-rescheduled"
        >
          Rescheduled ({metrics.rescheduled})
        </button>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="bookings-loading-screen" data-testid="bookings-loading">
          <div className="spinner" />
          <p>Loading your interview history...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="empty-bookings-box" data-testid="empty-bookings-box">
          <span className="empty-icon">📂</span>
          <h3>No bookings match the selected filter</h3>
          <p>
            {bookings.length === 0
              ? 'You have not booked any mock interview sessions yet. Find open slots and book your first interview.'
              : `You have no ${activeTab} interviews recorded.`}
          </p>
          {bookings.length === 0 ? (
            <Link to="/candidate/slots" className="btn btn-primary btn-sm" data-testid="btn-browse-slots-empty">
              Browse Available Slots
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setActiveTab('all')}
            >
              Show All Bookings
            </button>
          )}
        </div>
      ) : (
        <div className="bookings-list" data-testid="bookings-list">
          {filteredBookings.map((booking) => {
            const slot = booking.slot || {};
            const isConfirmed = booking.status === 'confirmed';
            const isUpcoming = isConfirmed && slot.startTime && new Date(slot.startTime) > new Date();

            return (
              <div
                key={booking._id}
                className={`booking-card booking-card-${booking.status}`}
                data-testid={`booking-card-${booking._id}`}
              >
                <div className="booking-card-top">
                  <div className="booking-main-info">
                    <div className="booking-status-row">
                      {getStatusBadge(booking)}
                      <span className="booking-id-tag">ID: {booking._id.slice(-6)}</span>
                    </div>
                    <h3 className="booking-title" data-testid={`booking-title-${booking._id}`}>
                      {slot.title || 'Interview Session'}
                    </h3>
                    <div className="booking-interviewer">
                      <span>Interviewer: <strong>{slot.interviewerName || 'Assigned Staff'}</strong></span>
                    </div>
                  </div>

                  <div className="booking-time-badge">
                    <span className="b-date">{formatDateTime(slot.startTime)}</span>
                    <span className="b-hours">{formatTimeRange(slot.startTime, slot.endTime)}</span>
                    <span className="b-duration">⏱ {slot.durationMinutes || 45} mins</span>
                  </div>
                </div>

                {/* Notes and Meeting Link */}
                <div className="booking-card-mid">
                  {booking.notes && (
                    <div className="booking-notes-preview">
                      <span className="notes-label">Your Session Focus:</span>
                      <p className="notes-text">{booking.notes}</p>
                    </div>
                  )}

                  {isConfirmed && (
                    <div className="booking-meeting-link-strip">
                      <span className="meeting-label">Meeting Room:</span>
                      {slot.meetingLink ? (
                        <a
                          href={slot.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-success btn-join"
                          data-testid={`btn-join-meeting-${booking._id}`}
                        >
                          🎥 Open Meeting Link
                        </a>
                      ) : (
                        <span className="meeting-pending-text" data-testid={`meeting-pending-${booking._id}`}>
                          Meeting link will be shared closer to the interview date
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="booking-card-actions">
                  <Link
                    to={`/candidate/bookings/${booking._id}`}
                    className="btn btn-outline btn-sm"
                    data-testid={`btn-view-details-${booking._id}`}
                  >
                    View Details
                  </Link>

                  {isUpcoming && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenRescheduleModal(booking)}
                        data-testid={`btn-reschedule-${booking._id}`}
                      >
                        🔄 Reschedule
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-action-danger"
                        onClick={() => handleOpenCancelModal(booking)}
                        data-testid={`btn-cancel-${booking._id}`}
                      >
                        ✕ Cancel Booking
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingBooking && (
        <div className="modal-backdrop" data-testid="cancel-modal-backdrop">
          <div className="modal-dialog cancel-modal-dialog" data-testid="cancel-modal">
            <div className="modal-header">
              <h2>Cancel Interview Booking</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseCancelModal}
                disabled={cancelSubmitting}
                data-testid="btn-close-cancel-modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {cancelError && (
                <div className="alert alert-error" data-testid="alert-cancel-error">
                  <span className="alert-icon">⚠</span>
                  <div className="alert-content">
                    <strong>{cancelError.title}: </strong>
                    <span>{cancelError.message}</span>
                  </div>
                </div>
              )}

              <p className="modal-warning-text">
                Are you sure you want to cancel this mock interview? This will immediately release your reserved seat back to the available pool.
              </p>

              <div className="cancel-target-summary">
                <h4>{cancellingBooking.slot?.title || 'Mock Interview'}</h4>
                <p>
                  <strong>Scheduled For:</strong> {formatDateTime(cancellingBooking.slot?.startTime)} at{' '}
                  {formatTimeRange(cancellingBooking.slot?.startTime, cancellingBooking.slot?.endTime)}
                </p>
                <p>
                  <strong>Interviewer:</strong> {cancellingBooking.slot?.interviewerName || 'Assigned Staff'}
                </p>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseCancelModal}
                  disabled={cancelSubmitting}
                  data-testid="btn-abort-cancel"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmCancel}
                  disabled={cancelSubmitting}
                  data-testid="btn-confirm-cancel"
                >
                  {cancelSubmitting ? (
                    <>
                      <span className="button-spinner" /> Releasing Seat...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingBooking && (
        <div className="modal-backdrop" data-testid="reschedule-modal-backdrop">
          <div className="modal-dialog reschedule-modal-dialog" data-testid="reschedule-modal">
            <div className="modal-header">
              <h2>Reschedule Mock Interview</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseRescheduleModal}
                disabled={rescheduleSubmitting}
                data-testid="btn-close-reschedule-modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Differentiated Reschedule Error */}
              {rescheduleError && (
                <div className="alert alert-error" data-testid="alert-reschedule-error">
                  <span className="alert-icon">⚠</span>
                  <div className="alert-content">
                    <strong>{rescheduleError.title}: </strong>
                    <span>{rescheduleError.message}</span>
                  </div>
                </div>
              )}

              <div className="current-session-box">
                <span className="session-tag">Current Booking</span>
                <h4>{reschedulingBooking.slot?.title || 'Mock Interview'}</h4>
                <p>
                  {formatDateTime(reschedulingBooking.slot?.startTime)} •{' '}
                  {formatTimeRange(reschedulingBooking.slot?.startTime, reschedulingBooking.slot?.endTime)}
                </p>
              </div>

              <form onSubmit={handleConfirmReschedule}>
                <div className="form-group">
                  <label htmlFor="targetSlotSelect">Select New Available Time Slot:</label>
                  {loadingSlots ? (
                    <div className="loading-subtext">Loading available slots...</div>
                  ) : availableSlots.length === 0 ? (
                    <div className="alert alert-warning">
                      No alternate slots are currently available for rescheduling. Please check back later.
                    </div>
                  ) : (
                    <select
                      id="targetSlotSelect"
                      className="form-control"
                      value={targetSlotId}
                      onChange={(e) => setTargetSlotId(e.target.value)}
                      required
                      data-testid="select-target-slot"
                    >
                      <option value="">-- Choose an available slot --</option>
                      {availableSlots.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.title} ({formatDateTime(s.startTime)} at {formatTimeRange(s.startTime, s.endTime)}) - {s.interviewerName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="rescheduleNotes">Updated Session Notes (Optional):</label>
                  <textarea
                    id="rescheduleNotes"
                    className="form-control"
                    rows={2}
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    maxLength={500}
                    placeholder="Provide any updated areas of focus for your interviewer..."
                    data-testid="textarea-reschedule-notes"
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseRescheduleModal}
                    disabled={rescheduleSubmitting}
                    data-testid="btn-abort-reschedule"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={rescheduleSubmitting || !targetSlotId || availableSlots.length === 0}
                    data-testid="btn-confirm-reschedule"
                  >
                    {rescheduleSubmitting ? (
                      <>
                        <span className="button-spinner" /> Rescheduling...
                      </>
                    ) : (
                      'Confirm New Time'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
