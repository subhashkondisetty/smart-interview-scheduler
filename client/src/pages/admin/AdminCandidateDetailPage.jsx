import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminCandidateDetailPage = () => {
  const { id } = useParams();
  const toast = useToast();

  const [candidateData, setCandidateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);

  const fetchCandidateDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getCandidateById(id);
      setCandidateData(data);
    } catch (err) {
      console.error('Failed to load candidate details:', err);
      setError(err.response?.data?.message || 'Candidate record not found or inaccessible.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCandidateDetails();
  }, [fetchCandidateDetails]);

  const handleToggleStatus = async () => {
    if (!candidateData?.candidate) return;

    setActionLoading(true);
    const targetStatus = !candidateData.candidate.isActive;
    const actionLabel = targetStatus ? 'enabled' : 'deactivated';

    try {
      await adminService.updateCandidateStatus(id, targetStatus);
      toast.success(
        `Candidate account for ${candidateData.candidate.email} has been ${actionLabel}.`
      );
      setShowStatusModal(false);
      fetchCandidateDetails();
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error(
        err.response?.data?.message || `Failed to ${targetStatus ? 'enable' : 'deactivate'} candidate.`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!id) return;
    try {
      setDownloadingResume(true);
      const resumeDoc = candidateData?.candidate?.profile?.resume || {};
      await adminService.downloadCandidateResume(id, resumeDoc.originalName || 'resume.pdf');
      toast.success('Resume downloaded successfully.');
    } catch (err) {
      console.error('Failed to download resume:', err);
      toast.error(err.response?.data?.message || 'Failed to download candidate resume.');
    } finally {
      setDownloadingResume(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="candidates-loading-state" data-testid="candidate-detail-loading">
          <div className="spinner"></div>
          <p>Retrieving 360-degree candidate profile from backend...</p>
        </div>
      </div>
    );
  }

  if (error || !candidateData) {
    return (
      <div className="page-container">
        <div className="alert alert-danger" data-testid="candidate-detail-error">
          <h4>Candidate Record Error</h4>
          <p>{error || 'Unable to display candidate information.'}</p>
          <div className="mt-3">
            <Link to="/admin/candidates" className="btn btn-primary btn-sm">
              ← Return to Candidates List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { candidate, bookings = [], attempts = [], stats = {} } = candidateData;
  const profile = candidate.profile || {};
  const displayName = profile.fullName || 'Unprofiled Candidate';
  const headline = profile.headline || 'No headline provided';
  const skills = profile.skills || [];
  const education = profile.education || [];
  const resume = profile.resume || {};
  const completion = profile.profileCompletionPercentage || 0;

  return (
    <div className="page-container admin-candidate-detail-container">
      {/* Top Breadcrumb */}
      <div className="candidate-detail-breadcrumb">
        <Link to="/admin/candidates" className="back-link" data-testid="back-to-candidates-link">
          ← Back to Candidates
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{displayName}</span>
      </div>

      {/* Candidate Profile Header Card */}
      <div className="candidate-detail-header-card" data-testid="candidate-header-card">
        <div className="candidate-header-left">
          <div className="candidate-header-avatar">
            {displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="candidate-header-text">
            <div className="candidate-name-row">
              <h2 data-testid="detail-display-name">{displayName}</h2>
              {profile?.targetRole && (
                <span className="badge badge-target-role" data-testid="detail-target-role-badge">
                  🎯 {profile.targetRole}
                </span>
              )}
              <span
                className={`status-pill ${
                  candidate.isActive ? 'status-active' : 'status-inactive'
                }`}
                data-testid="detail-status-pill"
              >
                {candidate.isActive ? 'Active Account' : 'Deactivated Account'}
              </span>
            </div>
            <p className="candidate-detail-email" data-testid="detail-email">
              ✉️ {candidate.email}
            </p>
            <p className="candidate-detail-headline" data-testid="detail-headline">
              {headline}
            </p>
            <div className="candidate-meta-row">
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.phone && <span>📞 {profile.phone}</span>}
              <span>📅 Joined {formatDate(candidate.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="candidate-header-actions">
          <button
            onClick={() => setShowStatusModal(true)}
            className={`btn btn-sm ${
              candidate.isActive ? 'btn-danger' : 'btn-success'
            }`}
            data-testid="detail-toggle-status-btn"
          >
            {candidate.isActive ? 'Deactivate Account' : 'Reactivate Account'}
          </button>
        </div>
      </div>

      {/* 4-Stat Metric Strip */}
      <div className="candidate-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Profile Completion</span>
          <div className="stat-metric-row">
            <span className="stat-value" data-testid="detail-completion-stat">
              {completion}%
            </span>
          </div>
          <div className="completion-bar-bg mt-2">
            <div
              className={`completion-bar-fill ${
                completion >= 80 ? 'fill-high' : completion >= 50 ? 'fill-mid' : 'fill-low'
              }`}
              style={{ width: `${completion}%` }}
            ></div>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Target Role & Tier</span>
          <span className="stat-value" data-testid="detail-experience-stat" style={{ fontSize: '1.25rem' }}>
            {profile?.targetRole || (profile?.experienceLevel || 'entry').toUpperCase()}
          </span>
          <span className="stat-subtext">
            {(profile?.experienceLevel || 'entry').toUpperCase()} • {profile?.yearsOfExperience || 0} yrs experience
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Interview Bookings</span>
          <span className="stat-value" data-testid="detail-bookings-stat">
            {stats.totalBookings || 0}
          </span>
          <span className="stat-subtext">
            {stats.upcomingBookings || 0} upcoming • {(stats.totalBookings || 0) - (stats.upcomingBookings || 0)} past/cancelled
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Assessment Attempts</span>
          <span className="stat-value" data-testid="detail-attempts-stat">
            {stats.totalAttempts || 0}
          </span>
          <span className="stat-subtext text-success">
            {stats.passedAttempts || 0} passed • {stats.completedAttempts || 0} completed
          </span>
        </div>
      </div>

      {/* Grid: Profile Details & Resume */}
      <div className="candidate-detail-grid">
        {/* Left Column: Bio, Skills, Education */}
        <div className="candidate-detail-main">
          {/* Bio Section */}
          <div className="detail-section-card">
            <h3>Candidate Biography</h3>
            <p className="detail-bio-text" data-testid="detail-bio">
              {profile.bio || 'Candidate has not provided a biography yet.'}
            </p>

            {/* Social / Portfolio Links */}
            <div className="candidate-links-row">
              {profile.githubUrl && (
                <a
                  href={profile.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  🐙 GitHub Profile
                </a>
              )}
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  💼 LinkedIn
                </a>
              )}
              {profile.portfolioUrl && (
                <a
                  href={profile.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  🌐 Portfolio Website
                </a>
              )}
            </div>
          </div>

          {/* Skills Section */}
          <div className="detail-section-card">
            <h3>Verified Skills & Competencies</h3>
            {skills.length === 0 ? (
              <p className="text-muted">No skills listed on this profile.</p>
            ) : (
              <div className="skills-chip-list" data-testid="detail-skills-list">
                {skills.map((skill, idx) => (
                  <span key={idx} className="skill-chip skill-chip-lg">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Education Section */}
          <div className="detail-section-card">
            <h3>Academic Background</h3>
            {education.length === 0 ? (
              <p className="text-muted">No education records provided.</p>
            ) : (
              <div className="education-list" data-testid="detail-education-list">
                {education.map((edu, idx) => (
                  <div key={idx} className="education-item">
                    <div className="edu-icon">🎓</div>
                    <div className="edu-details">
                      <strong>
                        {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                      </strong>
                      <span className="edu-institution">{edu.institution}</span>
                      <span className="edu-meta">
                        Class of {edu.graduationYear || '—'} {edu.gpa ? `• GPA: ${edu.gpa}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Resume & Quick Overview */}
        <div className="candidate-detail-side">
          <div className="detail-section-card resume-card" data-testid="detail-resume-card">
            <h3>Uploaded Resume</h3>
            {resume.fileName ? (
              <div className="resume-info-box">
                <div className="resume-icon">📄</div>
                <div className="resume-details">
                  <strong>{resume.originalName || resume.fileName}</strong>
                  <span className="resume-date">
                    Uploaded {formatDate(resume.uploadedAt)}
                  </span>
                  {(resume.fileName || resume.url) && (
                    <button
                      type="button"
                      onClick={handleDownloadResume}
                      disabled={downloadingResume}
                      className="btn btn-outline btn-sm mt-2"
                      data-testid="btn-download-resume"
                    >
                      {downloadingResume ? 'Downloading...' : 'Download Resume'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="resume-empty-box">
                <span>📎</span>
                <p>No resume uploaded by candidate.</p>
              </div>
            )}
          </div>

          <div className="detail-section-card">
            <h3>Account Metadata</h3>
            <ul className="meta-list">
              <li>
                <span className="meta-label">User ID:</span>
                <code className="meta-code">{candidate._id}</code>
              </li>
              <li>
                <span className="meta-label">Account Role:</span>
                <span className="meta-val">{candidate.role}</span>
              </li>
              <li>
                <span className="meta-label">Active Status:</span>
                <span className="meta-val">{candidate.isActive ? 'Active' : 'Disabled'}</span>
              </li>
              <li>
                <span className="meta-label">Last Logout:</span>
                <span className="meta-val">{formatDate(candidate.lastLogoutAt)}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interview Bookings History */}
      <div className="detail-section-card mt-4" data-testid="detail-bookings-section">
        <div className="section-header-flex">
          <h3>Interview Booking Records ({bookings.length})</h3>
        </div>

        {bookings.length === 0 ? (
          <p className="text-muted">Candidate has not booked any mock interview slots yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="candidates-table" data-testid="detail-bookings-table">
              <thead>
                <tr>
                  <th>Session Title</th>
                  <th>Interviewer</th>
                  <th>Scheduled Time</th>
                  <th>Status</th>
                  <th>Meeting Link</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const slot = booking.slot || {};
                  return (
                    <tr key={booking._id} data-testid={`booking-row-${booking._id}`}>
                      <td>
                        <strong>{slot.title || 'Technical Mock Interview'}</strong>
                      </td>
                      <td>{slot.interviewerName || 'Senior Technical Interviewer'}</td>
                      <td>
                        {slot.startTime ? formatDate(slot.startTime) : '—'} ({slot.durationMinutes || 45} mins)
                      </td>
                      <td>
                        <span className={`status-pill status-${booking.status}`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {slot.meetingLink ? (
                          <a
                            href={slot.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary"
                          >
                            Meeting Link ↗
                          </a>
                        ) : (
                          <span className="text-muted">Not assigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assessment Attempt History */}
      <div className="detail-section-card mt-4" data-testid="detail-attempts-section">
        <div className="section-header-flex">
          <h3>Assessment Performance Records ({attempts.length})</h3>
        </div>

        {attempts.length === 0 ? (
          <p className="text-muted">Candidate has not undertaken any assessments yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="candidates-table" data-testid="detail-attempts-table">
              <thead>
                <tr>
                  <th>Assessment Title</th>
                  <th>Attempt</th>
                  <th>Score / Total</th>
                  <th>Percentage</th>
                  <th>Result</th>
                  <th>Date Taken</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => {
                  const assessmentTitle =
                    attempt.assessment?.title || 'Mock Technical Assessment';
                  const passingPercentage =
                    attempt.assessment?.passingPercentage ?? 60;
                  const isPassed = (attempt.percentage || 0) >= passingPercentage;

                  return (
                    <tr key={attempt._id} data-testid={`attempt-row-${attempt._id}`}>
                      <td>
                        <strong>{assessmentTitle}</strong>
                      </td>
                      <td>Attempt #{attempt.attemptNumber || 1}</td>
                      <td>
                        {attempt.score || 0} / {attempt.totalMarks || 100}
                      </td>
                      <td>
                        <strong className={isPassed ? 'text-success' : 'text-danger'}>
                          {attempt.percentage || 0}%
                        </strong>
                      </td>
                      <td>
                        {attempt.status === 'completed' ? (
                          <span
                            className={`badge ${
                              isPassed ? 'badge-success' : 'badge-danger'
                            }`}
                          >
                            {isPassed ? 'PASSED' : 'FAILED'}
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            {(attempt.status || 'in_progress').toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="text-muted text-sm">
                        {formatDate(attempt.endTime || attempt.startTime)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status Toggle Modal */}
      {showStatusModal && (
        <div className="modal-backdrop" data-testid="detail-status-toggle-modal">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>
                {candidate.isActive ? 'Deactivate Candidate Account' : 'Reactivate Candidate Account'}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowStatusModal(false)}
                disabled={actionLoading}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to{' '}
                <strong>{candidate.isActive ? 'deactivate' : 'reactivate'}</strong> candidate{' '}
                <code>{candidate.email}</code>?
              </p>
              {candidate.isActive ? (
                <div className="modal-alert-warning">
                  ⚠️ <strong>Immediate Effect:</strong> This candidate will be immediately blocked
                  from accessing protected candidate endpoints, and any current sessions will receive
                  a 403 Forbidden response.
                </div>
              ) : (
                <div className="modal-alert-info">
                  ℹ️ This candidate will regain full access to their dashboard, interview bookings,
                  and assessment portal.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowStatusModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className={`btn btn-sm ${
                  candidate.isActive ? 'btn-danger' : 'btn-success'
                }`}
                onClick={handleToggleStatus}
                disabled={actionLoading}
                data-testid="confirm-detail-status-toggle-btn"
              >
                {actionLoading
                  ? 'Updating...'
                  : candidate.isActive
                  ? 'Confirm Deactivate'
                  : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCandidateDetailPage;
