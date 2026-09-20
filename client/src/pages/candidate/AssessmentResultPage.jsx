import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import assessmentService from '../../services/assessmentService';

const AssessmentResultPage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Flash banner message passed from previous navigation (e.g., auto-submit or manual submit)
  const flashMessage = location.state?.message;

  useEffect(() => {
    let isMounted = true;

    const fetchResult = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await assessmentService.getAttemptResult(attemptId);
        if (isMounted) {
          setResult(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load attempt result:', err);
          const classified = assessmentService.classifyAssessmentError(err);
          setError(classified.message || 'Unable to load assessment result.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (attemptId) {
      fetchResult();
    } else {
      setError('No attempt ID provided.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <div className="page-container" data-testid="loading-state">
        <div className="loading-spinner-container">
          <div className="spinner"></div>
          <p>Evaluating & calculating assessment results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="page-container" data-testid="error-state">
        <div className="error-card">
          <h3>Unable to Load Results</h3>
          <p>{error || 'The requested assessment result could not be found.'}</p>
          <div className="card-actions">
            <button onClick={() => window.location.reload()} className="btn btn-secondary">
              Retry
            </button>
            <Link to="/candidate/history" className="btn btn-primary">
              Return to Analytics & History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const assessment = result.assessment || {};
  const isExpired = result.status === 'expired';
  const isPassed = Boolean(result.passed);
  const passingPct = assessment.passingPercentage ?? 60;

  return (
    <div className="page-container assessment-result-page" data-testid="result-container">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb-nav">
        <Link to="/candidate/assessments">Assessments</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/candidate/history">Analytics & History</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Attempt #{result.attemptNumber} Result</span>
      </nav>

      {/* Flash Submission Message (if arrived from submit/expiry redirect) */}
      {flashMessage && (
        <div className="alert alert-info result-flash-banner" data-testid="result-flash-banner">
          <span className="alert-icon">ℹ️</span>
          <span>{flashMessage}</span>
        </div>
      )}

      {/* Hero Result Banner */}
      <div
        className={`result-hero ${isPassed ? 'hero-passed' : isExpired ? 'hero-expired' : 'hero-failed'}`}
        data-testid="result-hero-banner"
      >
        <div className="result-hero-content">
          <div className="result-badge-row">
            {isPassed ? (
              <span className="badge badge-success badge-lg" data-testid="result-status-badge">
                ✓ Assessment Passed
              </span>
            ) : isExpired ? (
              <span className="badge badge-warning badge-lg" data-testid="result-status-badge">
                ⏳ Attempt Expired
              </span>
            ) : (
              <span className="badge badge-danger badge-lg" data-testid="result-status-badge">
                ✕ Assessment Not Passed
              </span>
            )}
            <span className="badge badge-outline">Attempt #{result.attemptNumber}</span>
            {assessment.difficulty && (
              <span className={`badge badge-difficulty badge-${assessment.difficulty.toLowerCase()}`}>
                {assessment.difficulty}
              </span>
            )}
          </div>

          <h1 className="result-title">
            {isPassed
              ? 'Congratulations! You Passed!'
              : isExpired
              ? 'Assessment Expired'
              : 'Assessment Not Passed'}
          </h1>
          <p className="result-subtitle">
            {assessment.title || 'Technical Assessment'}
            {isExpired && ' — Finalized automatically when the timer elapsed.'}
          </p>

          <div className="result-score-highlight">
            <div className="percentage-circle">
              <span className="percentage-number" data-testid="result-percentage">
                {result.percentage}%
              </span>
              <span className="percentage-label">Final Score</span>
            </div>
            <div className="score-details-box">
              <div className="score-main-value" data-testid="result-score">
                {result.score} <span className="score-divider">/</span> {result.totalMarks}
                <span className="score-units"> marks</span>
              </div>
              <div className="score-threshold-note">
                Passing requirement: <strong>{passingPct}%</strong> (
                {Math.ceil((passingPct / 100) * (result.totalMarks || 1))} marks needed)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Metrics Grid */}
      <section className="result-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon metric-icon-green">✓</div>
          <div className="metric-info">
            <span className="metric-label">Correct Answers</span>
            <span className="metric-value" data-testid="metric-correct-count">
              {result.correctCount} / {result.totalQuestions}
            </span>
            <span className="metric-subtext">
              {result.totalQuestions > 0
                ? `${Math.round((result.correctCount / result.totalQuestions) * 100)}% question accuracy`
                : '0% accuracy'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-icon-red">✕</div>
          <div className="metric-info">
            <span className="metric-label">Incorrect Answers</span>
            <span className="metric-value" data-testid="metric-incorrect-count">
              {result.incorrectCount}
            </span>
            <span className="metric-subtext">Questions answered incorrectly</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-icon-amber">⚪</div>
          <div className="metric-info">
            <span className="metric-label">Unanswered</span>
            <span className="metric-value" data-testid="metric-unanswered-count">
              {result.unansweredCount}
            </span>
            <span className="metric-subtext">Skipped or unreached</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-icon-blue">⏱️</div>
          <div className="metric-info">
            <span className="metric-label">Time Taken</span>
            <span className="metric-value" data-testid="metric-time-taken">
              {result.timeTakenMinutes} mins
            </span>
            <span className="metric-subtext">
              Allocated: {assessment.durationMinutes || 'N/A'} mins
            </span>
          </div>
        </div>
      </section>

      {/* Topic-Wise Breakdown Section */}
      {Array.isArray(result.topicBreakdown) && result.topicBreakdown.length > 0 && (
        <section className="result-section topic-breakdown-section">
          <div className="section-header">
            <h2>Topic-Wise Performance Breakdown</h2>
            <p className="section-desc">
              Your accuracy and score across distinct technical skill domains evaluated in this assessment.
            </p>
          </div>

          <div className="topic-cards-grid">
            {result.topicBreakdown.map((topicItem, index) => {
              const accuracy = topicItem.percentage ?? 0;
              const masteryLevel =
                accuracy >= 80 ? 'Strong' : accuracy >= 60 ? 'Proficient' : 'Needs Practice';
              const badgeClass =
                accuracy >= 80
                  ? 'badge-success'
                  : accuracy >= 60
                  ? 'badge-info'
                  : 'badge-warning';

              return (
                <div key={index} className="topic-result-card" data-testid="topic-breakdown-card">
                  <div className="topic-card-header">
                    <h3 className="topic-title">{topicItem.topic || 'General'}</h3>
                    <span className={`badge ${badgeClass}`}>{masteryLevel}</span>
                  </div>

                  <div className="topic-progress-container">
                    <div className="topic-progress-bar-bg">
                      <div
                        className={`topic-progress-bar-fill ${badgeClass}`}
                        style={{ width: `${Math.min(100, Math.max(0, accuracy))}%` }}
                      ></div>
                    </div>
                    <div className="topic-progress-labels">
                      <span className="topic-accuracy-pct">{accuracy}%</span>
                      <span className="topic-marks">
                        {topicItem.score} / {topicItem.totalMarks} marks
                      </span>
                    </div>
                  </div>

                  <div className="topic-card-footer">
                    <span>
                      {topicItem.correctCount} of {topicItem.totalQuestions} questions correct
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Question-by-Question Evaluation List */}
      {Array.isArray(result.answers) && result.answers.length > 0 && (
        <section className="result-section question-review-section">
          <div className="section-header">
            <h2>Question-by-Question Outcome</h2>
            <p className="section-desc">
              Summary of evaluated answers and marks awarded.
            </p>
          </div>

          <div className="question-outcomes-table-container">
            <table className="question-outcomes-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Topic</th>
                  <th>Outcome</th>
                  <th>Marks Awarded</th>
                </tr>
              </thead>
              <tbody>
                {result.answers.map((answer, idx) => {
                  const isAnswerCorrect = Boolean(answer.isCorrect);
                  const isUnanswered = answer.selectedOptionIndex === null || answer.selectedOptionIndex === undefined;

                  return (
                    <tr key={idx} className="question-outcome-row" data-testid="question-outcome-row">
                      <td className="col-idx">Q{idx + 1}</td>
                      <td className="col-topic">{answer.topic || 'General'}</td>
                      <td className="col-outcome">
                        {isAnswerCorrect ? (
                          <span className="badge badge-success">✓ Correct</span>
                        ) : isUnanswered ? (
                          <span className="badge badge-neutral">⚪ Unanswered</span>
                        ) : (
                          <span className="badge badge-danger">✕ Incorrect</span>
                        )}
                      </td>
                      <td className="col-marks">
                        {isAnswerCorrect ? (
                          <strong className="marks-positive">+{answer.marksAwarded}</strong>
                        ) : (
                          <span className="marks-zero">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Navigation & Action Buttons */}
      <div className="result-actions-strip">
        <Link
          to="/candidate/history"
          className="btn btn-primary btn-lg"
          data-testid="btn-view-history"
        >
          View Full Attempt History & Analytics →
        </Link>
        <Link
          to="/candidate/assessments"
          className="btn btn-secondary btn-lg"
          data-testid="btn-back-to-assessments"
        >
          Browse All Assessments
        </Link>
      </div>
    </div>
  );
};

export default AssessmentResultPage;
