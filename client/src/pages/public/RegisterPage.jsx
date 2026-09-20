import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const errors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address (e.g. name@domain.com).';
    }

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
    if (field === 'email' && email.trim()) {
      if (!EMAIL_REGEX.test(email.trim())) {
        setFieldErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));
      } else {
        setFieldErrors((prev) => {
          const updated = { ...prev };
          delete updated.email;
          return updated;
        });
      }
    }

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
      await register({ email: email.trim(), password });
      navigate('/candidate/dashboard', { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Registration failed. Please verify your information and try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-badge">Get Started</span>
          <h2 className="auth-title">Create Candidate Account</h2>
          <p className="auth-subtitle">
            Join SmartPrep to book mock interview slots and take timed skill assessments.
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
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: null }));
                }
              }}
              onBlur={() => handleBlur('email')}
              placeholder="candidate@example.com"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
            />
            {fieldErrors.email && (
              <span id="email-error" className="field-error-text" role="alert">{fieldErrors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password (min. 6 characters)</label>
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
            <label htmlFor="confirmPassword">Confirm Password</label>
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
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in here →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
