import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import interviewService, { classifyBookingError } from '../../services/interviewService';
import { useToast } from '../../context/ToastContext';

const AvailableSlotsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Data state
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [durationFilter, setDurationFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Booking modal state
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // 1. Fetch available slots
  const fetchSlots = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const available = await interviewService.getAvailableSlots();
      setSlots(available);
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Failed to load available interview slots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  // 2. Filter logic
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      // Keyword filter (title, interviewer, description)
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesTitle = slot.title?.toLowerCase().includes(q);
        const matchesInterviewer = slot.interviewerName?.toLowerCase().includes(q);
        const matchesDesc = slot.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesInterviewer && !matchesDesc) return false;
      }

      // Duration filter
      if (durationFilter !== 'all') {
        if (slot.durationMinutes !== Number(durationFilter)) return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const slotDate = new Date(slot.startTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          const isToday =
            slotDate.getDate() === today.getDate() &&
            slotDate.getMonth() === today.getMonth() &&
            slotDate.getFullYear() === today.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysLater = new Date(today);
          sevenDaysLater.setDate(today.getDate() + 7);
          if (slotDate < today || slotDate > sevenDaysLater) return false;
        }
      }

      return true;
    });
  }, [slots, searchQuery, durationFilter, dateFilter]);

  // Open booking modal
  const handleOpenBookingModal = (slot) => {
    setSelectedSlot(slot);
    setBookingNotes('');
    setBookingError(null);
    setBookingSuccess(null);
  };

  // Close booking modal
  const handleCloseModal = () => {
    setSelectedSlot(null);
    setBookingNotes('');
    setBookingError(null);
    setBookingSuccess(null);
  };

  // Submit Booking
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    try {
      setBookingSubmitting(true);
      setBookingError(null);

      const res = await interviewService.bookSlot({
        slotId: selectedSlot._id,
        notes: bookingNotes,
      });

      if (res.success) {
        setBookingSuccess(res.data?.booking || res.data);
        toast.success('Interview slot booked successfully!');
        // Refresh slots in background so capacity updates
        fetchSlots();
      }
    } catch (err) {
      const classified = classifyBookingError(err);
      setBookingError(classified);

      // If slot is full, immediately mark it as booked in local state so user sees it filled up
      if (classified.category === 'slot_full') {
        setSlots((prev) =>
          prev.map((s) => (s._id === selectedSlot._id ? { ...s, bookedCount: s.capacity } : s))
        );
      }
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Date formatting helpers
  const formatDateTime = (isoString) => {
    if (!isoString) return '';
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

  return (
    <div className="page-container available-slots-page" data-testid="available-slots-page">
      {/* Page Header */}
      <div className="slots-page-header">
        <div>
          <span className="badge badge-candidate">Interview Scheduling</span>
          <h1 className="page-title">Available Interview Slots</h1>
          <p className="page-subtitle">
            Reserve your 1-on-1 mock technical interview with an industry interviewer. Sessions include live feedback.
          </p>
        </div>
        <div className="header-actions">
          <Link to="/candidate/bookings" className="btn btn-outline" data-testid="link-my-interviews-header">
            📅 View My Bookings
          </Link>
        </div>
      </div>

      {/* Global Error Banner */}
      {fetchError && (
        <div className="alert alert-error" data-testid="alert-fetch-error">
          <span className="alert-icon">⚠</span>
          <span>{fetchError}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={fetchSlots}>
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="slots-filter-toolbar" data-testid="slots-filter-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-control search-input"
            placeholder="Search by role, topic, or interviewer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-slots"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="durationFilter">Duration:</label>
          <select
            id="durationFilter"
            className="form-control filter-select"
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value)}
            data-testid="select-duration-filter"
          >
            <option value="all">All Durations</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="dateFilter">When:</label>
          <select
            id="dateFilter"
            className="form-control filter-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            data-testid="select-date-filter"
          >
            <option value="all">All Upcoming</option>
            <option value="today">Today Only</option>
            <option value="week">Next 7 Days</option>
          </select>
        </div>
      </div>

      {/* Slots Feed / Grid */}
      {loading ? (
        <div className="slots-loading-screen" data-testid="slots-loading">
          <div className="spinner" />
          <p>Finding open interview slots...</p>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="empty-slots-box" data-testid="empty-slots-box">
          <span className="empty-icon">🗓</span>
          <h3>No matching interview slots found</h3>
          <p>
            {slots.length === 0
              ? 'There are currently no open interview slots available for booking. New slots are added regularly by interviewers.'
              : 'Try clearing or modifying your search filters to view more available times.'}
          </p>
          {(searchQuery || durationFilter !== 'all' || dateFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchQuery('');
                setDurationFilter('all');
                setDateFilter('all');
              }}
              data-testid="btn-reset-filters"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="slots-grid" data-testid="slots-grid">
          {filteredSlots.map((slot) => {
            const availableSeats = Math.max(0, (slot.capacity || 1) - (slot.bookedCount || 0));
            const isFull = availableSeats === 0;

            return (
              <div
                key={slot._id}
                className={`slot-card ${isFull ? 'slot-card-full' : ''}`}
                data-testid={`slot-card-${slot._id}`}
              >
                <div className="slot-card-header">
                  <span className="slot-duration-badge">⏱ {slot.durationMinutes || 45} mins</span>
                  <span
                    className={`badge ${isFull ? 'badge-danger' : availableSeats === 1 ? 'badge-warning' : 'badge-success'}`}
                    data-testid={`slot-capacity-badge-${slot._id}`}
                  >
                    {isFull ? '✕ Fully Booked' : `${availableSeats} of ${slot.capacity} spots open`}
                  </span>
                </div>

                <h3 className="slot-title" data-testid={`slot-title-${slot._id}`}>
                  {slot.title}
                </h3>

                <div className="slot-interviewer">
                  <span className="interviewer-icon">👤</span>
                  <span className="interviewer-name">Interviewer: {slot.interviewerName}</span>
                </div>

                <div className="slot-time-block">
                  <div className="time-row">
                    <span className="time-icon">📅</span>
                    <span className="time-date">{formatDateTime(slot.startTime)}</span>
                  </div>
                  <div className="time-row">
                    <span className="time-icon">⏰</span>
                    <span className="time-hours">{formatTimeRange(slot.startTime, slot.endTime)}</span>
                  </div>
                </div>

                <p className="slot-description" data-testid={`slot-description-${slot._id}`}>
                  {slot.description ? (
                    slot.description
                  ) : (
                    <span className="slot-description-fallback">No description provided</span>
                  )}
                </p>

                <div className="slot-card-footer">
                  <button
                    type="button"
                    className="btn btn-primary btn-block btn-book-slot"
                    onClick={() => handleOpenBookingModal(slot)}
                    disabled={isFull}
                    data-testid={`btn-book-slot-${slot._id}`}
                  >
                    {isFull ? 'Slot Full' : 'Book Session'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      {selectedSlot && (
        <div className="modal-backdrop" data-testid="booking-modal-backdrop">
          <div className="modal-dialog booking-modal-dialog" data-testid="booking-modal">
            <div className="modal-header">
              <h2>Confirm Interview Booking</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={bookingSubmitting}
                data-testid="btn-close-modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {bookingSuccess ? (
                /* Success View */
                <div className="booking-success-view" data-testid="booking-success-view">
                  <span className="success-icon">✓</span>
                  <h3>Interview Confirmed!</h3>
                  <p className="success-text">
                    Your mock interview session has been scheduled. A confirmation email and calendar invitation have been sent to your account.
                  </p>

                  <div className="confirmed-summary-box">
                    <h4>{selectedSlot.title}</h4>
                    <p>
                      <strong>Interviewer:</strong> {selectedSlot.interviewerName}
                    </p>
                    <p>
                      <strong>Date &amp; Time:</strong> {formatDateTime(selectedSlot.startTime)} at{' '}
                      {formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}
                    </p>
                  </div>

                  <div className="modal-actions-group">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate('/candidate/bookings')}
                      data-testid="btn-goto-my-bookings"
                    >
                      Go to My Interviews
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCloseModal}
                      data-testid="btn-done-booking"
                    >
                      Book Another Session
                    </button>
                  </div>
                </div>
              ) : (
                /* Booking Form View */
                <form onSubmit={handleConfirmBooking}>
                  {/* Differentiated Error Banner */}
                  {bookingError && (
                    <div
                      className={`alert ${bookingError.category === 'duplicate_booking' ? 'alert-info' : 'alert-error'}`}
                      data-testid="alert-booking-error"
                    >
                      <span className="alert-icon">
                        {bookingError.category === 'duplicate_booking' ? 'ℹ' : '⚠'}
                      </span>
                      <div className="alert-content">
                        <strong>{bookingError.title}: </strong>
                        <span>{bookingError.message}</span>
                        {bookingError.actionLink && (
                          <div className="alert-action-btn-row">
                            <Link
                              to={bookingError.actionLink}
                              className="btn btn-sm btn-primary"
                              data-testid="btn-error-action-link"
                            >
                              {bookingError.actionText}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Slot Details Summary Box */}
                  <div className="modal-slot-summary">
                    <h3 data-testid="modal-slot-title">{selectedSlot.title}</h3>
                    <div className="summary-details-grid">
                      <div>
                        <span className="summary-label">Interviewer</span>
                        <span className="summary-val">{selectedSlot.interviewerName}</span>
                      </div>
                      <div>
                        <span className="summary-label">Duration</span>
                        <span className="summary-val">{selectedSlot.durationMinutes || 45} mins</span>
                      </div>
                      <div>
                        <span className="summary-label">Date</span>
                        <span className="summary-val">{formatDateTime(selectedSlot.startTime)}</span>
                      </div>
                      <div>
                        <span className="summary-label">Time Window</span>
                        <span className="summary-val">
                          {formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes Field */}
                  <div className="form-group">
                    <div className="label-with-counter">
                      <label htmlFor="bookingNotes">Optional Session Notes / Areas of Focus</label>
                      <span className="char-counter">{bookingNotes.length}/500</span>
                    </div>
                    <textarea
                      id="bookingNotes"
                      className="form-control"
                      rows={3}
                      placeholder="e.g. Please focus on system design, database indexing, and React concurrency..."
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      maxLength={500}
                      disabled={bookingSubmitting}
                      data-testid="textarea-booking-notes"
                    />
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCloseModal}
                      disabled={bookingSubmitting}
                      data-testid="btn-cancel-modal"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={bookingSubmitting || bookingError?.category === 'slot_full'}
                      data-testid="btn-confirm-booking"
                    >
                      {bookingSubmitting ? (
                        <>
                          <span className="button-spinner" /> Reserving Seat...
                        </>
                      ) : (
                        'Confirm & Reserve'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableSlotsPage;
