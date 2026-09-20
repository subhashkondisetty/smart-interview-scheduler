import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminQuestionsPage = () => {
  const toast = useToast();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL priority: route param /admin/assessments/:assessmentId/questions OR query param ?assessmentId=...
  const routeAssessmentId = params.assessmentId || searchParams.get('assessmentId');

  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(routeAssessmentId || '');
  const [currentAssessment, setCurrentAssessment] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals state
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);

  // Question Form State
  const [formData, setFormData] = useState({
    text: '',
    topic: '',
    difficulty: 'intermediate',
    marks: 1,
    options: ['', ''],
    correctOptionIndex: 0,
    explanation: '',
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch all assessments for the switcher dropdown
  const fetchAllAssessments = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAssessments();
      setAssessments(data);

      // If no assessment pre-selected, default to the first one available
      if (!selectedAssessmentId && data.length > 0) {
        setSelectedAssessmentId(data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load assessments for question management:', err);
      setError('Failed to load assessments list. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAssessments();
  }, []);

  // Update selectedAssessmentId if routeAssessmentId changes
  useEffect(() => {
    if (routeAssessmentId) {
      setSelectedAssessmentId(routeAssessmentId);
    }
  }, [routeAssessmentId]);

  // 2. Fetch questions whenever selectedAssessmentId changes
  const fetchQuestionsForAssessment = async (assessmentId) => {
    if (!assessmentId) {
      setQuestions([]);
      setCurrentAssessment(null);
      return;
    }

    try {
      setQuestionsLoading(true);
      setError(null);

      // Find assessment metadata
      const matched = assessments.find((a) => a._id === assessmentId);
      if (matched) {
        setCurrentAssessment(matched);
      } else {
        const fetchedAssessment = await adminService.getAssessmentById(assessmentId);
        setCurrentAssessment(fetchedAssessment);
      }

      // Fetch questions under this assessment
      const questionsData = await adminService.getQuestions(assessmentId);
      setQuestions(questionsData);
    } catch (err) {
      console.error('Failed to load questions for assessment:', err);
      setError(err.response?.data?.message || 'Failed to load questions for this assessment.');
    } finally {
      setQuestionsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAssessmentId) {
      fetchQuestionsForAssessment(selectedAssessmentId);
    }
  }, [selectedAssessmentId, assessments]);

  // Handle assessment dropdown change
  const handleAssessmentChange = (e) => {
    const newId = e.target.value;
    setSelectedAssessmentId(newId);
    setSearchParams({ assessmentId: newId });
  };

  // KPI / Summary
  const stats = useMemo(() => {
    const totalQuestions = questions.length;
    const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 0), 0);
    const topics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)));
    return { totalQuestions, totalMarks, topicCount: topics.length, topics };
  }, [questions]);

  // Open Create Question Modal
  const openCreateQuestionModal = () => {
    setIsEditing(false);
    setEditingQuestionId(null);
    setFormData({
      text: '',
      topic: '',
      difficulty: currentAssessment?.difficulty || 'intermediate',
      marks: 1,
      options: ['', '', '', ''], // Start with 4 convenient empty options
      correctOptionIndex: 0,
      explanation: '',
    });
    setFormError(null);
    setShowQuestionModal(true);
  };

  // Open Edit Question Modal
  const openEditQuestionModal = (question) => {
    setIsEditing(true);
    setEditingQuestionId(question._id);
    setFormData({
      text: question.text || '',
      topic: question.topic || '',
      difficulty: question.difficulty || 'intermediate',
      marks: question.marks || 1,
      options: Array.isArray(question.options) && question.options.length >= 2 ? [...question.options] : ['', ''],
      correctOptionIndex: question.correctOptionIndex ?? 0,
      explanation: question.explanation || '',
    });
    setFormError(null);
    setShowQuestionModal(true);
  };

  // Open Delete Question Modal
  const openDeleteQuestionModal = (question) => {
    setQuestionToDelete(question);
    setShowDeleteModal(true);
  };

  // Handle Option Text Change
  const handleOptionChange = (index, value) => {
    setFormData((prev) => {
      const newOptions = [...prev.options];
      newOptions[index] = value;
      return { ...prev, options: newOptions };
    });
  };

  // Add Option (max 6)
  const addOption = () => {
    if (formData.options.length >= 6) return;
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, ''],
    }));
  };

  // Remove Option (min 2)
  const removeOption = (indexToRemove) => {
    if (formData.options.length <= 2) return;
    setFormData((prev) => {
      const newOptions = prev.options.filter((_, idx) => idx !== indexToRemove);
      let newCorrectIndex = prev.correctOptionIndex;

      // Adjust correctOptionIndex if removed index was before or at current selection
      if (newCorrectIndex === indexToRemove) {
        newCorrectIndex = 0; // fallback to first option
      } else if (newCorrectIndex > indexToRemove) {
        newCorrectIndex = newCorrectIndex - 1;
      }

      return {
        ...prev,
        options: newOptions,
        correctOptionIndex: Math.min(newCorrectIndex, newOptions.length - 1),
      };
    });
  };

  // Submit Question (Create or Edit)
  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.text.trim()) {
      setFormError('Question prompt text is required.');
      return;
    }
    if (!formData.topic.trim()) {
      setFormError('Topic is required (e.g. React, Node.js, System Design).');
      return;
    }
    if (formData.options.length < 2) {
      setFormError('Question must have at least 2 options.');
      return;
    }

    // Check each option non-empty
    for (let i = 0; i < formData.options.length; i++) {
      if (!formData.options[i].trim()) {
        setFormError(`Option ${String.fromCharCode(65 + i)} cannot be empty.`);
        return;
      }
    }

    // Check correctOptionIndex in range
    if (formData.correctOptionIndex < 0 || formData.correctOptionIndex >= formData.options.length) {
      setFormError('Please select a valid correct answer option.');
      return;
    }

    if (!formData.marks || formData.marks < 1) {
      setFormError('Marks must be an integer of at least 1.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        text: formData.text.trim(),
        topic: formData.topic.trim(),
        difficulty: formData.difficulty,
        marks: Number(formData.marks),
        options: formData.options.map((opt) => opt.trim()),
        correctOptionIndex: Number(formData.correctOptionIndex),
        explanation: formData.explanation.trim(),
      };

      if (isEditing) {
        await adminService.updateQuestion(selectedAssessmentId, editingQuestionId, payload);
        setActionSuccess('Question updated successfully.');
        toast.success('Question updated successfully.');
      } else {
        await adminService.createQuestion(selectedAssessmentId, payload);
        setActionSuccess('Question created and added to assessment.');
        toast.success('Question created and added to assessment.');
      }

      setShowQuestionModal(false);
      fetchQuestionsForAssessment(selectedAssessmentId);
    } catch (err) {
      console.error('Question save failed:', err);
      const errMsg =
        err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to save question. Please check fields.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete Question
  const handleDeleteQuestionSubmit = async () => {
    if (!questionToDelete) return;

    try {
      setSubmitting(true);
      await adminService.deleteQuestion(selectedAssessmentId, questionToDelete._id);
      setActionSuccess('Question deleted successfully.');
      toast.success('Question deleted successfully.');
      setShowDeleteModal(false);
      setQuestionToDelete(null);
      fetchQuestionsForAssessment(selectedAssessmentId);
    } catch (err) {
      console.error('Delete question failed:', err);
      const errMsg = err.response?.data?.message || 'Failed to delete question.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-questions-page">
      {/* Navigation Breadcrumb & Back Link */}
      <div className="page-breadcrumb mb-3">
        <Link to="/admin/assessments" className="back-link">
          ← Back to Manage Assessments
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header flex-between">
        <div>
          <h2>Questions Bank Studio</h2>
          <p className="subtitle">
            Configure questions, configure answer keys, manage explanations, and tune difficulty ratings.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateQuestionModal}
          className="btn btn-primary"
          data-testid="add-question-btn"
          disabled={!selectedAssessmentId || loading}
        >
          + Add Question
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

      {/* Assessment Context Switcher Card */}
      <div className="assessment-context-panel card mb-4">
        <div className="context-row flex-between flex-wrap">
          <div className="context-selector-group">
            <label htmlFor="assessment-select" className="context-label">
              Active Assessment:
            </label>
            <select
              id="assessment-select"
              data-testid="assessment-switcher-select"
              className="form-control form-control-lg"
              value={selectedAssessmentId}
              onChange={handleAssessmentChange}
              disabled={loading || assessments.length === 0}
            >
              {assessments.length === 0 ? (
                <option value="">No assessments available</option>
              ) : (
                assessments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.title} ({a.difficulty?.toUpperCase()}) — {a.isPublished ? '● Published' : '○ Draft'}
                  </option>
                ))
              )}
            </select>
          </div>

          {currentAssessment && (
            <div className="context-badges flex-align">
              <span className={`badge badge-difficulty badge-${currentAssessment.difficulty}`}>
                {currentAssessment.difficulty?.toUpperCase()}
              </span>
              <span className="badge badge-info">⏱ {currentAssessment.durationMinutes} mins</span>
              <span className="badge badge-secondary">🎯 Passing: {currentAssessment.passingPercentage}%</span>
              <span className={`badge ${currentAssessment.isPublished ? 'badge-success' : 'badge-warning'}`}>
                {currentAssessment.isPublished ? 'Live Catalog' : 'Draft / Staging'}
              </span>
            </div>
          )}
        </div>

        {/* Assessment Statistics Strip */}
        {currentAssessment && (
          <div className="stats-strip mt-3 pt-3 border-top flex-wrap flex-between">
            <div className="stat-pill">
              <span className="stat-pill-label">Total Questions:</span>
              <strong className="stat-pill-val" data-testid="total-questions-stat">
                {stats.totalQuestions}
              </strong>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">Total Marks:</span>
              <strong className="stat-pill-val" data-testid="total-marks-stat">
                {stats.totalMarks} pts
              </strong>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">Topics Covered:</span>
              <strong className="stat-pill-val">{stats.topicCount} topics</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">Max Attempts:</span>
              <strong className="stat-pill-val">{currentAssessment.maxAttempts}x</strong>
            </div>
          </div>
        )}
      </div>

      {/* Questions List */}
      {questionsLoading ? (
        <div className="loading-container card text-center p-5">
          <div className="spinner"></div>
          <p className="mt-3 text-muted">Loading questions bank...</p>
        </div>
      ) : !selectedAssessmentId ? (
        <div className="empty-state card text-center p-5">
          <span className="empty-icon" style={{ fontSize: '3rem' }}>🔍</span>
          <h3>No Assessment Selected</h3>
          <p className="text-muted">Please select an assessment from the dropdown above to manage its questions.</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="empty-state card text-center p-5" data-testid="questions-empty-state">
          <span className="empty-icon" style={{ fontSize: '3rem' }}>❓</span>
          <h3>No Questions Added Yet</h3>
          <p className="text-muted">
            This assessment currently has no questions. Candidates cannot complete an assessment with 0 questions.
          </p>
          <button
            type="button"
            onClick={openCreateQuestionModal}
            className="btn btn-primary mt-3"
            data-testid="add-first-question-btn"
          >
            + Add First Question
          </button>
        </div>
      ) : (
        <div className="questions-list" data-testid="questions-list">
          {questions.map((q, qIndex) => (
            <div key={q._id} className="question-card card mb-3" data-testid={`question-card-${q._id}`}>
              {/* Question Header Strip */}
              <div className="question-card-header flex-between">
                <div className="question-meta flex-align">
                  <span className="question-num-pill">Q{qIndex + 1}</span>
                  <span className="badge badge-topic">{q.topic}</span>
                  <span className={`badge badge-difficulty badge-${q.difficulty}`}>
                    {q.difficulty?.toUpperCase()}
                  </span>
                  <span className="badge badge-marks">{q.marks} Mark{q.marks > 1 ? 's' : ''}</span>
                </div>

                <div className="question-actions btn-group">
                  <button
                    type="button"
                    onClick={() => openEditQuestionModal(q)}
                    className="btn btn-outline btn-xs"
                    data-testid={`edit-question-btn-${q._id}`}
                    title="Edit Question & Answer Key"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteQuestionModal(q)}
                    className="btn btn-outline-danger btn-xs"
                    data-testid={`delete-question-btn-${q._id}`}
                    title="Delete Question"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="question-text-body my-3">
                <h4 className="question-text">{q.text}</h4>
              </div>

              {/* Options Grid */}
              <div className="options-grid">
                {q.options.map((optionText, optIdx) => {
                  const isCorrect = optIdx === q.correctOptionIndex;
                  const optionLetter = String.fromCharCode(65 + optIdx);

                  return (
                    <div
                      key={optIdx}
                      className={`option-item ${isCorrect ? 'option-item-correct' : 'option-item-neutral'}`}
                      data-testid={`question-${q._id}-option-${optIdx}`}
                    >
                      <span className={`option-marker ${isCorrect ? 'marker-correct' : ''}`}>
                        {optionLetter}
                      </span>
                      <span className="option-content">{optionText}</span>
                      {isCorrect && (
                        <span className="badge badge-success correct-answer-tag" data-testid="correct-answer-badge">
                          ✓ Correct Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Admin-Only Explanation Box */}
              {q.explanation && (
                <div className="explanation-box mt-3 p-3 bg-light rounded" data-testid={`explanation-box-${q._id}`}>
                  <strong className="explanation-title text-muted">💡 Explanation / Marking Note:</strong>
                  <p className="explanation-text mb-0 mt-1">{q.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT QUESTION MODAL */}
      {showQuestionModal && (
        <div className="modal-overlay" data-testid="question-form-modal">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Question & Answer Key' : 'Add Question to Assessment'}</h3>
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="close-btn"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleQuestionSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger mb-3" role="alert">
                    {formError}
                  </div>
                )}

                {/* Question Text */}
                <div className="form-group mb-3">
                  <label htmlFor="question-text">Question Prompt *</label>
                  <textarea
                    id="question-text"
                    name="text"
                    className="form-control"
                    rows={3}
                    placeholder="Enter the complete question prompt..."
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    required
                  />
                </div>

                {/* Topic, Difficulty, Marks Row */}
                <div className="form-row">
                  <div className="form-group col-4 mb-3">
                    <label htmlFor="question-topic">Topic / Category *</label>
                    <input
                      type="text"
                      id="question-topic"
                      name="topic"
                      className="form-control"
                      placeholder="e.g. React, Node.js, Raft"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group col-4 mb-3">
                    <label htmlFor="question-difficulty">Difficulty Tier</label>
                    <select
                      id="question-difficulty"
                      name="difficulty"
                      className="form-control"
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="form-group col-4 mb-3">
                    <label htmlFor="question-marks">Marks / Weight *</label>
                    <input
                      type="number"
                      id="question-marks"
                      name="marks"
                      className="form-control"
                      min={1}
                      value={formData.marks}
                      onChange={(e) => setFormData({ ...formData, marks: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                {/* Options Builder with Correct Answer Radio Selector */}
                <div className="form-group mb-3">
                  <div className="flex-between flex-align mb-2">
                    <label className="font-weight-bold mb-0">
                      Answer Options (Select the radio button for the correct answer) *
                    </label>
                    <button
                      type="button"
                      onClick={addOption}
                      className="btn btn-outline btn-xs"
                      data-testid="add-option-btn"
                      disabled={formData.options.length >= 6}
                    >
                      + Add Option ({formData.options.length}/6)
                    </button>
                  </div>

                  <div className="options-builder-list">
                    {formData.options.map((optVal, optIdx) => {
                      const optLetter = String.fromCharCode(65 + optIdx);
                      const isChecked = formData.correctOptionIndex === optIdx;

                      return (
                        <div
                          key={optIdx}
                          className={`option-builder-row mb-2 p-2 rounded ${
                            isChecked ? 'border-success bg-success-subtle' : 'border'
                          }`}
                        >
                          <div className="flex-align flex-1">
                            {/* Radio button to designate correct answer */}
                            <label className="radio-label mb-0 mr-3 flex-align cursor-pointer">
                              <input
                                type="radio"
                                name="correctOptionSelector"
                                data-testid={`radio-correct-option-${optIdx}`}
                                checked={isChecked}
                                onChange={() => setFormData({ ...formData, correctOptionIndex: optIdx })}
                              />
                              <span className="ml-2 font-weight-bold">
                                Option {optLetter} {isChecked ? '(Correct)' : ''}
                              </span>
                            </label>

                            {/* Option Text Input */}
                            <input
                              type="text"
                              id={`option-input-${optIdx}`}
                              className="form-control flex-1"
                              placeholder={`Enter text for Option ${optLetter}...`}
                              value={optVal}
                              onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                              required
                            />
                          </div>

                          {/* Remove Option Button */}
                          {formData.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(optIdx)}
                              className="btn btn-outline-danger btn-xs ml-2"
                              title="Remove this option"
                            >
                              × Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <small className="form-text text-muted">
                    At least 2 options required. The radio selection marks the authoritative answer key for scoring.
                  </small>
                </div>

                {/* Explanation Field */}
                <div className="form-group mb-3">
                  <label htmlFor="question-explanation">Explanation / Scoring Rationale (Admin Reference)</label>
                  <textarea
                    id="question-explanation"
                    name="explanation"
                    className="form-control"
                    rows={2}
                    placeholder="Provide an explanation of why the selected answer is correct..."
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  />
                  <small className="form-text text-muted">
                    Zero-Leakage Guarantee: This explanation is never delivered to candidates during active attempts.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : isEditing ? 'Save Question Changes' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE QUESTION MODAL */}
      {showDeleteModal && questionToDelete && (
        <div className="modal-overlay" data-testid="delete-question-modal">
          <div className="modal-card modal-danger">
            <div className="modal-header">
              <h3>Delete Question</h3>
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
              <p>Are you sure you want to delete this question?</p>
              <div className="p-3 bg-light rounded text-muted mb-3 font-italic">
                "{questionToDelete.text}"
              </div>
              <p className="text-danger small mb-0">
                ⚠️ This question will be permanently removed from the assessment question bank.
              </p>
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
              <button
                type="button"
                onClick={handleDeleteQuestionSubmit}
                className="btn btn-danger"
                data-testid="modal-confirm-delete-question-btn"
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestionsPage;
