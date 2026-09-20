import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import candidateProfileService from '../../services/candidateProfileService';
import { calculateProfileCompletion } from '../../utils/profileCompletion';
import {
  validateResumeFile,
  ALLOWED_RESUME_EXTENSIONS,
  MAX_RESUME_SIZE_MB,
} from '../../utils/fileValidation';

const POPULAR_SKILLS = [
  'JavaScript',
  'React',
  'Node.js',
  'TypeScript',
  'Python',
  'Express.js',
  'MongoDB',
  'SQL',
  'Docker',
  'AWS',
  'Git',
];

const CandidateProfilePage = () => {
  const toast = useToast();
  const { user: authUser } = useAuth();

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingResume, setDeletingResume] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Status banners
  const [feedback, setFeedback] = useState({ type: null, message: null });
  const [resumeError, setResumeError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Core profile state
  const [profileId, setProfileId] = useState(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [resume, setResume] = useState(null);
  const [authoritativeScore, setAuthoritativeScore] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // Form fields
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    location: '',
    headline: '',
    bio: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    experienceLevel: 'entry',
    yearsOfExperience: 0,
    skills: [],
    education: [],
  });

  // Transient inputs
  const [newSkill, setNewSkill] = useState('');

  // 1. Initial Profile Fetch
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setLoading(true);
        const res = await candidateProfileService.getProfile();
        if (!isMounted) return;

        if (res.success && res.data?.profile) {
          const p = res.data.profile;
          setProfileId(p._id);
          setAccountEmail(p.user?.email || authUser?.email || '');
          setResume(p.resume?.url ? p.resume : null);
          setAuthoritativeScore(p.profileCompletionPercentage ?? 0);

          setForm({
            fullName: p.fullName || '',
            phone: p.phone || '',
            location: p.location || '',
            headline: p.headline || '',
            bio: p.bio || '',
            githubUrl: p.githubUrl || '',
            linkedinUrl: p.linkedinUrl || '',
            portfolioUrl: p.portfolioUrl || '',
            experienceLevel: p.experienceLevel || 'entry',
            yearsOfExperience: p.yearsOfExperience ?? 0,
            skills: Array.isArray(p.skills) ? p.skills : [],
            education: Array.isArray(p.education) ? p.education : [],
          });
          setIsDirty(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setFeedback({
          type: 'error',
          message: err.response?.data?.message || 'Failed to load candidate profile.',
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  // 2. Live Completion Calculation
  // Optimistic calculation drives live UI feedback while editing;
  // Overwritten by authoritative backend score upon every successful save/upload/delete.
  const liveCompletion = useMemo(() => {
    return calculateProfileCompletion({
      ...form,
      resume,
    });
  }, [form, resume]);

  const displayedPercentage = isDirty ? liveCompletion.percentage : authoritativeScore;

  // Change handler for basic form fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Skill management
  const handleAddSkill = (skillToAdd) => {
    const trimmed = (skillToAdd || newSkill).trim();
    if (!trimmed) return;
    if (form.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSkill('');
      return;
    }
    setForm((prev) => ({
      ...prev,
      skills: [...prev.skills, trimmed],
    }));
    setNewSkill('');
    setIsDirty(true);
  };

  const handleRemoveSkill = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, idx) => idx !== indexToRemove),
    }));
    setIsDirty(true);
  };

  // Education management
  const handleAddEducation = () => {
    setForm((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          institution: '',
          degree: '',
          fieldOfStudy: '',
          graduationYear: new Date().getFullYear(),
          gpa: '',
        },
      ],
    }));
    setIsDirty(true);
  };

  const handleEducationChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
    setIsDirty(true);
  };

  const handleRemoveEducation = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      education: prev.education.filter((_, idx) => idx !== indexToRemove),
    }));
    setIsDirty(true);
  };

  // Client-Side Profile Form Validation
  const validateForm = () => {
    const errors = {};
    if (form.headline && form.headline.length > 200) {
      errors.headline = 'Headline cannot exceed 200 characters.';
    }
    if (form.bio && form.bio.length > 1000) {
      errors.bio = 'Bio cannot exceed 1000 characters.';
    }
    if (form.yearsOfExperience < 0) {
      errors.yearsOfExperience = 'Years of experience cannot be negative.';
    }

    const urlRegex = /^https?:\/\/.+/i;
    if (form.githubUrl && !urlRegex.test(form.githubUrl)) {
      errors.githubUrl = 'Must be a valid URL starting with http:// or https://';
    }
    if (form.linkedinUrl && !urlRegex.test(form.linkedinUrl)) {
      errors.linkedinUrl = 'Must be a valid URL starting with http:// or https://';
    }
    if (form.portfolioUrl && !urlRegex.test(form.portfolioUrl)) {
      errors.portfolioUrl = 'Must be a valid URL starting with http:// or https://';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save profile changes (PUT /api/candidate/profile)
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!validateForm()) {
      setFeedback({
        type: 'error',
        message: 'Please resolve the highlighted validation errors before saving.',
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback({ type: null, message: null });

      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        githubUrl: form.githubUrl.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
        portfolioUrl: form.portfolioUrl.trim(),
        experienceLevel: form.experienceLevel,
        yearsOfExperience: Number(form.yearsOfExperience) || 0,
        skills: form.skills,
        education: form.education.map((edu) => ({
          institution: edu.institution ? edu.institution.trim() : '',
          degree: edu.degree ? edu.degree.trim() : '',
          fieldOfStudy: edu.fieldOfStudy ? edu.fieldOfStudy.trim() : '',
          graduationYear: edu.graduationYear ? Number(edu.graduationYear) : undefined,
          gpa: edu.gpa ? String(edu.gpa).trim() : '',
        })),
      };

      const res = await candidateProfileService.updateProfile(payload);

      if (res.success && res.data?.profile) {
        // Authoritative backend score overwrite
        const authoritativePercentage = res.data.profile.profileCompletionPercentage ?? 0;
        setAuthoritativeScore(authoritativePercentage);
        setIsDirty(false);
        setFeedback({
          type: 'success',
          message: 'Candidate profile updated successfully.',
        });
        toast.success('Candidate profile updated successfully.');
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.errors?.join(', ') ||
        'Failed to update profile.';
      setFeedback({
        type: 'error',
        message: errMsg,
      });
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Resume Upload Handler with Pre-Flight Client-Side Validation
  const handleResumeFileSelect = async (e) => {
    const file = e.target.files?.[0];
    // Reset file input value so selecting the same file again triggers change
    e.target.value = '';
    if (!file) return;

    setResumeError(null);

    // Pre-flight client validation mirroring backend upload rules
    const validation = validateResumeFile(file);
    if (!validation.valid) {
      setResumeError(validation.error);
      toast.warning(validation.error);
      return;
    }

    try {
      setUploadingResume(true);
      setUploadProgress(0);

      const res = await candidateProfileService.uploadResume(file, (percent) => {
        setUploadProgress(percent);
      });

      if (res.success && res.data) {
        setResume(res.data.resume);
        // Authoritative backend score overwrite
        setAuthoritativeScore(res.data.profileCompletionPercentage ?? 0);
        setFeedback({
          type: 'success',
          message: 'Resume uploaded successfully.',
        });
        toast.success('Resume uploaded successfully.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to upload resume file.';
      setResumeError(errMsg);
      toast.error(errMsg);
    } finally {
      setUploadingResume(false);
      setUploadProgress(0);
    }
  };

  // Delete Resume Handler
  const handleDeleteResume = async () => {
    try {
      setDeletingResume(true);
      setShowDeleteConfirm(false);
      setResumeError(null);

      const res = await candidateProfileService.deleteResume();

      if (res.success && res.data) {
        setResume(null);
        // Authoritative backend score overwrite
        setAuthoritativeScore(res.data.profileCompletionPercentage ?? 0);
        setFeedback({
          type: 'success',
          message: 'Resume document deleted successfully.',
        });
        toast.info('Resume document deleted successfully.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete resume.';
      setResumeError(errMsg);
      toast.error(errMsg);
    } finally {
      setDeletingResume(false);
    }
  };

  // Download Resume Handler
  const handleDownloadResume = async () => {
    try {
      await candidateProfileService.downloadResume(resume?.originalName || 'resume.pdf');
    } catch (err) {
      setResumeError(err.response?.data?.message || 'Failed to download resume.');
    }
  };

  // Status color helper for progress bar
  const getProgressColorClass = (pct) => {
    if (pct >= 80) return 'progress-success';
    if (pct >= 50) return 'progress-info';
    return 'progress-warning';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="auth-loading-screen">
          <div className="spinner" data-testid="profile-loading-spinner" />
          <p>Loading candidate profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container candidate-profile-page" data-testid="candidate-profile-page">
      {/* Page Header */}
      <div className="profile-page-header">
        <div>
          <span className="badge badge-candidate">Candidate Space</span>
          <h1 className="profile-title">Profile & Resume</h1>
          <p className="profile-subtitle">
            Manage your personal background, technical skills, education, and resume to qualify for interviews.
          </p>
        </div>

        {/* Global Save Button (Top) */}
        <div className="header-action-group">
          <button
            type="button"
            className="btn btn-primary btn-save-profile"
            onClick={handleSaveProfile}
            disabled={saving || !isDirty}
            data-testid="btn-save-profile-top"
          >
            {saving ? (
              <>
                <span className="button-spinner" /> Saving Changes...
              </>
            ) : isDirty ? (
              'Save Profile Changes'
            ) : (
              'Profile Up to Date'
            )}
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {feedback.message && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}
          data-testid={`alert-${feedback.type}`}
        >
          <span className="alert-icon">{feedback.type === 'success' ? '✓' : '⚠'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Completion Score Hero Card */}
      <div className="profile-completion-card" data-testid="profile-completion-card">
        <div className="completion-card-header">
          <div className="completion-info">
            <span className="completion-label">Profile Strength</span>
            <div className="completion-score-display">
              <span className="completion-percentage" data-testid="completion-percentage">
                {displayedPercentage}%
              </span>
              {isDirty && (
                <span className="completion-dirty-tag" data-testid="completion-dirty-tag">
                  (live preview • unsaved)
                </span>
              )}
            </div>
          </div>
          <div className="completion-status-badge">
            {displayedPercentage >= 80 ? (
              <span className="badge badge-success">✓ Profile Complete</span>
            ) : displayedPercentage >= 50 ? (
              <span className="badge badge-info">⚡ Good Progress</span>
            ) : (
              <span className="badge badge-warning">⚠ Incomplete</span>
            )}
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="progress-track" role="progressbar" aria-valuenow={displayedPercentage} aria-valuemin="0" aria-valuemax="100">
          <div
            className={`progress-fill ${getProgressColorClass(displayedPercentage)}`}
            style={{ width: `${displayedPercentage}%` }}
            data-testid="progress-fill"
          />
        </div>

        {/* Section Checklist Pills */}
        <div className="completion-checklist">
          <span
            className={`checklist-item ${liveCompletion.sections.fullName ? 'done' : 'missing'}`}
            title="10% - Full Name provided"
          >
            {liveCompletion.sections.fullName ? '✓' : '○'} Full Name (+10%)
          </span>
          <span
            className={`checklist-item ${liveCompletion.sections.phoneOrLocation ? 'done' : 'missing'}`}
            title="10% - Phone or Location provided"
          >
            {liveCompletion.sections.phoneOrLocation ? '✓' : '○'} Phone / Location (+10%)
          </span>
          <span
            className={`checklist-item ${liveCompletion.sections.overview ? 'done' : 'missing'}`}
            title="15% - Headline or Bio provided"
          >
            {liveCompletion.sections.overview ? '✓' : '○'} Overview (+15%)
          </span>
          <span
            className={`checklist-item ${liveCompletion.sections.skills ? 'done' : 'missing'}`}
            title="20% - At least 1 technical skill added"
          >
            {liveCompletion.sections.skills ? '✓' : '○'} Skills (+20%)
          </span>
          <span
            className={`checklist-item ${liveCompletion.sections.education ? 'done' : 'missing'}`}
            title="20% - At least 1 education entry with institution/degree"
          >
            {liveCompletion.sections.education ? '✓' : '○'} Education (+20%)
          </span>
          <span
            className={`checklist-item ${liveCompletion.sections.links ? 'done' : 'missing'}`}
            title="10% - GitHub, LinkedIn, or Portfolio link"
          >
            {liveCompletion.sections.links ? '✓' : '○'} External Links (+10%)
          </span>
          <span
            className={`checklist-item ${liveCompletion.sections.resume ? 'done' : 'missing'}`}
            title="15% - Resume document uploaded"
          >
            {liveCompletion.sections.resume ? '✓' : '○'} Resume (+15%)
          </span>
        </div>
      </div>

      {/* Main Grid: Form Sections (Left) & Resume / Quick Info (Right) */}
      <div className="profile-layout-grid">
        {/* Left Column: Editable Form */}
        <div className="profile-form-column">
          <form onSubmit={handleSaveProfile} noValidate>
            {/* Section 1: Basic Information */}
            <div className="profile-card">
              <div className="card-section-header">
                <h3>1. Personal & Contact Information</h3>
                <span className="section-weight-badge">+20% Potential</span>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    className="form-control"
                    placeholder="e.g. Jane Doe"
                    value={form.fullName}
                    onChange={handleInputChange}
                    data-testid="input-fullName"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Account Email</label>
                  <input
                    type="email"
                    id="email"
                    className="form-control form-control-readonly"
                    value={accountEmail}
                    readOnly
                    disabled
                    title="Account email cannot be modified from profile settings."
                    data-testid="input-email-readonly"
                  />
                  <small className="field-hint">Locked to authenticated account</small>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="form-control"
                    placeholder="+1 (555) 012-3456"
                    value={form.phone}
                    onChange={handleInputChange}
                    data-testid="input-phone"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location / Timezone</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    className="form-control"
                    placeholder="City, Country or Remote"
                    value={form.location}
                    onChange={handleInputChange}
                    data-testid="input-location"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Professional Overview */}
            <div className="profile-card">
              <div className="card-section-header">
                <h3>2. Professional Overview</h3>
                <span className="section-weight-badge">+15% Potential</span>
              </div>

              <div className="form-group">
                <div className="label-with-counter">
                  <label htmlFor="headline">Professional Headline</label>
                  <span className={`char-counter ${form.headline.length > 200 ? 'counter-overflow' : ''}`}>
                    {form.headline.length}/200
                  </span>
                </div>
                <input
                  type="text"
                  id="headline"
                  name="headline"
                  className={`form-control ${fieldErrors.headline ? 'is-invalid' : ''}`}
                  placeholder="e.g. Senior Full Stack Engineer | React & Node.js"
                  value={form.headline}
                  onChange={handleInputChange}
                  maxLength={250}
                  data-testid="input-headline"
                />
                {fieldErrors.headline && (
                  <span className="field-error-text">{fieldErrors.headline}</span>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="experienceLevel">Experience Tier</label>
                  <select
                    id="experienceLevel"
                    name="experienceLevel"
                    className="form-control"
                    value={form.experienceLevel}
                    onChange={handleInputChange}
                    data-testid="select-experienceLevel"
                  >
                    <option value="entry">Entry Level (0-2 years)</option>
                    <option value="mid">Mid Level (2-5 years)</option>
                    <option value="senior">Senior Level (5-8 years)</option>
                    <option value="lead">Lead / Principal (8+ years)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="yearsOfExperience">Years of Relevant Experience</label>
                  <input
                    type="number"
                    id="yearsOfExperience"
                    name="yearsOfExperience"
                    min="0"
                    step="0.5"
                    className={`form-control ${fieldErrors.yearsOfExperience ? 'is-invalid' : ''}`}
                    value={form.yearsOfExperience}
                    onChange={handleInputChange}
                    data-testid="input-yearsOfExperience"
                  />
                  {fieldErrors.yearsOfExperience && (
                    <span className="field-error-text">{fieldErrors.yearsOfExperience}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <div className="label-with-counter">
                  <label htmlFor="bio">Professional Bio & Career Objective</label>
                  <span className={`char-counter ${form.bio.length > 1000 ? 'counter-overflow' : ''}`}>
                    {form.bio.length}/1000
                  </span>
                </div>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  className={`form-control ${fieldErrors.bio ? 'is-invalid' : ''}`}
                  placeholder="Summarize your engineering background, top achievements, and interview goals..."
                  value={form.bio}
                  onChange={handleInputChange}
                  maxLength={1200}
                  data-testid="textarea-bio"
                />
                {fieldErrors.bio && (
                  <span className="field-error-text">{fieldErrors.bio}</span>
                )}
              </div>
            </div>

            {/* Section 3: Technical Skills */}
            <div className="profile-card">
              <div className="card-section-header">
                <h3>3. Technical Skills</h3>
                <span className="section-weight-badge">+20% Potential</span>
              </div>

              <div className="skill-input-container">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type a skill and press Enter or click Add (e.g. Docker, GraphQL)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  data-testid="input-new-skill"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleAddSkill()}
                  data-testid="btn-add-skill"
                >
                  + Add Skill
                </button>
              </div>

              {/* Added Skills Chips */}
              <div className="skills-chips-wrapper" data-testid="skills-chips-wrapper">
                {form.skills.length === 0 ? (
                  <p className="empty-hint">No skills added yet. Add at least one skill to earn 20% completion.</p>
                ) : (
                  form.skills.map((skill, idx) => (
                    <span key={idx} className="skill-chip" data-testid={`skill-chip-${idx}`}>
                      {skill}
                      <button
                        type="button"
                        className="skill-remove-btn"
                        onClick={() => handleRemoveSkill(idx)}
                        title={`Remove ${skill}`}
                        data-testid={`btn-remove-skill-${idx}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Quick Suggestions */}
              <div className="popular-skills-section">
                <span className="popular-label">Popular Suggestions:</span>
                <div className="popular-chips">
                  {POPULAR_SKILLS.filter((s) => !form.skills.includes(s)).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="popular-chip-btn"
                      onClick={() => handleAddSkill(s)}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 4: Education History */}
            <div className="profile-card">
              <div className="card-section-header">
                <h3>4. Education History</h3>
                <span className="section-weight-badge">+20% Potential</span>
              </div>

              {form.education.length === 0 ? (
                <div className="empty-state-box">
                  <p>No education records added yet.</p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleAddEducation}
                    data-testid="btn-add-education-first"
                  >
                    + Add Degree / Institution
                  </button>
                </div>
              ) : (
                <div className="education-list">
                  {form.education.map((edu, idx) => (
                    <div key={idx} className="education-card" data-testid={`education-item-${idx}`}>
                      <div className="education-card-header">
                        <span className="education-index">Education #{idx + 1}</span>
                        <button
                          type="button"
                          className="btn-text-danger"
                          onClick={() => handleRemoveEducation(idx)}
                          data-testid={`btn-remove-education-${idx}`}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="form-row-2">
                        <div className="form-group">
                          <label>Institution / University</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Stanford University"
                            value={edu.institution || ''}
                            onChange={(e) => handleEducationChange(idx, 'institution', e.target.value)}
                            data-testid={`input-edu-institution-${idx}`}
                          />
                        </div>

                        <div className="form-group">
                          <label>Degree</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. B.S. Computer Science"
                            value={edu.degree || ''}
                            onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                            data-testid={`input-edu-degree-${idx}`}
                          />
                        </div>
                      </div>

                      <div className="form-row-3">
                        <div className="form-group">
                          <label>Field of Study</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Software Engineering"
                            value={edu.fieldOfStudy || ''}
                            onChange={(e) => handleEducationChange(idx, 'fieldOfStudy', e.target.value)}
                            data-testid={`input-edu-field-${idx}`}
                          />
                        </div>

                        <div className="form-group">
                          <label>Graduation Year</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="YYYY"
                            value={edu.graduationYear || ''}
                            onChange={(e) => handleEducationChange(idx, 'graduationYear', e.target.value)}
                            data-testid={`input-edu-year-${idx}`}
                          />
                        </div>

                        <div className="form-group">
                          <label>GPA / Grade</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. 3.8 / 4.0"
                            value={edu.gpa || ''}
                            onChange={(e) => handleEducationChange(idx, 'gpa', e.target.value)}
                            data-testid={`input-edu-gpa-${idx}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleAddEducation}
                    data-testid="btn-add-education"
                  >
                    + Add Another Education Entry
                  </button>
                </div>
              )}
            </div>

            {/* Section 5: External Links & Portfolios */}
            <div className="profile-card">
              <div className="card-section-header">
                <h3>5. Portfolios & Professional Links</h3>
                <span className="section-weight-badge">+10% Potential</span>
              </div>

              <div className="form-group">
                <label htmlFor="githubUrl">GitHub Profile URL</label>
                <input
                  type="url"
                  id="githubUrl"
                  name="githubUrl"
                  className={`form-control ${fieldErrors.githubUrl ? 'is-invalid' : ''}`}
                  placeholder="https://github.com/yourusername"
                  value={form.githubUrl}
                  onChange={handleInputChange}
                  data-testid="input-githubUrl"
                />
                {fieldErrors.githubUrl && (
                  <span className="field-error-text">{fieldErrors.githubUrl}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="linkedinUrl">LinkedIn Profile URL</label>
                <input
                  type="url"
                  id="linkedinUrl"
                  name="linkedinUrl"
                  className={`form-control ${fieldErrors.linkedinUrl ? 'is-invalid' : ''}`}
                  placeholder="https://linkedin.com/in/yourprofile"
                  value={form.linkedinUrl}
                  onChange={handleInputChange}
                  data-testid="input-linkedinUrl"
                />
                {fieldErrors.linkedinUrl && (
                  <span className="field-error-text">{fieldErrors.linkedinUrl}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="portfolioUrl">Personal Portfolio / Website URL</label>
                <input
                  type="url"
                  id="portfolioUrl"
                  name="portfolioUrl"
                  className={`form-control ${fieldErrors.portfolioUrl ? 'is-invalid' : ''}`}
                  placeholder="https://yourportfolio.dev"
                  value={form.portfolioUrl}
                  onChange={handleInputChange}
                  data-testid="input-portfolioUrl"
                />
                {fieldErrors.portfolioUrl && (
                  <span className="field-error-text">{fieldErrors.portfolioUrl}</span>
                )}
              </div>
            </div>

            {/* Save Profile Button (Bottom) */}
            <div className="form-submit-panel">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={saving || !isDirty}
                data-testid="btn-save-profile-bottom"
              >
                {saving ? (
                  <>
                    <span className="button-spinner" /> Saving Changes...
                  </>
                ) : isDirty ? (
                  'Save Profile Details'
                ) : (
                  'All Changes Saved'
                )}
              </button>
              {isDirty && (
                <span className="unsaved-hint" data-testid="unsaved-hint">
                  You have unsaved changes. Remember to save to update your profile score on the server.
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Resume Management & Fast Navigation */}
        <div className="profile-sidebar-column">
          {/* Resume Management Panel */}
          <div className="profile-card resume-management-card" data-testid="resume-management-card">
            <div className="card-section-header">
              <h3>Resume Document</h3>
              <span className="section-weight-badge">+15% Score</span>
            </div>

            {/* Resume Error Alert */}
            {resumeError && (
              <div className="alert alert-error" data-testid="alert-resume-error">
                <span className="alert-icon">⚠</span>
                <span>{resumeError}</span>
              </div>
            )}

            {resume?.url ? (
              /* State A: Resume Uploaded */
              <div className="uploaded-resume-box" data-testid="uploaded-resume-box">
                <div className="resume-icon-badge">📄</div>
                <div className="resume-meta">
                  <span className="resume-filename" title={resume.originalName}>
                    {resume.originalName || 'Uploaded Resume'}
                  </span>
                  <span className="resume-date">
                    Uploaded{' '}
                    {resume.uploadedAt
                      ? new Date(resume.uploadedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Recently'}
                  </span>
                </div>

                <div className="resume-actions-group">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDownloadResume}
                    data-testid="btn-download-resume"
                  >
                    ⬇ Download Resume
                  </button>

                  <label className="btn btn-outline btn-sm btn-replace-label" data-testid="label-replace-resume">
                    🔄 Replace File
                    <input
                      type="file"
                      className="hidden-file-input"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleResumeFileSelect}
                      disabled={uploadingResume}
                      data-testid="input-replace-resume-file"
                    />
                  </label>

                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      className="btn-text-danger btn-sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deletingResume}
                      data-testid="btn-show-delete-resume"
                    >
                      Delete Resume
                    </button>
                  ) : (
                    <div className="delete-confirm-box" data-testid="delete-confirm-box">
                      <p className="confirm-text">Confirm permanent deletion?</p>
                      <div className="confirm-buttons">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={handleDeleteResume}
                          disabled={deletingResume}
                          data-testid="btn-confirm-delete-resume"
                        >
                          {deletingResume ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowDeleteConfirm(false)}
                          data-testid="btn-cancel-delete-resume"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* State B: No Resume Uploaded */
              <div className="resume-dropzone-box" data-testid="resume-dropzone-box">
                <div className="dropzone-icon">📁</div>
                <h4>Upload your Resume</h4>
                <p className="dropzone-subtext">
                  Supported formats: <strong>PDF, DOC, DOCX</strong>
                  <br />
                  Maximum file size: <strong>{MAX_RESUME_SIZE_MB}MB</strong>
                </p>

                <label className="btn btn-primary btn-upload-cta" data-testid="label-upload-resume">
                  {uploadingResume ? 'Uploading...' : 'Select Resume File'}
                  <input
                    type="file"
                    className="hidden-file-input"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeFileSelect}
                    disabled={uploadingResume}
                    data-testid="input-upload-resume-file"
                  />
                </label>
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploadingResume && (
              <div className="upload-progress-container" data-testid="upload-progress-container">
                <div className="progress-info-row">
                  <span>Uploading resume...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill progress-info"
                    style={{ width: `${uploadProgress}%` }}
                    data-testid="resume-upload-progress-bar"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Rules & Guidelines Card */}
          <div className="profile-card rules-card">
            <h4>💡 Profile Completion Guide</h4>
            <ul className="rules-list">
              <li>
                <strong>20% Contact:</strong> Full name (+10%) &amp; Phone or Location (+10%).
              </li>
              <li>
                <strong>15% Overview:</strong> Professional headline or brief bio.
              </li>
              <li>
                <strong>20% Skills:</strong> At least 1 technical skill added.
              </li>
              <li>
                <strong>20% Education:</strong> At least 1 institution or degree entry.
              </li>
              <li>
                <strong>10% Portfolios:</strong> GitHub, LinkedIn, or personal website link.
              </li>
              <li>
                <strong>15% Resume:</strong> Valid PDF, DOC, or DOCX document under {MAX_RESUME_SIZE_MB}MB.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfilePage;
