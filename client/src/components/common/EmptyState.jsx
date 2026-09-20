import React from 'react';

/**
 * Standardized Empty State component
 *
 * @param {Object} props
 * @param {string} [props.icon='📭'] - Emoji or icon character
 * @param {string} props.title - Main heading
 * @param {string} [props.description] - Descriptive text
 * @param {string} [props.actionLabel] - Button label if an action is available
 * @param {Function} [props.onAction] - Button click handler
 * @param {string} [props.actionTestId] - data-testid for action button
 * @param {string} [props.testId] - data-testid for container
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Additional content / custom actions
 */
const EmptyState = ({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  actionTestId,
  testId,
  className = '',
  children,
}) => {
  return (
    <div className={`empty-state card ${className}`.trim()} data-testid={testId}>
      {icon && (
        <span className="empty-icon" role="img" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <h3>{title}</h3>}
      {description && <p className="text-muted">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-primary mt-3"
          data-testid={actionTestId}
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
};

export default EmptyState;
