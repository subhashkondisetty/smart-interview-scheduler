import React from 'react';

/**
 * Accessible Loading Spinner component
 *
 * @param {Object} props
 * @param {string} [props.text='Loading...'] - Text displayed next to or below spinner
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Spinner size
 * @param {boolean} [props.fullPage=false] - Whether to render as full-page / container centered
 * @param {string} [props.testId] - Optional data-testid
 * @param {string} [props.className] - Additional CSS classes
 */
const LoadingSpinner = ({
  text = 'Loading...',
  size = 'md',
  fullPage = false,
  testId,
  className = '',
}) => {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : '';

  return (
    <div
      className={`${fullPage ? 'auth-loading-screen' : 'loading-container'} ${className}`.trim()}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <div className={`spinner ${sizeClass}`.trim()} aria-hidden="true" />
      {text && <p className="loading-text">{text}</p>}
      <span className="sr-only">{text || 'Loading'}</span>
    </div>
  );
};

export default LoadingSpinner;
