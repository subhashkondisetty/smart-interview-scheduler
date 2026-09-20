import React from 'react';

/**
 * Standardized KPI / Metric Stat Card
 *
 * @param {Object} props
 * @param {string|React.ReactNode} [props.icon] - Emoji or icon component
 * @param {string} props.label - KPI label
 * @param {string|number} props.value - Metric value
 * @param {string} [props.subtext] - Explanatory subtitle
 * @param {'default'|'primary'|'success'|'warning'|'danger'} [props.variant='default'] - Color accent
 * @param {string} [props.testId] - Optional data-testid
 * @param {string} [props.className] - Additional CSS classes
 */
const StatCard = ({
  icon,
  label,
  value,
  subtext,
  variant = 'default',
  testId,
  className = '',
}) => {
  const valueColorClass =
    variant === 'success'
      ? 'text-success'
      : variant === 'warning'
      ? 'text-warning'
      : variant === 'danger'
      ? 'text-danger'
      : variant === 'primary'
      ? 'text-primary'
      : '';

  return (
    <div className={`kpi-card ${className}`.trim()} data-testid={testId}>
      {icon && (
        <div className="kpi-icon-wrap" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="kpi-details">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-value ${valueColorClass}`.trim()}>{value}</span>
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </div>
  );
};

export default StatCard;
