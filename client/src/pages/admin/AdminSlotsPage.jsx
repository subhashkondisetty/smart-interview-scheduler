import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminSlotsPage = () => {
  const toast = useToast();

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [deletingSlot, setDeletingSlot] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const initialFormState = {
    title: '',
    interviewerName: 'Senior Technical Interviewer',
    startTime: '',
    durationMinutes: 45,
    capacity: 1,
    meetingLink: '',
    description: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState([]);

  // Fetch all admin slots
  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await adminService.getSlots(params);
      setSlots(data);
    } catch (err) {
      console.error('Failed to load slots:', err);
      setError(err.response?.data?.message || 'Failed to load interview slots');
      toast.error('Unable to fetch interview slots.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Derived stats
  const stats = useMemo(() => {
    const total = slots.length;
    let available = 0;
    let booked = 0;
    let cancelled = 0;
    let completed = 0;

    slots.forEach((s) => {
      if (s.status === 'available') available += 1;
      else if (s.status === 'booked') booked += 1;
      else if (s.status === 'cancelled') cancelled += 1;
      else if (s.status === 'completed') completed += 1;
    });

    return { total, available, booked, cancelled, completed };
  }, [slots]);

  // Filtered slots (client search by title or interviewer)
  const filteredSlots = useMemo(() => {
    if (!searchQuery.trim()) return slots;
    const q = searchQuery.toLowerCase().trim();
    return slots.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.interviewerName && s.interviewerName.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [slots, searchQuery]);

  // Form helper: convert Date to datetime-local string (YYYY-MM-DDTHH:mm)
  const toDatetimeLocal = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    // Default start time: tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    setFormData({
      ...initialFormState,
      startTime: toDatetimeLocal(tomorrow.toISOString()),
    });
    setFormErrors([]);
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (slot) => {
    setEditingSlot(slot);
    setFormData({
      title: slot.title || '',
      interviewerName: slot.interviewerName || '',
      startTime: toDatetimeLocal(slot.startTime),
      durationMinutes: slot.durationMinutes || 45,
      capacity: slot.capacity || 1,
      status: slot.status || 'available',
      meetingLink: slot.meetingLink || '',
      description: slot.description || '',
    });
    setFormErrors([]);
  };

  // Handle Create Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);
    setActionLoading(true);

    try {
      const payload = {
        title: formData.title.trim() || undefined,
        interviewerName: formData.interviewerName.trim() || undefined,
        startTime: new Date(formData.startTime).toISOString(),
        durationMinutes: parseInt(formData.durationMinutes, 10),
        capacity: parseInt(formData.capacity, 10),
        meetingLink: formData.meetingLink.trim() || undefined,
        description: formData.description.trim() || undefined,
      };

      await adminService.createSlot(payload);
      toast.success('Interview slot created successfully!');
      setIsCreateOpen(false);
      fetchSlots();
    } catch (err) {
      console.error('Create slot failed:', err);
      const errors = err.response?.data?.errors;
      const msg = err.response?.data?.message || 'Failed to create interview slot';
      if (Array.isArray(errors)) {
        setFormErrors(errors);
      } else {
        setFormErrors([msg]);
      }
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;
    setFormErrors([]);
    setActionLoading(true);

    try {
      const payload = {
        title: formData.title.trim() || undefined,
        interviewerName: formData.interviewerName.trim() || undefined,
        startTime: new Date(formData.startTime).toISOString(),
        durationMinutes: parseInt(formData.durationMinutes, 10),
        capacity: parseInt(formData.capacity, 10),
        status: formData.status,
        meetingLink: formData.meetingLink.trim(),
        description: formData.description.trim(),
      };

      await adminService.updateSlot(editingSlot._id, payload);
      toast.success('Interview slot updated successfully!');
      setEditingSlot(null);
      fetchSlots();
    } catch (err) {
      console.error('Update slot failed:', err);
      const errors = err.response?.data?.errors;
      const msg = err.response?.data?.message || 'Failed to update interview slot';
      if (Array.isArray(errors)) {
        setFormErrors(errors);
      } else {
        setFormErrors([msg]);
      }
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete / Cancel Confirm
  const handleDeleteConfirm = async () => {
    if (!deletingSlot) return;
    setActionLoading(true);

    try {
      const res = await adminService.deleteSlot(deletingSlot._id);
      if (res.data?.slot?.status === 'cancelled' || res.message?.includes('marked as cancelled')) {
        toast.warning(
          `Slot had active bookings: slot and ${res.data?.cancelledBookingsCount || 'associated'} candidate bookings were marked as cancelled with notifications sent.`
        );
      } else {
        toast.success('Interview slot deleted successfully.');
      }
      setDeletingSlot(null);
      fetchSlots();
    } catch (err) {
      console.error('Delete slot failed:', err);
      toast.error(err.response?.data?.message || 'Failed to delete interview slot');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="admin-slots-page page-container">
      {/* Header Banner */}
      <div className="page-header flex-between">
        <div>
          <span className="badge badge-primary">Scheduling Control</span>
          <h2>Manage Interview Slots</h2>
          <p className="subtitle">
            Configure interview availability, set video meeting links and session descriptions, and supervise bookings.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="btn btn-primary btn-lg"
          data-testid="create-slot-btn"
        >
          <span className="btn-icon">+</span> Create Interview Slot
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Slots</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">Configured availability</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-label">Available Slots</div>
          <div className="stat-value text-success">{stats.available}</div>
          <div className="stat-sub">Ready for candidate booking</div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-label">Booked Slots</div>
          <div className="stat-value text-info">{stats.booked}</div>
          <div className="stat-sub">Capacity filled</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-label">Cancelled Slots</div>
          <div className="stat-value text-muted">{stats.cancelled}</div>
          <div className="stat-sub">Archived or cancelled</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="controls-bar card">
        <div className="status-pills">
          {['all', 'available', 'booked', 'cancelled', 'completed'].map((status) => (
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
            placeholder="Search by title, interviewer, or keywords..."
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

      {/* Main Content Area */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading interview slots...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">
          <p>{error}</p>
          <button onClick={fetchSlots} className="btn btn-outline btn-sm mt-2">
            Retry
          </button>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📅</div>
          <h3>No interview slots found</h3>
          <p>
            {searchQuery
              ? `No interview slots match "${searchQuery}". Try modifying your filter or clear the search.`
              : 'There are currently no interview slots under this status filter.'}
          </p>
          {searchQuery ? (
            <button onClick={() => setSearchQuery('')} className="btn btn-outline btn-sm">
              Clear Search
            </button>
          ) : (
            <button onClick={handleOpenCreate} className="btn btn-primary btn-sm">
              Create First Slot
            </button>
          )}
        </div>
      ) : (
        <div className="slots-table-container card">
          <table className="data-table" data-testid="slots-table">
            <thead>
              <tr>
                <th>Interview Title</th>
                <th>Interviewer</th>
                <th>Date & Time</th>
                <th>Duration</th>
                <th>Capacity & Fill</th>
                <th>Status</th>
                <th>Meeting Link</th>
                <th>Description</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlots.map((slot) => {
                const startTimeFormatted = new Date(slot.startTime).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                const fillPercentage =
                  slot.capacity > 0 ? Math.round((slot.bookedCount / slot.capacity) * 100) : 0;

                const statusBadgeClass =
                  slot.status === 'available'
                    ? 'badge-success'
                    : slot.status === 'booked'
                    ? 'badge-info'
                    : slot.status === 'cancelled'
                    ? 'badge-danger'
                    : 'badge-secondary';

                return (
                  <tr key={slot._id} data-testid={`slot-row-${slot._id}`}>
                    <td className="slot-title-cell">
                      <strong>{slot.title || 'Technical Interview'}</strong>
                    </td>
                    <td>{slot.interviewerName || 'Interviewer'}</td>
                    <td>
                      <span className="date-time-badge">{startTimeFormatted}</span>
                    </td>
                    <td>{slot.durationMinutes} mins</td>
                    <td>
                      <div className="capacity-indicator">
                        <div className="capacity-bar-track">
                          <div
                            className={`capacity-bar-fill ${fillPercentage >= 100 ? 'full' : ''}`}
                            style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                          ></div>
                        </div>
                        <span className="capacity-text">
                          {slot.bookedCount} / {slot.capacity}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass}`}>
                        {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                      </span>
                    </td>
                    <td className="meeting-link-cell">
                      {slot.meetingLink ? (
                        <a
                          href={slot.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-pill"
                          title={slot.meetingLink}
                        >
                          🔗 Join Link
                        </a>
                      ) : (
                        <span className="text-muted italic">Pending</span>
                      )}
                    </td>
                    <td className="description-cell">
                      {slot.description ? (
                        <span className="desc-snippet" title={slot.description}>
                          {slot.description.length > 50
                            ? `${slot.description.substring(0, 50)}...`
                            : slot.description}
                        </span>
                      ) : (
                        <span className="text-muted italic">None</span>
                      )}
                    </td>
                    <td className="text-right actions-cell">
                      <div className="btn-group">
                        <Link
                          to={`/admin/bookings?slotId=${slot._id}`}
                          className="btn btn-outline btn-xs"
                          title="View Bookings for this slot"
                        >
                          Bookings ({slot.bookedCount})
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(slot)}
                          className="btn btn-secondary btn-xs"
                          title="Edit interview slot"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSlot(slot)}
                          className="btn btn-danger-outline btn-xs"
                          title="Cancel or delete slot"
                        >
                          Cancel/Delete
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

      {/* CREATE SLOT MODAL */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div
            className="modal-card modal-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="create-slot-modal"
          >
            <div className="modal-header">
              <h3>Create Interview Availability Slot</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsCreateOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formErrors.length > 0 && (
                  <div className="alert alert-danger mb-3">
                    <ul className="mb-0">
                      {formErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="create-title">Interview Title</label>
                    <input
                      id="create-title"
                      type="text"
                      className="input-field"
                      placeholder="e.g. System Design Mock Interview"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-interviewer">Interviewer Name</label>
                    <input
                      id="create-interviewer"
                      type="text"
                      className="input-field"
                      placeholder="e.g. Sarah Chen"
                      value={formData.interviewerName}
                      onChange={(e) =>
                        setFormData({ ...formData, interviewerName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-starttime">Start Date & Time</label>
                    <input
                      id="create-starttime"
                      type="datetime-local"
                      className="input-field"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-duration">Duration (Minutes)</label>
                    <input
                      id="create-duration"
                      type="number"
                      min="15"
                      max="300"
                      step="15"
                      className="input-field"
                      value={formData.durationMinutes}
                      onChange={(e) =>
                        setFormData({ ...formData, durationMinutes: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-capacity">Candidate Capacity</label>
                    <input
                      id="create-capacity"
                      type="number"
                      min="1"
                      className="input-field"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      required
                    />
                  </div>

                  {/* EXPLICIT EDITABLE MEETING LINK FIELD */}
                  <div className="form-group full-width">
                    <label htmlFor="create-meetinglink">
                      Video Meeting Link <span className="field-hint">(Exposed to confirmed candidates)</span>
                    </label>
                    <input
                      id="create-meetinglink"
                      type="text"
                      className="input-field"
                      placeholder="e.g. https://meet.google.com/abc-defg-hij or https://zoom.us/j/123456789"
                      value={formData.meetingLink}
                      onChange={(e) =>
                        setFormData({ ...formData, meetingLink: e.target.value })
                      }
                    />
                  </div>

                  {/* EXPLICIT EDITABLE DESCRIPTION FIELD */}
                  <div className="form-group full-width">
                    <label htmlFor="create-description">
                      Session Agenda & Description <span className="field-hint">(Detailed guidance for candidates)</span>
                    </label>
                    <textarea
                      id="create-description"
                      className="textarea-field"
                      rows="3"
                      placeholder="Describe what will be covered, prerequisites, or preparation guidance..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Creating Slot...' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SLOT MODAL */}
      {editingSlot && (
        <div className="modal-overlay" onClick={() => setEditingSlot(null)}>
          <div
            className="modal-card modal-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="edit-slot-modal"
          >
            <div className="modal-header">
              <h3>Edit Interview Slot</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setEditingSlot(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formErrors.length > 0 && (
                  <div className="alert alert-danger mb-3">
                    <ul className="mb-0">
                      {formErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="edit-title">Interview Title</label>
                    <input
                      id="edit-title"
                      type="text"
                      className="input-field"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-interviewer">Interviewer Name</label>
                    <input
                      id="edit-interviewer"
                      type="text"
                      className="input-field"
                      value={formData.interviewerName}
                      onChange={(e) =>
                        setFormData({ ...formData, interviewerName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-starttime">Start Date & Time</label>
                    <input
                      id="edit-starttime"
                      type="datetime-local"
                      className="input-field"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-duration">Duration (Minutes)</label>
                    <input
                      id="edit-duration"
                      type="number"
                      min="15"
                      max="300"
                      step="15"
                      className="input-field"
                      value={formData.durationMinutes}
                      onChange={(e) =>
                        setFormData({ ...formData, durationMinutes: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-capacity">Candidate Capacity</label>
                    <input
                      id="edit-capacity"
                      type="number"
                      min="1"
                      className="input-field"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-status">Slot Status</label>
                    <select
                      id="edit-status"
                      className="select-field"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="available">Available</option>
                      <option value="booked">Booked (Full)</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  {/* EXPLICIT EDITABLE MEETING LINK FIELD IN EDIT FORM */}
                  <div className="form-group full-width">
                    <label htmlFor="edit-meetinglink">
                      Video Meeting Link <span className="field-hint">(Exposed to confirmed candidates)</span>
                    </label>
                    <input
                      id="edit-meetinglink"
                      type="text"
                      className="input-field"
                      placeholder="e.g. https://meet.google.com/abc-defg-hij or https://zoom.us/j/123456789"
                      value={formData.meetingLink}
                      onChange={(e) =>
                        setFormData({ ...formData, meetingLink: e.target.value })
                      }
                    />
                  </div>

                  {/* EXPLICIT EDITABLE DESCRIPTION FIELD IN EDIT FORM */}
                  <div className="form-group full-width">
                    <label htmlFor="edit-description">
                      Session Agenda & Description <span className="field-hint">(Detailed guidance for candidates)</span>
                    </label>
                    <textarea
                      id="edit-description"
                      className="textarea-field"
                      rows="3"
                      placeholder="Describe what will be covered, prerequisites, or preparation guidance..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingSlot(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / CANCEL CONFIRMATION MODAL */}
      {deletingSlot && (
        <div className="modal-overlay" onClick={() => setDeletingSlot(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            data-testid="delete-slot-modal"
          >
            <div className="modal-header">
              <h3 className="text-danger">Cancel / Delete Interview Slot</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setDeletingSlot(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to remove the slot{' '}
                <strong>"{deletingSlot.title}"</strong> scheduled for{' '}
                <strong>
                  {new Date(deletingSlot.startTime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </strong>
                ?
              </p>

              {deletingSlot.bookedCount > 0 ? (
                <div className="alert alert-warning mt-3">
                  <strong>⚠️ Active Bookings Cascade Warning:</strong>
                  <p className="mb-0 mt-1">
                    This slot currently has{' '}
                    <strong>{deletingSlot.bookedCount} active booking(s)</strong>. To preserve audit
                    integrity, the slot will be marked as <strong>cancelled</strong>, and all
                    associated candidate bookings will be <strong>atomically transitioned to cancelled</strong>.
                    Every affected candidate will receive an administrative cancellation email and in-app
                    notification.
                  </p>
                </div>
              ) : (
                <p className="text-muted mt-2">
                  This slot has 0 active bookings and will be permanently deleted from the database.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeletingSlot(null)}
                disabled={actionLoading}
              >
                Go Back
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Processing...'
                  : deletingSlot.bookedCount > 0
                  ? 'Cancel Slot & Bookings'
                  : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSlotsPage;
