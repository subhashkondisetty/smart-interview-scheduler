import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Flash message from session expiration or route guard redirect
  const flashMessage = location.state?.message;
  const isSessionExpired = location.state?.sessionExpired;
  const from = location.state?.from?.pathname || null;

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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login({ email: email.trim(), password });
      const user = response?.data?.user;
      const isAdminUser = user?.role === 'admin';

      // Navigate to preserved return URL (if permitted for role), or default role dashboard
      const targetPath = typeof from === 'string' ? from : from?.pathname;
      const isPathPermitted =
        targetPath &&
        targetPath !== '/' &&
        (isAdminUser
          ? !targetPath.startsWith('/candidate')
          : !targetPath.startsWith('/admin'));

      if (isPathPermitted) {
        navigate(targetPath, { replace: true });
      } else if (isAdminUser) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/candidate/dashboard', { replace: true });
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Unable to sign in. Please verify your email and password, then try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-badge">Welcome Back</span>
          <h2 className="auth-title">Sign In to SmartPrep</h2>
          <p className="auth-subtitle">
            Access your mock interviews, assessments, and performance dashboards.
          </p>
        </div>

        {flashMessage && (
          <div className={`alert ${isSessionExpired ? 'alert-warning' : 'alert-info'}`}>
            <span className="alert-icon">{isSessionExpired ? '⏳' : 'ℹ️'}</span>
            <span>{flashMessage}</span>
          </div>
        )}

        {serverError && (
          <div className="alert alert-danger" role="alert">
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
              aria-invalid={fieldErrors.email ? 'true' : 'false'}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: null }));
                }
              }}
              onBlur={() => handleBlur('email')}
              placeholder="candidate@example.com"
              className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
            />
            {fieldErrors.email && (
              <span id="email-error" className="field-error-text" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="forgot-password-link">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              aria-invalid={fieldErrors.password ? 'true' : 'false'}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: null }));
                }
              }}
              placeholder="••••••••"
              className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
            />
            {fieldErrors.password && (
              <span id="password-error" className="field-error-text" role="alert">
                {fieldErrors.password}
              </span>
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
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>
            Don't have an account yet?{' '}
            <Link to="/register" className="auth-link">
              Create a free account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
