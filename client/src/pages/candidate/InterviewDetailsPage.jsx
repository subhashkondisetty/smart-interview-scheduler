import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import interviewService, { classifyBookingError } from '../../services/interviewService';
import { useToast } from '../../context/ToastContext';

const InterviewDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Cancel state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Load single booking
  const loadBooking = async () => {
    try {
      setLoading(true);
      setError(null);
      const found = await interviewService.getBookingById(id);
      if (!found) {
        setError('Interview booking not found. It may have been removed or you do not have permission to view it.');
      } else {
        setBooking(found);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve interview details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [id]);

  // Cancel Handler
  const handleConfirmCancel = async () => {
    try {
      setCancelSubmitting(true);
      setCancelError(null);
      await interviewService.cancelBooking(id);
      toast.info('Interview booking cancelled.');
      setShowCancelModal(false);
      // Reload booking to reflect cancelled state
      loadBooking();
    } catch (err) {
      const classified = classifyBookingError(err);
      setCancelError(classified);
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Copy meeting link
  const handleCopyMeetingLink = () => {
    if (!booking?.slot?.meetingLink) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(booking.slot.meetingLink).catch(() => {
        // Fallback or permission restricted environment
      });
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Helpers
  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="auth-loading-screen" data-testid="details-loading">
          <div className="spinner" />
          <p>Loading interview details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="page-container" data-testid="details-not-found">
        <div className="status-card">
          <div className="status-icon">📂</div>
          <h2 className="status-title">Booking Not Found</h2>
          <p className="status-message">{error || 'Unable to locate the requested interview booking.'}</p>
          <div className="status-actions">
            <Link to="/candidate/bookings" className="btn btn-primary" data-testid="btn-back-to-bookings">
              ← Return to My Interviews
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const slot = booking.slot || {};
  const isConfirmed = booking.status === 'confirmed';
  const now = new Date();
  const start = slot.startTime ? new Date(slot.startTime) : null;
  const isUpcoming = isConfirmed && start && start > now;
  const isCompleted = isConfirmed && start && start <= now;

  return (
    <div className="page-container interview-details-page" data-testid="interview-details-page">
      {/* Breadcrumbs & Navigation */}
      <div className="details-nav-bar">
        <Link to="/candidate/bookings" className="back-link" data-testid="link-back-to-bookings">
          ← Back to My Interviews
        </Link>
        <span className="booking-ref-badge">Booking Ref: #{booking._id.slice(-6)}</span>
      </div>

      {/* Main Header */}
      <div className="details-header-card">
        <div className="details-title-row">
          <div>
            <div className="status-and-type">
              {isUpcoming && <span className="badge badge-success" data-testid="badge-details-status">✓ Confirmed • Upcoming</span>}
              {isCompleted && <span className="badge badge-info" data-testid="badge-details-status">✓ Completed</span>}
              {booking.status === 'cancelled' && <span className="badge badge-danger" data-testid="badge-details-status">✕ Cancelled</span>}
              {booking.status === 'rescheduled' && <span className="badge badge-warning" data-testid="badge-details-status">🔄 Rescheduled</span>}
              <span className="session-type-pill">Mock Technical Interview</span>
            </div>
            <h1 className="details-title" data-testid="details-title">
              {slot.title || 'Technical Interview Session'}
            </h1>
          </div>

          {/* Contextual Actions */}
          {isUpcoming && (
            <div className="details-action-buttons">
              <button
                type="button"
                className="btn btn-outline btn-sm btn-action-danger"
                onClick={() => setShowCancelModal(true)}
                data-testid="btn-details-cancel"
              >
                ✕ Cancel Booking
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Left (Meeting & Time) / Right (Interviewer, Notes, Timeline) */}
      <div className="details-grid">
        {/* Left Column: Meeting Room & Schedule */}
        <div className="details-left-col">
          {/* Meeting Room Card */}
          <div className="profile-card meeting-room-card" data-testid="meeting-room-card">
            <div className="card-section-header">
              <h3>🎥 Video Conference Room</h3>
              {isConfirmed ? (
                <span className="badge badge-success">Room Active</span>
              ) : (
                <span className="badge badge-secondary">Inactive</span>
              )}
            </div>

            {isConfirmed && slot.meetingLink ? (
              <div className="meeting-active-box">
                <p className="meeting-instructions">
                  Click below to join your interviewer at the scheduled start time. We recommend testing your audio and video equipment prior to joining.
                </p>

                <div className="meeting-link-row">
                  <a
                    href={slot.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-lg btn-join-main"
                    data-testid="btn-details-join-meeting"
                  >
                    🚀 Enter Video Interview
                  </a>
                  <button
                    type="button"
                    className="btn btn-outline btn-copy-link"
                    onClick={handleCopyMeetingLink}
                    data-testid="btn-copy-meeting-link"
                  >
                    {copiedLink ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                </div>

                <div className="pre-interview-tips">
                  <h4>Checklist for a Successful Session:</h4>
                  <ul>
                    <li>✓ Arrive 3-5 minutes before your scheduled start time.</li>
                    <li>✓ Use Chrome or Firefox with microphone and camera permissions enabled.</li>
                    <li>✓ Have a quiet space with a stable internet connection.</li>
                    <li>✓ Have code editor or IDE prepared for live technical problem solving.</li>
                  </ul>
                </div>
              </div>
            ) : isConfirmed ? (
              <div className="meeting-pending-box" data-testid="meeting-room-pending">
                <span className="pending-icon">⏳</span>
                <p>Meeting link will be shared closer to the interview date. Please check back before your scheduled session time.</p>
              </div>
            ) : (
              <div className="meeting-inactive-box">
                <p>
                  This session is <strong>{booking.status}</strong>. The video meeting room has been deactivated.
                </p>
              </div>
            )}
          </div>

          {/* Schedule & Timing Card */}
          <div className="profile-card">
            <div className="card-section-header">
              <h3>⏰ Schedule &amp; Format</h3>
            </div>

            <div className="schedule-meta-list">
              <div className="meta-item">
                <span className="meta-lbl">Date:</span>
                <span className="meta-val" data-testid="details-date">{formatDateTime(slot.startTime)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Time Window:</span>
                <span className="meta-val" data-testid="details-time-window">
                  {formatTimeRange(slot.startTime, slot.endTime)}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Session Length:</span>
                <span className="meta-val">{slot.durationMinutes || 45} minutes</span>
              </div>
              <div className="meta-item meta-item-full">
                <span className="meta-lbl">Topics Covered:</span>
                <p className="meta-desc" data-testid="details-description">
                  {slot.description ? (
                    slot.description
                  ) : (
                    <span className="fallback-text">No description provided</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interviewer, Notes, Timeline */}
        <div className="details-right-col">
          {/* Interviewer Card */}
          <div className="profile-card">
            <div className="card-section-header">
              <h3>👤 Interviewer Information</h3>
            </div>
            <div className="interviewer-profile-block">
              <div className="interviewer-avatar">
                {(slot.interviewerName || 'I').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="interviewer-name" data-testid="details-interviewer-name">
                  {slot.interviewerName || 'Technical Staff'}
                </h4>
                <span className="interviewer-title">Senior Technical Interviewer</span>
              </div>
            </div>
          </div>

          {/* Candidate Notes Card */}
          <div className="profile-card">
            <div className="card-section-header">
              <h3>📝 Candidate Session Notes</h3>
            </div>
            {booking.notes ? (
              <p className="candidate-notes-text" data-testid="details-candidate-notes">
                {booking.notes}
              </p>
            ) : (
              <p className="empty-notes-hint">No custom notes submitted for this session.</p>
            )}
          </div>

          {/* Lifecycle Timeline Card */}
          <div className="profile-card">
            <div className="card-section-header">
              <h3>📅 Session Timeline</h3>
            </div>
            <div className="timeline-list">
              <div className="timeline-step">
                <div className="timeline-dot dot-created" />
                <div className="timeline-content">
                  <span className="timeline-event">Booking Created</span>
                  <span className="timeline-time">
                    {booking.createdAt ? new Date(booking.createdAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {booking.cancelledAt && (
                <div className="timeline-step">
                  <div className="timeline-dot dot-cancelled" />
                  <div className="timeline-content">
                    <span className="timeline-event">Booking Cancelled</span>
                    <span className="timeline-time">
                      {new Date(booking.cancelledAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {booking.status === 'rescheduled' && (
                <div className="timeline-step">
                  <div className="timeline-dot dot-rescheduled" />
                  <div className="timeline-content">
                    <span className="timeline-event">Rescheduled</span>
                    <span className="timeline-time">
                      Moved to alternate time slot
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-backdrop" data-testid="details-cancel-modal-backdrop">
          <div className="modal-dialog cancel-modal-dialog" data-testid="details-cancel-modal">
            <div className="modal-header">
              <h2>Cancel This Interview</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelSubmitting}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {cancelError && (
                <div className="alert alert-error" data-testid="alert-details-cancel-error">
                  <span className="alert-icon">⚠</span>
                  <div className="alert-content">
                    <strong>{cancelError.title}: </strong>
                    <span>{cancelError.message}</span>
                  </div>
                </div>
              )}

              <p className="modal-warning-text">
                Are you sure you want to cancel your reservation for <strong>{slot.title}</strong>? Your seat will be immediately released to other candidates.
              </p>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelSubmitting}
                  data-testid="btn-abort-details-cancel"
                >
                  Keep Reservation
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmCancel}
                  disabled={cancelSubmitting}
                  data-testid="btn-confirm-details-cancel"
                >
                  {cancelSubmitting ? (
                    <>
                      <span className="button-spinner" /> Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Booking'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewDetailsPage;
