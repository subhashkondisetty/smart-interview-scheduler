import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import authService from '../../services/authService';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // If URL doesn't contain a token
  if (!token) {
    return (
      <div className="page-container auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <span className="auth-badge badge-danger">Missing Token</span>
            <h2 className="auth-title">Invalid Reset Link</h2>
            <p className="auth-subtitle">
              No reset token was found in the link. Please request a new password reset.
            </p>
          </div>
          <div className="auth-actions-group">
            <Link to="/forgot-password" className="btn btn-primary btn-block">
              Request New Reset Link
            </Link>
            <Link to="/login" className="btn btn-outline btn-block">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const validateForm = () => {
    const errors = {};

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirmation password is required.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field) => {
    if (field === 'password' && password) {
      if (password.length < 6) {
        setFieldErrors((prev) => ({ ...prev, password: 'Password must be at least 6 characters long.' }));
      } else {
        setFieldErrors((prev) => {
          const updated = { ...prev };
          delete updated.password;
          return updated;
        });
      }
    }

    if (field === 'confirmPassword' && confirmPassword) {
      if (password !== confirmPassword) {
        setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
      } else {
        setFieldErrors((prev) => {
          const updated = { ...prev };
          delete updated.confirmPassword;
          return updated;
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await authService.resetPassword(token, { password });
      setIsSuccess(true);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Unable to reset password. The link may have expired or already been used.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container auth-page">
      <div className="auth-card">
        {isSuccess ? (
          <div className="auth-confirmation-state">
            <div className="confirmation-icon text-success">✅</div>
            <h2 className="auth-title">Password Reset Complete</h2>
            <p className="auth-subtitle">
              Your password has been successfully updated. You can now log in with your new credentials.
            </p>

            <div className="auth-actions-group">
              <Link to="/login" className="btn btn-primary btn-block">
                Sign In Now →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <span className="auth-badge">Security Update</span>
              <h2 className="auth-title">Set New Password</h2>
              <p className="auth-subtitle">
                Please enter and confirm your new account password below.
              </p>
            </div>

            {serverError && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon">⚠️</span>
                <div>
                  <p>{serverError}</p>
                  <Link to="/forgot-password" className="alert-action-link">
                    Request a new reset link →
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="password">New Password (min. 6 characters)</label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: null }));
                    }
                    if (confirmPassword && e.target.value === confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
                    }
                  }}
                  onBlur={() => handleBlur('password')}
                  placeholder="••••••••"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                />
                {fieldErrors.password && (
                  <span id="password-error" className="field-error-text" role="alert">{fieldErrors.password}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
                    }
                  }}
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="••••••••"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                  className={`form-control ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
                />
                {fieldErrors.confirmPassword && (
                  <span id="confirm-password-error" className="field-error-text" role="alert">{fieldErrors.confirmPassword}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-block btn-auth"
              >
                {isSubmitting ? (
                  <>
                    <span className="button-spinner"></span>
                    <span>Updating password...</span>
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>

            <div className="auth-card-footer">
              <p>
                <Link to="/login" className="auth-link">
                  ← Back to Sign In
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
