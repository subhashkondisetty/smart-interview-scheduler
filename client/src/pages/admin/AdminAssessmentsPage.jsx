import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminAssessmentsPage = () => {
  const toast = useToast();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'intermediate',
    durationMinutes: 30,
    passingPercentage: 60,
    maxAttempts: 3,
    isPublished: false,
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load assessments
  const fetchAssessments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAssessments();
      setAssessments(data);
    } catch (err) {
      console.error('Failed to load assessments:', err);
      setError(err.response?.data?.message || 'Failed to load assessments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  // Filtered Assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter((item) => {
      // Difficulty filter
      if (difficultyFilter !== 'all' && item.difficulty !== difficultyFilter) {
        return false;
      }
      // Status filter
      if (statusFilter === 'published' && !item.isPublished) return false;
      if (statusFilter === 'draft' && item.isPublished) return false;

      // Search query (title and description)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [assessments, difficultyFilter, statusFilter, searchQuery]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const total = assessments.length;
    const published = assessments.filter((a) => a.isPublished).length;
    const drafts = assessments.filter((a) => !a.isPublished).length;
    const avgPassing =
      total > 0
        ? Math.round(assessments.reduce((acc, a) => acc + (a.passingPercentage || 0), 0) / total)
        : 0;

    return { total, published, drafts, avgPassing };
  }, [assessments]);

  // Handle Form Change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      difficulty: 'intermediate',
      durationMinutes: 30,
      passingPercentage: 60,
      maxAttempts: 3,
      isPublished: false,
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (assessment) => {
    setSelectedAssessment(assessment);
    setFormData({
      title: assessment.title || '',
      description: assessment.description || '',
      difficulty: assessment.difficulty || 'intermediate',
      durationMinutes: assessment.durationMinutes || 30,
      passingPercentage: assessment.passingPercentage ?? 60,
      maxAttempts: assessment.maxAttempts || 3,
      isPublished: Boolean(assessment.isPublished),
    });
    setFormError(null);
    setShowEditModal(true);
  };

  // Open Delete Modal
  const openDeleteModal = (assessment) => {
    setSelectedAssessment(assessment);
    setFormError(null);
    setShowDeleteModal(true);
  };

  // Submit Create Assessment
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Assessment title is required.');
      return;
    }
    if (formData.title.trim().length > 150) {
      setFormError('Title cannot exceed 150 characters.');
      return;
    }
    if (formData.durationMinutes < 5 || formData.durationMinutes > 180) {
      setFormError('Duration must be between 5 and 180 minutes.');
      return;
    }
    if (formData.passingPercentage < 0 || formData.passingPercentage > 100) {
      setFormError('Passing percentage must be between 0 and 100%.');
      return;
    }
    if (formData.maxAttempts < 1) {
      setFormError('Must allow at least 1 attempt.');
      return;
    }

    try {
      setSubmitting(true);
      await adminService.createAssessment(formData);
      setActionSuccess(`Assessment "${formData.title}" created successfully.`);
      toast.success(`Assessment "${formData.title}" created successfully.`);
      setShowCreateModal(false);
      fetchAssessments();
    } catch (err) {
      console.error('Create assessment failed:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to create assessment.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Assessment
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Assessment title is required.');
      return;
    }
    if (formData.title.trim().length > 150) {
      setFormError('Title cannot exceed 150 characters.');
      return;
    }
    if (formData.durationMinutes < 5 || formData.durationMinutes > 180) {
      setFormError('Duration must be between 5 and 180 minutes.');
      return;
    }
    if (formData.passingPercentage < 0 || formData.passingPercentage > 100) {
      setFormError('Passing percentage must be between 0 and 100%.');
      return;
    }
    if (formData.maxAttempts < 1) {
      setFormError('Must allow at least 1 attempt.');
      return;
    }

    try {
      setSubmitting(true);
      await adminService.updateAssessment(selectedAssessment._id, formData);
      setActionSuccess(`Assessment "${formData.title}" updated successfully.`);
      toast.success(`Assessment "${formData.title}" updated successfully.`);
      setShowEditModal(false);
      fetchAssessments();
    } catch (err) {
      console.error('Update assessment failed:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to update assessment.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Publish / Unpublish Toggle
  const handleTogglePublish = async (assessment) => {
    try {
      const nextStatus = !assessment.isPublished;
      if (nextStatus && (assessment.questionCount === 0 || !assessment.questionCount)) {
        setActionSuccess(`Notice: Assessment published, but it currently has 0 questions.`);
        toast.warning(`Notice: Assessment published, but it currently has 0 questions.`);
      }
      await adminService.togglePublishAssessment(assessment._id, nextStatus);
      setActionSuccess(`Assessment "${assessment.title}" is now ${nextStatus ? 'published' : 'unpublished (draft)'}.`);
      toast.success(`Assessment "${assessment.title}" is now ${nextStatus ? 'published' : 'unpublished (draft)'}.`);
      fetchAssessments();
    } catch (err) {
      console.error('Toggle publish failed:', err);
      const errMsg = err.response?.data?.message || 'Failed to toggle publish status.';
      setError(errMsg);
      toast.error(errMsg);
    }
  };

  // Submit Delete Assessment (Guarded)
  const handleDeleteSubmit = async () => {
    if (!selectedAssessment) return;

    // Client check mirroring backend guard
    if (selectedAssessment.attemptCount > 0) {
      const blockMsg =
        'Cannot delete assessment with existing candidate attempts. Unpublish the assessment instead to preserve candidate attempt history.';
      setFormError(blockMsg);
      toast.warning(blockMsg);
      return;
    }

    try {
      setSubmitting(true);
      await adminService.deleteAssessment(selectedAssessment._id);
      setActionSuccess(`Assessment "${selectedAssessment.title}" and its questions deleted successfully.`);
      toast.success(`Assessment "${selectedAssessment.title}" and its questions deleted successfully.`);
      setShowDeleteModal(false);
      fetchAssessments();
    } catch (err) {
      console.error('Delete assessment failed:', err);
      const errMsg = err.response?.data?.message || 'Failed to delete assessment.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick action: Unpublish from delete modal if attempts exist
  const handleUnpublishFromModal = async () => {
    if (!selectedAssessment) return;
    try {
      setSubmitting(true);
      await adminService.togglePublishAssessment(selectedAssessment._id, false);
      setActionSuccess(`Assessment "${selectedAssessment.title}" successfully unpublished to preserve candidate history.`);
      setShowDeleteModal(false);
      fetchAssessments();
    } catch (err) {
      console.error('Unpublish failed:', err);
      setFormError(err.response?.data?.message || 'Failed to unpublish assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-assessments-page">
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <h2>Manage Assessments</h2>
          <p className="subtitle">
            Configure assessments, toggle catalog publication, monitor candidate attempts, and manage question banks.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary"
          data-testid="create-assessment-btn"
        >
          + Create Assessment
        </button>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible" role="alert">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="close-btn" aria-label="Close">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-btn" aria-label="Close">
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" data-testid="kpi-total-assessments">
          <span className="kpi-label">Total Assessments</span>
          <span className="kpi-value">{kpiStats.total}</span>
          <span className="kpi-subtext">Entire evaluation catalog</span>
        </div>
        <div className="kpi-card" data-testid="kpi-published-assessments">
          <span className="kpi-label">Published</span>
          <span className="kpi-value text-success">{kpiStats.published}</span>
          <span className="kpi-subtext">Live for candidate discovery</span>
        </div>
        <div className="kpi-card" data-testid="kpi-draft-assessments">
          <span className="kpi-label">Drafts (Unpublished)</span>
          <span className="kpi-value text-warning">{kpiStats.drafts}</span>
          <span className="kpi-subtext">In review or staging</span>
        </div>
        <div className="kpi-card" data-testid="kpi-avg-passing">
          <span className="kpi-label">Avg Passing Score</span>
          <span className="kpi-value">{kpiStats.avgPassing}%</span>
          <span className="kpi-subtext">Baseline qualification target</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-panel card mb-4">
        <div className="filter-row flex-wrap">
          {/* Search Box */}
          <div className="search-group flex-1">
            <input
              type="text"
              id="assessment-search"
              data-testid="assessment-search"
              className="form-control"
              placeholder="Search by assessment title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Difficulty Filter */}
          <div className="filter-pills">
            <span className="filter-label">Difficulty:</span>
            {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`pill-btn ${difficultyFilter === lvl ? 'active' : ''}`}
                onClick={() => setDifficultyFilter(lvl)}
                data-testid={`filter-difficulty-${lvl}`}
              >
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="filter-pills">
            <span className="filter-label">Status:</span>
            {['all', 'published', 'draft'].map((st) => (
              <button
                key={st}
                type="button"
                className={`pill-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
                data-testid={`filter-status-${st}`}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="loading-container card text-center p-5">
          <div className="spinner"></div>
          <p className="mt-3 text-muted">Loading assessment repository...</p>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="empty-state card text-center p-5">
          <span className="empty-icon" style={{ fontSize: '3rem' }}>📋</span>
          <h3>No Assessments Found</h3>
          <p className="text-muted">
            {assessments.length === 0
              ? 'Get started by creating your first assessment.'
              : 'No assessments matched your current search or filter criteria.'}
          </p>
          {assessments.length === 0 && (
            <button onClick={openCreateModal} className="btn btn-primary mt-3">
              + Create Assessment
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive card">
          <table className="data-table" data-testid="assessments-table">
            <thead>
              <tr>
                <th>Title & Description</th>
                <th>Difficulty</th>
                <th>Duration</th>
                <th>Pass Rate</th>
                <th>Attempts Allowed</th>
                <th>Questions</th>
                <th>Candidate History</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssessments.map((item) => (
                <tr key={item._id} data-testid={`assessment-row-${item._id}`}>
                  <td>
                    <div className="assessment-title-cell">
                      <strong className="assessment-title">{item.title}</strong>
                      {item.description && (
                        <p className="text-muted text-truncate mb-0" style={{ maxWidth: '280px', fontSize: '0.85rem' }}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-difficulty badge-${item.difficulty}`}>
                      {item.difficulty?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span>⏱ {item.durationMinutes}m</span>
                  </td>
                  <td>
                    <span>🎯 {item.passingPercentage}%</span>
                  </td>
                  <td>
                    <span>🔄 {item.maxAttempts}x</span>
                  </td>
                  <td>
                    <Link
                      to={`/admin/assessments/${item._id}/questions`}
                      className="badge-link"
                      data-testid={`manage-questions-btn-${item._id}`}
                      title="Manage Questions in this Assessment"
                    >
                      <span className="badge badge-info">
                        📝 {item.questionCount !== undefined ? item.questionCount : 0} Questions
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge-secondary" title="Total attempts recorded by candidates">
                      👥 {item.attemptCount !== undefined ? item.attemptCount : 0}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(item)}
                      className={`btn btn-xs ${item.isPublished ? 'btn-success' : 'btn-outline-warning'}`}
                      data-testid={`toggle-publish-btn-${item._id}`}
                      title={item.isPublished ? 'Click to unpublish (hide from candidates)' : 'Click to publish (make live)'}
                    >
                      {item.isPublished ? '● Published' : '○ Draft'}
                    </button>
                  </td>
                  <td className="text-right table-actions">
                    <div className="btn-group">
                      <Link
                        to={`/admin/assessments/${item._id}/questions`}
                        className="btn btn-outline btn-xs"
                        title="Edit Questions"
                      >
                        Questions
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="btn btn-outline btn-xs"
                        data-testid={`edit-assessment-btn-${item._id}`}
                        title="Edit Details"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal(item)}
                        className="btn btn-outline-danger btn-xs"
                        data-testid={`delete-assessment-btn-${item._id}`}
                        title="Delete Assessment"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" data-testid="create-assessment-modal">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create New Assessment</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="close-btn"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger mb-3" role="alert">
                    {formError}
                  </div>
                )}

                <div className="form-group mb-3">
                  <label htmlFor="create-title">Assessment Title *</label>
                  <input
                    type="text"
                    id="create-title"
                    name="title"
                    className="form-control"
                    placeholder="e.g. Distributed Systems & Cloud Architecture"
                    value={formData.title}
                    onChange={handleInputChange}
                    maxLength={150}
                    required
                  />
                  <small className="form-text text-muted">Maximum 150 characters.</small>
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="create-description">Description</label>
                  <textarea
                    id="create-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    placeholder="Describe the topics, target role, and assessment expectations..."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group col-6 mb-3">
                    <label htmlFor="create-difficulty">Difficulty Tier</label>
                    <select
                      id="create-difficulty"
                      name="difficulty"
                      className="form-control"
                      value={formData.difficulty}
                      onChange={handleInputChange}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="form-group col-6 mb-3">
                    <label htmlFor="create-duration">Duration (Minutes) *</label>
                    <input
                      type="number"
                      id="create-duration"
                      name="durationMinutes"
                      className="form-control"
                      min={5}
                      max={180}
                      value={formData.durationMinutes}
                      onChange={handleInputChange}
                      required
                    />
                    <small className="form-text text-muted">Between 5 and 180 mins.</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-6 mb-3">
                    <label htmlFor="create-passing">Passing Score (%) *</label>
                    <input
                      type="number"
                      id="create-passing"
                      name="passingPercentage"
                      className="form-control"
                      min={0}
                      max={100}
                      value={formData.passingPercentage}
                      onChange={handleInputChange}
                      required
                    />
                    <small className="form-text text-muted">0 to 100% threshold.</small>
                  </div>

                  <div className="form-group col-6 mb-3">
                    <label htmlFor="create-max-attempts">Max Attempts Allowed *</label>
                    <input
                      type="number"
                      id="create-max-attempts"
                      name="maxAttempts"
                      className="form-control"
                      min={1}
                      value={formData.maxAttempts}
                      onChange={handleInputChange}
                      required
                    />
                    <small className="form-text text-muted">Minimum 1 attempt.</small>
                  </div>
                </div>

                <div className="form-group form-check mt-2">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      id="create-is-published"
                      name="isPublished"
                      checked={formData.isPublished}
                      onChange={handleInputChange}
                    />
                    <span className="ml-2">Publish immediately to candidate catalog</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedAssessment && (
        <div className="modal-overlay" data-testid="edit-assessment-modal">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Assessment Details</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="close-btn"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger mb-3" role="alert">
                    {formError}
                  </div>
                )}

                <div className="form-group mb-3">
                  <label htmlFor="edit-title">Assessment Title *</label>
                  <input
                    type="text"
                    id="edit-title"
                    name="title"
                    className="form-control"
                    value={formData.title}
                    onChange={handleInputChange}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="edit-description">Description</label>
                  <textarea
                    id="edit-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group col-6 mb-3">
                    <label htmlFor="edit-difficulty">Difficulty Tier</label>
                    <select
                      id="edit-difficulty"
                      name="difficulty"
                      className="form-control"
                      value={formData.difficulty}
                      onChange={handleInputChange}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="form-group col-6 mb-3">
                    <label htmlFor="edit-duration">Duration (Minutes) *</label>
                    <input
                      type="number"
                      id="edit-duration"
                      name="durationMinutes"
                      className="form-control"
                      min={5}
                      max={180}
                      value={formData.durationMinutes}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-6 mb-3">
                    <label htmlFor="edit-passing">Passing Score (%) *</label>
                    <input
                      type="number"
                      id="edit-passing"
                      name="passingPercentage"
                      className="form-control"
                      min={0}
                      max={100}
                      value={formData.passingPercentage}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group col-6 mb-3">
                    <label htmlFor="edit-max-attempts">Max Attempts Allowed *</label>
                    <input
                      type="number"
                      id="edit-max-attempts"
                      name="maxAttempts"
                      className="form-control"
                      min={1}
                      value={formData.maxAttempts}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group form-check mt-2">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      id="edit-is-published"
                      name="isPublished"
                      checked={formData.isPublished}
                      onChange={handleInputChange}
                    />
                    <span className="ml-2">Published to candidate catalog</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL (With Attempt-Blocking Guidance) */}
      {showDeleteModal && selectedAssessment && (
        <div className="modal-overlay" data-testid="delete-assessment-modal">
          <div className="modal-card modal-danger">
            <div className="modal-header">
              <h3>Delete Assessment</h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="close-btn"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {formError && (
                <div className="alert alert-danger mb-3" role="alert">
                  {formError}
                </div>
              )}

              {selectedAssessment.attemptCount > 0 ? (
                // ATTACK/INTEGRITY DEFENSE: Attempts exist -> Cannot Delete, must Unpublish
                <div className="attempt-protection-notice">
                  <div className="alert alert-warning" role="alert">
                    <strong>⚠️ Deletion Blocked: Historical Records Detected</strong>
                    <p className="mt-2 mb-1">
                      This assessment has <strong>{selectedAssessment.attemptCount}</strong> recorded candidate attempt(s).
                    </p>
                    <p className="mb-0 text-sm">
                      Deleting this assessment would break candidates’ permanent attempt history and score report records.
                      To retire this assessment from active use without destroying past records, please <strong>unpublish</strong> it instead.
                    </p>
                  </div>
                </div>
              ) : (
                // Safe to delete: Zero candidate attempts
                <div className="safe-delete-notice">
                  <p>
                    Are you sure you want to permanently delete{' '}
                    <strong>"{selectedAssessment.title}"</strong>?
                  </p>
                  <p className="text-danger small">
                    ⚠️ This assessment has zero candidate attempts. Deleting it will also permanently remove all{' '}
                    {selectedAssessment.questionCount || 0} associated question(s). This action cannot be undone.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>

              {selectedAssessment.attemptCount > 0 ? (
                <button
                  type="button"
                  onClick={handleUnpublishFromModal}
                  className="btn btn-warning"
                  data-testid="modal-unpublish-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Unpublishing...' : 'Unpublish Instead'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="btn btn-danger"
                  data-testid="modal-confirm-delete-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssessmentsPage;
