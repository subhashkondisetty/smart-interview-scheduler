import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import assessmentService from '../../services/assessmentService';

const CandidateAssessmentsPage = () => {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [candidateAttempts, setCandidateAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  // Modal State
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchAssessmentData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [publishedAssessments, attempts] = await Promise.all([
        assessmentService.getPublishedAssessments(),
        assessmentService.getCandidateAttempts(),
      ]);

      setAssessments(publishedAssessments);
      setCandidateAttempts(attempts);
    } catch (err) {
      console.error('Failed to load assessments:', err);
      setError('Unable to load available assessments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessmentData();
  }, []);

  // Map assessment ID to attempts metadata (attempts count, active attempt)
  const assessmentAttemptMap = useMemo(() => {
    const map = {};
    for (const attempt of candidateAttempts) {
      const aId = typeof attempt.assessmentId === 'object' ? attempt.assessmentId._id : attempt.assessmentId;
      if (!aId) continue;

      if (!map[aId]) {
        map[aId] = {
          totalCount: 0,
          activeAttempt: null,
          hasPassed: false,
        };
      }

      map[aId].totalCount += 1;

      if (attempt.status === 'in_progress') {
        const isStillValid = new Date(attempt.expiresAt) > new Date();
        if (isStillValid) {
          map[aId].activeAttempt = attempt;
        }
      }

      if (attempt.passed) {
        map[aId].hasPassed = true;
      }
    }
    return map;
  }, [candidateAttempts]);

  // Filtered assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter((item) => {
      // Difficulty match
      if (selectedDifficulty !== 'all' && item.difficulty !== selectedDifficulty) {
        return false;
      }
      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchDesc = item.description?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [assessments, selectedDifficulty, searchQuery]);

  const handleOpenDetails = (assessment) => {
    setSelectedAssessment(assessment);
    setModalError(null);
  };

  const handleCloseModal = () => {
    if (isStarting) return;
    setSelectedAssessment(null);
    setModalError(null);
  };

  const handleStartOrResume = async (assessmentId) => {
    try {
      setIsStarting(true);
      setModalError(null);

      const { attempt } = await assessmentService.startAssessmentAttempt(assessmentId);
      navigate(`/candidate/assessments/${assessmentId}/take?attemptId=${attempt._id}`, {
        state: { attemptId: attempt._id },
      });
    } catch (err) {
      console.error('Failed to start assessment:', err);
      const classified = assessmentService.classifyAssessmentError(err);
      setModalError(classified.message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="page-container" data-testid="candidate-assessments-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-text">
          <h2>Skill Assessments Arena</h2>
          <p className="subtitle">
            Validate your technical proficiency with timed, auto-scored mock assessments.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-card">
        <div className="filter-group">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by assessment title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-assessment-search"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="pill-filters" data-testid="difficulty-filter-group">
            {['all', 'beginner', 'intermediate', 'advanced'].map((diff) => (
              <button
                key={diff}
                type="button"
                className={`pill-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty(diff)}
                data-testid={`filter-difficulty-${diff}`}
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="loading-state" data-testid="assessments-loading">
          <div className="spinner"></div>
          <p>Loading available skill assessments...</p>
        </div>
      ) : error ? (
        <div className="alert alert-error" data-testid="assessments-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <p>{error}</p>
            <button className="btn btn-small btn-secondary mt-2" onClick={fetchAssessmentData}>
              Try Again
            </button>
          </div>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="empty-state-card" data-testid="no-assessments-found">
          <span className="empty-icon">📝</span>
          <h3>No Assessments Found</h3>
          <p>
            {searchQuery || selectedDifficulty !== 'all'
              ? 'No published assessments match your current filters. Try adjusting your search query.'
              : 'There are currently no published assessments available.'}
          </p>
          {(searchQuery || selectedDifficulty !== 'all') && (
            <button
              className="btn btn-secondary mt-3"
              onClick={() => {
                setSearchQuery('');
                setSelectedDifficulty('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="assessment-grid" data-testid="assessment-grid">
          {filteredAssessments.map((item) => {
            const meta = assessmentAttemptMap[item._id] || { totalCount: 0, activeAttempt: null, hasPassed: false };
            const attemptsUsed = meta.totalCount;
            const maxAttempts = item.maxAttempts || 3;
            const hasActiveAttempt = Boolean(meta.activeAttempt);
            const isExhausted = !hasActiveAttempt && attemptsUsed >= maxAttempts;

            return (
              <div
                key={item._id}
                className={`assessment-card ${hasActiveAttempt ? 'card-active-attempt' : ''}`}
                data-testid={`assessment-card-${item._id}`}
              >
                {/* Card Top Row */}
                <div className="assessment-card-header">
                  <div className="badges-row">
                    <span className={`badge badge-difficulty badge-${item.difficulty}`}>
                      {item.difficulty?.toUpperCase()}
                    </span>
                    {hasActiveAttempt && (
                      <span className="badge badge-in-progress" data-testid={`badge-active-${item._id}`}>
                        ⚡ In Progress
                      </span>
                    )}
                    {meta.hasPassed && (
                      <span className="badge badge-passed">
                        ✓ Passed
                      </span>
                    )}
                  </div>
                  <span className="attempt-quota" data-testid={`quota-${item._id}`}>
                    {attemptsUsed} / {maxAttempts} attempts
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="assessment-title" data-testid={`title-${item._id}`}>
                  {item.title}
                </h3>
                <p className="assessment-description" data-testid={`desc-${item._id}`}>
                  {item.description || 'No detailed description provided.'}
                </p>

                {/* Specs Strip */}
                <div className="assessment-specs">
                  <div className="spec-item">
                    <span className="spec-icon">⏱️</span>
                    <span className="spec-text">{item.durationMinutes} mins</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-icon">🎯</span>
                    <span className="spec-text">{item.passingPercentage}% to pass</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-icon">📊</span>
                    <span className="spec-text">Max {maxAttempts} tries</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="assessment-card-footer">
                  {hasActiveAttempt ? (
                    <button
                      className="btn btn-primary btn-block btn-resume"
                      onClick={() => handleStartOrResume(item._id)}
                      data-testid={`btn-resume-${item._id}`}
                    >
                      ⚡ Resume In-Progress Attempt
                    </button>
                  ) : isExhausted ? (
                    <button
                      className="btn btn-secondary btn-block btn-disabled"
                      disabled
                      data-testid={`btn-exhausted-${item._id}`}
                    >
                      ✕ Max Attempts Reached
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => handleOpenDetails(item)}
                      data-testid={`btn-start-${item._id}`}
                    >
                      View Details & Start
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details & Launch Modal */}
      {selectedAssessment && (
        <div className="modal-backdrop" data-testid="assessment-details-modal">
          <div className="modal-card assessment-modal">
            <div className="modal-header">
              <div>
                <span className={`badge badge-difficulty badge-${selectedAssessment.difficulty}`}>
                  {selectedAssessment.difficulty?.toUpperCase()}
                </span>
                <h3 className="mt-2" data-testid="modal-assessment-title">{selectedAssessment.title}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={isStarting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalError && (
                <div className="alert alert-error mb-3" data-testid="modal-error-alert">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-content">
                    <p>{modalError}</p>
                  </div>
                </div>
              )}

              <div className="modal-section">
                <h4>About this Assessment</h4>
                <p className="modal-desc">
                  {selectedAssessment.description || 'Comprehensive evaluation of technical domain fundamentals.'}
                </p>
              </div>

              {/* Assessment Parameters Grid */}
              <div className="modal-specs-grid">
                <div className="modal-spec-card">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">{selectedAssessment.durationMinutes} Minutes</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Passing Score</span>
                  <span className="spec-value">{selectedAssessment.passingPercentage}%</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Attempt Quota</span>
                  <span className="spec-value">
                    {(assessmentAttemptMap[selectedAssessment._id]?.totalCount || 0) + 1} of {selectedAssessment.maxAttempts}
                  </span>
                </div>
              </div>

              {/* Integrity Guidelines */}
              <div className="modal-guidelines">
                <h4>Assessment Rules & Integrity Guidelines:</h4>
                <ul>
                  <li>
                    <strong>Continuous Timer:</strong> Once started, your {selectedAssessment.durationMinutes}-minute timer begins immediately and cannot be paused.
                  </li>
                  <li>
                    <strong>Clock Synchronization:</strong> Countdown is continuously validated against the server clock to preserve test integrity.
                  </li>
                  <li>
                    <strong>Auto-Submission:</strong> Your selected answers will be automatically submitted if the timer expires.
                  </li>
                  <li>
                    <strong>Server-Side Evaluation:</strong> Answers are evaluated strictly server-side with instant score breakdown upon submission.
                  </li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseModal}
                disabled={isStarting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleStartOrResume(selectedAssessment._id)}
                disabled={isStarting}
                data-testid="btn-confirm-start-assessment"
              >
                {isStarting ? (
                  <>
                    <span className="spinner-inline"></span> Initializing Arena...
                  </>
                ) : (
                  `🚀 Start Assessment (${selectedAssessment.durationMinutes}m)`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateAssessmentsPage;
