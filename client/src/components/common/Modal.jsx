import React, { useEffect, useRef } from 'react';

/**
 * Accessible Modal Dialog Primitive
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is rendered
 * @param {Function} props.onClose - Dismiss handler (Escape key or backdrop click)
 * @param {string} [props.title] - Modal header title
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md'] - Card width tier
 * @param {boolean} [props.danger=false] - Whether this modal conveys destructive action
 * @param {string} [props.testId] - Optional data-testid for the modal
 * @param {string} [props.className] - Additional CSS classes for card
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} [props.footer] - Modal footer content
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  danger = false,
  testId,
  className = '',
  children,
  footer,
}) => {
  const modalRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass =
    size === 'sm'
      ? 'modal-sm'
      : size === 'lg'
      ? 'modal-lg'
      : size === 'xl'
      ? 'modal-xl'
      : '';

  const dangerClass = danger ? 'modal-danger' : '';

  return (
    <div
      className="modal-overlay modal-backdrop booking-modal-overlay"
      onClick={onClose}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal Dialog'}
    >
      <div
        ref={modalRef}
        className={`modal-card modal-dialog booking-modal-card ${sizeClass} ${dangerClass} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button
              type="button"
              className="close-btn modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
