import React from 'react';
import Modal from './Modal';

/**
 * Specialized Confirmation Modal for Destructive or Important Actions
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Cancel handler
 * @param {Function} props.onConfirm - Confirm handler
 * @param {string} props.title - Modal title
 * @param {string|React.ReactNode} props.message - Main question or statement
 * @param {string} [props.confirmText='Confirm'] - Label on confirm button
 * @param {string} [props.cancelText='Cancel'] - Label on cancel button
 * @param {boolean} [props.isDestructive=true] - Whether confirm button is danger styled
 * @param {boolean} [props.loading=false] - Whether action is currently in-flight
 * @param {string|React.ReactNode} [props.warningDetails] - Warning text or list of side effects
 * @param {string} [props.confirmTestId] - data-testid for confirm button
 * @param {string} [props.testId] - data-testid for modal container
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  loading = false,
  warningDetails,
  confirmTestId,
  testId,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      danger={isDestructive}
      testId={testId}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
            data-testid={confirmTestId}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </>
      }
    >
      <div className="confirm-modal-content">
        <p className="confirm-message">{message}</p>
        {warningDetails && (
          <div className={`modal-alert-${isDestructive ? 'warning' : 'info'} mt-3`}>
            {warningDetails}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmModal;
