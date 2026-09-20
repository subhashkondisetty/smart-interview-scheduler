import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import assessmentService, { ClockIntegrityError } from '../../services/assessmentService';
import { useToast } from '../../context/ToastContext';

const TakeAssessmentPage = () => {
  const { id: assessmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Core Attempt & Test State
  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Security & Clock Integrity State
  const [clockIntegrityError, setClockIntegrityError] = useState(null);
  const [serverClockSkew, setServerClockSkew] = useState(0);

  // Attempt Lifecycle State
  const [attemptFinalized, setAttemptFinalized] = useState(null); // 'expired' | 'completed'
  const [finalizedReason, setFinalizedReason] = useState('');

  // Answering & Navigation State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: selectedOptionIndex }
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState(new Set());

  // Timer State
  const [remainingTimeMs, setRemainingTimeMs] = useState(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const hasTriggeredAutoSubmit = useRef(false);

  // Submission Modal & States
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  /**
   * 1. Mount & Authoritative Fetch Lifecycle:
   * Re-fetches authoritative status & expiresAt from backend before resuming any cached data.
   * Asserts HTTP Date header presence; fails loudly if missing.
   */
  useEffect(() => {
    let isMounted = true;

    const initializeArena = async () => {
      try {
        setLoading(true);
        setClockIntegrityError(null);

        const searchParams = new URLSearchParams(location.search);
        const targetAttemptId = searchParams.get('attemptId') || location.state?.attemptId;
        let authoritativeAttemptData;

        // Fetch or resume attempt authoritatively
        if (targetAttemptId) {
          authoritativeAttemptData = await assessmentService.getAttemptById(targetAttemptId);
        } else {
          authoritativeAttemptData = await assessmentService.startAssessmentAttempt(assessmentId);
        }

        if (!isMounted) return;

        const { attempt: authoritativeAttempt, clockSkew } = authoritativeAttemptData;
        setAttempt(authoritativeAttempt);
        setServerClockSkew(clockSkew);

        // Keep URL in sync with attemptId for seamless page reloads
        if (!searchParams.get('attemptId') && authoritativeAttempt?._id) {
          navigate(`?attemptId=${authoritativeAttempt._id}`, { replace: true });
        }

        // Verify Authoritative Status: If expired or completed server-side, HALT immediately
        if (authoritativeAttempt.status !== 'in_progress') {
          setAttemptFinalized(authoritativeAttempt.status);
          setFinalizedReason(
            authoritativeAttempt.status === 'expired'
              ? 'The time limit for this assessment attempt has expired.'
              : 'This assessment attempt has already been submitted and completed.'
          );
          setLoading(false);
          return;
        }

        // Check if time has already elapsed according to synchronized server clock
        const currentEstimatedServerTime = Date.now() + clockSkew;
        const initialRemainingMs = Math.max(
          0,
          new Date(authoritativeAttempt.expiresAt).getTime() - currentEstimatedServerTime
        );

        if (initialRemainingMs <= 0) {
          setAttemptFinalized('expired');
          setFinalizedReason('The time limit for this assessment attempt has expired.');
          setLoading(false);
          return;
        }

        setRemainingTimeMs(initialRemainingMs);

        // Extract target assessment ID whether populated as an object or raw ID string
        const targetAssessmentId =
          typeof authoritativeAttempt.assessmentId === 'object' && authoritativeAttempt.assessmentId !== null
            ? (authoritativeAttempt.assessmentId._id || authoritativeAttempt.assessmentId.id)
            : (authoritativeAttempt.assessmentId || assessmentId);

        // Fetch Assessment Info & Sanitized Questions
        const [assessmentData, questionsData] = await Promise.all([
          typeof authoritativeAttempt.assessmentId === 'object' && authoritativeAttempt.assessmentId?.title
            ? Promise.resolve(authoritativeAttempt.assessmentId)
            : assessmentService.getPublishedAssessmentById(targetAssessmentId),
          assessmentService.getCandidateQuestions(targetAssessmentId),
        ]);

        if (!isMounted) return;

        setAssessment(assessmentData);
        setQuestions(questionsData);

        // Restore candidate's previous selections from sessionStorage (scoped to this specific attempt)
        const storageKey = `assessment_answers_${authoritativeAttempt._id}`;
        const cachedAnswers = sessionStorage.getItem(storageKey);
        if (cachedAnswers) {
          try {
            const parsed = JSON.parse(cachedAnswers);
            if (parsed && typeof parsed === 'object') {
              setAnswers(parsed);
            }
          } catch (_) {}
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Arena initialization failed:', err);

        if (err instanceof ClockIntegrityError || err.isClockIntegrityError) {
          setClockIntegrityError(err.message);
        } else {
          const classified = assessmentService.classifyAssessmentError(err);
          setFinalizedReason(classified.message);
          setAttemptFinalized('error');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeArena();

    return () => {
      isMounted = false;
    };
  }, [assessmentId, location.state]);

  /**
   * 2. Per-Attempt Synchronized Countdown Timer:
   * Evaluates continuously against (Date.now() + serverClockSkew), preventing local clock tampering.
   */
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || attemptFinalized || loading || clockIntegrityError) {
      return;
    }

    const timerInterval = setInterval(() => {
      const currentEstimatedServerTime = Date.now() + serverClockSkew;
      const msLeft = Math.max(0, new Date(attempt.expiresAt).getTime() - currentEstimatedServerTime);
      setRemainingTimeMs(msLeft);

      // Auto-Submit when timer expires
      if (msLeft <= 0 && !hasTriggeredAutoSubmit.current && !isSubmitting && !isAutoSubmitting) {
        hasTriggeredAutoSubmit.current = true;
        clearInterval(timerInterval);
        handleAutoSubmitOnExpiry();
      }
    }, 500);

    return () => clearInterval(timerInterval);
  }, [attempt, serverClockSkew, attemptFinalized, loading, clockIntegrityError, isSubmitting, isAutoSubmitting]);

  // Format Milliseconds into HH:MM:SS or MM:SS
  const formatTimeLeft = (ms) => {
    if (ms === null || ms === undefined || ms < 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  // Timer Urgency Class
  const timerClass = useMemo(() => {
    if (remainingTimeMs === null) return 'timer-normal';
    const minutesLeft = remainingTimeMs / 60000;
    if (minutesLeft <= 1) return 'timer-danger pulse';
    if (minutesLeft <= 5) return 'timer-warning';
    return 'timer-normal';
  }, [remainingTimeMs]);

  /**
   * 3. Answering Operations & Storage Persistence
   */
  const handleSelectOption = (questionId, optionIndex) => {
    if (attemptFinalized || isSubmitting || isAutoSubmitting) return;

    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionIndex };
      if (attempt?._id) {
        sessionStorage.setItem(`assessment_answers_${attempt._id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleClearOption = (questionId) => {
    if (attemptFinalized || isSubmitting || isAutoSubmitting) return;

    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      if (attempt?._id) {
        sessionStorage.setItem(`assessment_answers_${attempt._id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleToggleFlag = (questionId) => {
    setFlaggedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  /**
   * 4. Auto-Submit on Expiry
   */
  const handleAutoSubmitOnExpiry = async () => {
    if (!attempt) return;
    try {
      setIsAutoSubmitting(true);
      setSubmitError(null);

      // Build payload matching backend expected format
      const formattedAnswers = questions.map((q) => ({
        questionId: q._id,
        selectedOptionIndex: answers[q._id] !== undefined ? answers[q._id] : null,
      }));

      await assessmentService.submitAssessmentAttempt(attempt._id, formattedAnswers);

      // Clear session cache upon successful finalization
      sessionStorage.removeItem(`assessment_answers_${attempt._id}`);

      toast.warning('Time expired! Your assessment was automatically submitted.');

      navigate(`/candidate/attempts/${attempt._id}/result`, {
        state: { autoSubmitted: true, message: 'Time expired! Your assessment was automatically submitted.' },
      });
    } catch (err) {
      console.warn('Auto-submit handled boundary condition:', err.message);
      // If backend rejected because it already expired via finalizeExpiredAttempt, navigate to result anyway
      sessionStorage.removeItem(`assessment_answers_${attempt._id}`);
      toast.warning('Your assessment session has elapsed and been finalized.');
      navigate(`/candidate/attempts/${attempt._id}/result`, {
        state: { autoSubmitted: true, message: 'Your assessment session has elapsed and been finalized.' },
      });
    } finally {
      setIsAutoSubmitting(false);
    }
  };

  /**
   * 5. Manual Submission Flow
   */
  const handleManualSubmit = async () => {
    if (!attempt || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const formattedAnswers = questions.map((q) => ({
        questionId: q._id,
        selectedOptionIndex: answers[q._id] !== undefined ? answers[q._id] : null,
      }));

      await assessmentService.submitAssessmentAttempt(attempt._id, formattedAnswers);

      sessionStorage.removeItem(`assessment_answers_${attempt._id}`);
      setShowSubmitModal(false);

      toast.success('Assessment submitted successfully!');

      navigate(`/candidate/attempts/${attempt._id}/result`, {
        state: { manualSubmitted: true },
      });
    } catch (err) {
      console.error('Manual submission failed:', err);
      const classified = assessmentService.classifyAssessmentError(err);
      setSubmitError(classified.message);
      setIsSubmitting(false);
    }
  };

  // Question Metrics
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const flaggedCount = flaggedQuestionIds.size;

  // View: Fail-Loud Clock Integrity Alert
  if (clockIntegrityError) {
    return (
      <div className="page-container" data-testid="arena-clock-integrity-error">
        <div className="security-alert-card">
          <span className="security-icon">🛡️</span>
          <h2>Clock Synchronization Failure</h2>
          <p className="security-message">{clockIntegrityError}</p>
          <div className="security-details">
            <p>
              To protect test integrity and ensure tamper-proof timing, assessments require authoritative
              server clock verification via the HTTP <code>Date</code> header.
            </p>
          </div>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/candidate/assessments')}>
            Return to Assessments
          </button>
        </div>
      </div>
    );
  }

  // View: Attempt Finalized / Expired (Stale Reload Rejection)
  if (attemptFinalized) {
    return (
      <div className="page-container" data-testid="arena-attempt-finalized">
        <div className="empty-state-card finalized-card">
          <span className="empty-icon">{attemptFinalized === 'expired' ? '⏳' : '✓'}</span>
          <h2>Assessment Attempt Finalized</h2>
          <p className="finalized-desc">
            {finalizedReason || 'This assessment attempt is no longer active.'}
          </p>
          <div className="card-actions-row mt-4">
            {attempt?._id && (
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/candidate/attempts/${attempt._id}/result`)}
                data-testid="btn-view-attempt-result"
              >
                View Finalized Result
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/candidate/assessments')}
              data-testid="btn-return-to-assessments"
            >
              Back to Assessments Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View: Loading State
  if (loading) {
    return (
      <div className="page-container loading-container" data-testid="arena-loading">
        <div className="spinner"></div>
        <p>Connecting to secure assessment arena and verifying clock synchronization...</p>
      </div>
    );
  }

  // View: No Questions Found
  if (!currentQuestion) {
    return (
      <div className="page-container">
        <div className="empty-state-card">
          <span className="empty-icon">⚠️</span>
          <h3>No Questions Available</h3>
          <p>This assessment currently does not contain published questions.</p>
          <button className="btn btn-secondary mt-3" onClick={() => navigate('/candidate/assessments')}>
            Return to Assessments
          </button>
        </div>
      </div>
    );
  }

  const isCurrentAnswered = answers[currentQuestion._id] !== undefined;
  const isCurrentFlagged = flaggedQuestionIds.has(currentQuestion._id);

  return (
    <div className="page-container arena-page" data-testid="take-assessment-page">
      {/* Auto-Submit Notification Overlay */}
      {isAutoSubmitting && (
        <div className="auto-submit-banner" data-testid="auto-submitting-banner">
          <span className="spinner-inline"></span>
          <span>Time expired! Automatically submitting your assessment to server...</span>
        </div>
      )}

      {/* Arena Top Control Bar */}
      <div className="arena-topbar" data-testid="arena-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="btn btn-link btn-exit"
            onClick={() => setShowSubmitModal(true)}
            data-testid="btn-topbar-exit"
          >
            ← Exit & Submit
          </button>
          <div className="arena-title-group">
            <h3 className="arena-title" data-testid="arena-assessment-title">
              {assessment?.title || 'Assessment Arena'}
            </h3>
            <span className="badge badge-attempt-number" data-testid="arena-attempt-badge">
              Attempt #{attempt?.attemptNumber || 1}
            </span>
          </div>
        </div>

        {/* Server Clock Reconciled Countdown Timer */}
        <div className="topbar-right">
          <div className={`countdown-timer-box ${timerClass}`} data-testid="countdown-timer">
            <span className="timer-icon">⏱️</span>
            <div className="timer-details">
              <span className="timer-label">TIME REMAINING</span>
              <span className="timer-digits" data-testid="timer-digits">
                {formatTimeLeft(remainingTimeMs)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-success btn-topbar-submit"
            onClick={() => setShowSubmitModal(true)}
            disabled={isSubmitting || isAutoSubmitting}
            data-testid="btn-arena-submit"
          >
            Submit Assessment
          </button>
        </div>
      </div>

      {/* Main Arena Layout: Question Area + Palette Sidebar */}
      <div className="arena-layout">
        {/* Left / Center: Active Question Workspace */}
        <div className="arena-main-content">
          <div className="question-card" data-testid={`question-card-${currentQuestion._id}`}>
            {/* Question Header */}
            <div className="question-header">
              <div className="question-meta-row">
                <span className="question-counter" data-testid="question-counter">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <div className="badges-group">
                  <span className="badge badge-marks">{currentQuestion.marks} Marks</span>
                  {currentQuestion.topic && (
                    <span className="badge badge-topic">{currentQuestion.topic}</span>
                  )}
                  {isCurrentFlagged && (
                    <span className="badge badge-flagged" data-testid="badge-current-flagged">
                      🚩 Flagged for Review
                    </span>
                  )}
                </div>
              </div>

              <div className="question-actions-top">
                <button
                  type="button"
                  className={`btn btn-small ${isCurrentFlagged ? 'btn-flagged-active' : 'btn-outline'}`}
                  onClick={() => handleToggleFlag(currentQuestion._id)}
                  data-testid="btn-toggle-flag"
                >
                  {isCurrentFlagged ? '🚩 Flagged' : '🏳️ Flag for Review'}
                </button>
                {isCurrentAnswered && (
                  <button
                    type="button"
                    className="btn btn-small btn-link text-danger"
                    onClick={() => handleClearOption(currentQuestion._id)}
                    data-testid="btn-clear-choice"
                  >
                    Clear Choice
                  </button>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="question-text" data-testid="question-text">
              {currentQuestion.text}
            </div>

            {/* Multiple Choice Options */}
            <div className="options-list" data-testid="options-list">
              {currentQuestion.options?.map((optionText, optIndex) => {
                const isSelected = answers[currentQuestion._id] === optIndex;
                const letter = String.fromCharCode(65 + optIndex); // A, B, C, D

                return (
                  <div
                    key={optIndex}
                    className={`option-card ${isSelected ? 'option-selected' : ''}`}
                    onClick={() => handleSelectOption(currentQuestion._id, optIndex)}
                    data-testid={`option-item-${optIndex}`}
                  >
                    <div className="option-radio-wrapper">
                      <input
                        type="radio"
                        id={`q-${currentQuestion._id}-opt-${optIndex}`}
                        name={`question-${currentQuestion._id}`}
                        checked={isSelected}
                        onChange={() => handleSelectOption(currentQuestion._id, optIndex)}
                        className="option-radio"
                      />
                      <span className="option-letter">{letter}</span>
                    </div>
                    <label
                      htmlFor={`q-${currentQuestion._id}-opt-${optIndex}`}
                      className="option-label"
                    >
                      {optionText}
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Question Card Bottom Navigation Bar */}
            <div className="question-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                data-testid="btn-prev-question"
              >
                ← Previous
              </button>

              <div className="footer-status-text">
                {isCurrentAnswered ? (
                  <span className="text-success">✓ Answer Recorded</span>
                ) : (
                  <span className="text-muted">Unanswered</span>
                )}
              </div>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  data-testid="btn-next-question"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => setShowSubmitModal(true)}
                  data-testid="btn-finish-review"
                >
                  Review & Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Interactive Question Palette */}
        <div className="arena-sidebar" data-testid="arena-palette-sidebar">
          <div className="palette-card">
            <h4>Question Palette</h4>

            {/* Tally Summary Strip */}
            <div className="palette-summary" data-testid="palette-summary">
              <div className="tally-item">
                <span className="tally-dot dot-answered"></span>
                <span>{answeredCount} Answered</span>
              </div>
              <div className="tally-item">
                <span className="tally-dot dot-flagged"></span>
                <span>{flaggedCount} Flagged</span>
              </div>
              <div className="tally-item">
                <span className="tally-dot dot-unanswered"></span>
                <span>{unansweredCount} Unanswered</span>
              </div>
            </div>

            {/* Interactive Grid of Questions */}
            <div className="palette-grid" data-testid="palette-grid">
              {questions.map((q, idx) => {
                const isAnswered = answers[q._id] !== undefined;
                const isFlagged = flaggedQuestionIds.has(q._id);
                const isCurrent = idx === currentQuestionIndex;

                let stateClass = 'palette-unanswered';
                if (isAnswered) stateClass = 'palette-answered';
                if (isFlagged) stateClass = 'palette-flagged';
                if (isCurrent) stateClass += ' palette-current';

                return (
                  <button
                    key={q._id}
                    type="button"
                    className={`palette-btn ${stateClass}`}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    data-testid={`palette-btn-${idx + 1}`}
                    title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}${isFlagged ? ' (Flagged)' : ''}`}
                  >
                    <span className="palette-num">{idx + 1}</span>
                    {isFlagged && <span className="palette-flag-icon">🚩</span>}
                  </button>
                );
              })}
            </div>

            <div className="palette-footer mt-4">
              <button
                type="button"
                className="btn btn-block btn-success"
                onClick={() => setShowSubmitModal(true)}
                data-testid="btn-palette-submit"
              >
                Submit Assessment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="modal-backdrop" data-testid="submit-confirmation-modal">
          <div className="modal-card submit-modal">
            <div className="modal-header">
              <h3>Confirm Assessment Submission</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {submitError && (
                <div className="alert alert-error mb-3" data-testid="submit-error-alert">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-content">
                    <p>{submitError}</p>
                  </div>
                </div>
              )}

              <p className="modal-lead">
                Are you sure you want to finalize and submit your assessment answers?
              </p>

              {/* Summary Stats */}
              <div className="submit-stats-grid">
                <div className="submit-stat-card">
                  <span className="stat-label">Total Questions</span>
                  <span className="stat-value">{totalQuestions}</span>
                </div>
                <div className="submit-stat-card text-success">
                  <span className="stat-label">Answered</span>
                  <span className="stat-value">{answeredCount}</span>
                </div>
                <div className="submit-stat-card text-warning">
                  <span className="stat-label">Unanswered</span>
                  <span className="stat-value">{unansweredCount}</span>
                </div>
                <div className="submit-stat-card text-purple">
                  <span className="stat-label">Flagged</span>
                  <span className="stat-value">{flaggedCount}</span>
                </div>
              </div>

              {unansweredCount > 0 && (
                <div className="alert alert-warning mt-3" data-testid="unanswered-warning">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-content">
                    <p>
                      <strong>Notice:</strong> You have <strong>{unansweredCount}</strong> unanswered question(s).
                      Any unanswered questions will receive 0 marks.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                data-testid="btn-cancel-submit"
              >
                Return to Test
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                data-testid="btn-confirm-submit"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-inline"></span> Scoring Answers...
                  </>
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeAssessmentPage;
