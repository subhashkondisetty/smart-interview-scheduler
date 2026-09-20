import React from 'react';

/**
 * Accessible Alert banner component
 *
 * @param {Object} props
 * @param {'success'|'danger'|'warning'|'info'} [props.type='info'] - Alert category
 * @param {string} [props.title] - Bold alert title
 * @param {string|React.ReactNode} props.message - Main message content
 * @param {Function} [props.onDismiss] - Optional close handler
 * @param {Function} [props.onRetry] - Optional retry handler
 * @param {string} [props.retryText='Retry'] - Text for retry button
 * @param {string} [props.testId] - Optional data-testid
 * @param {string} [props.className] - Additional CSS classes
 */
const Alert = ({
  type = 'info',
  title,
  message,
  onDismiss,
  onRetry,
  retryText = 'Retry',
  testId,
  className = '',
}) => {
  const alertTypeClass =
    type === 'danger' || type === 'error'
      ? 'alert-danger'
      : type === 'success'
      ? 'alert-success'
      : type === 'warning'
      ? 'alert-warning'
      : 'alert-info';

  const icon =
    type === 'danger' || type === 'error'
      ? '⚠️'
      : type === 'success'
      ? '✓'
      : type === 'warning'
      ? '⚡'
      : 'ℹ️';

  return (
    <div
      className={`alert ${alertTypeClass} ${className}`.trim()}
      role="alert"
      data-testid={testId}
    >
      <div className="alert-content-wrap">
        <span className="alert-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="alert-text-group">
          {title && <strong className="alert-title">{title} </strong>}
          <span className="alert-message">{message}</span>
        </div>
      </div>

      <div className="alert-actions-wrap">
        {onRetry && (
          <button
            type="button"
            className="btn btn-sm btn-outline alert-retry-btn"
            onClick={onRetry}
          >
            {retryText}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className="alert-close-btn"
            onClick={onDismiss}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
