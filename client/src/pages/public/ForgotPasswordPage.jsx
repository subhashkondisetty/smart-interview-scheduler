import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../../services/authService';

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldError('Email address is required.');
      return false;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFieldError('Please enter a valid email address (e.g. name@domain.com).');
      return false;
    }
    setFieldError(null);
    return true;
  };

  const handleBlur = () => {
    if (email.trim() && !EMAIL_REGEX.test(email.trim())) {
      setFieldError('Please enter a valid email address.');
    } else {
      setFieldError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await authService.forgotPassword({ email: email.trim() });
      setIsSubmitted(true);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Unable to process your request. Please verify your internet connection and try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container auth-page">
      <div className="auth-card">
        {isSubmitted ? (
          <div className="auth-confirmation-state">
            <div className="confirmation-icon">📬</div>
            <h2 className="auth-title">Check Your Email</h2>
            <p className="auth-subtitle">
              If an account exists for <strong>{email}</strong>, a secure password reset link has been dispatched.
            </p>

            <div className="alert alert-info">
              <span className="alert-icon">ℹ️</span>
              <span>
                For your security, reset links expire after <strong>15 minutes</strong>. If you don't see the email, please check your spam folder.
              </span>
            </div>

            <div className="auth-actions-group">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                className="btn btn-outline btn-block"
              >
                Send to a different email
              </button>
              <Link to="/login" className="btn btn-primary btn-block">
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <span className="auth-badge">Account Recovery</span>
              <h2 className="auth-title">Reset Your Password</h2>
              <p className="auth-subtitle">
                Enter your registered email address and we'll send you instructions to create a new password.
              </p>
            </div>

            {serverError && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon">⚠️</span>
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(null);
                  }}
                  onBlur={handleBlur}
                  placeholder="candidate@example.com"
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? 'email-error' : undefined}
                  className={`form-control ${fieldError ? 'is-invalid' : ''}`}
                />
                {fieldError && <span id="email-error" className="field-error-text" role="alert">{fieldError}</span>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-block btn-auth"
              >
                {isSubmitting ? (
                  <>
                    <span className="button-spinner"></span>
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </button>
            </form>

            <div className="auth-card-footer">
              <p>
                Remembered your password?{' '}
                <Link to="/login" className="auth-link">
                  Back to Sign In →
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
