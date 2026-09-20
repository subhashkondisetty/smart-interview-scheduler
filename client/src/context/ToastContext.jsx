import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newToast = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (msg, duration) => addToast(msg, 'success', duration),
      error: (msg, duration) => addToast(msg, 'error', duration),
      info: (msg, duration) => addToast(msg, 'info', duration),
      warning: (msg, duration) => addToast(msg, 'warning', duration),
      show: addToast,
      remove: removeToast,
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Global Floating Toast Container */}
      <div className="toast-container" data-testid="toast-container" aria-live="polite">
        {toasts.map((t) => {
          const typeIcon =
            t.type === 'success'
              ? '✓'
              : t.type === 'error'
              ? '✕'
              : t.type === 'warning'
              ? '⚠️'
              : 'ℹ️';

          return (
            <div
              key={t.id}
              className={`toast-item toast-${t.type}`}
              data-testid="toast-item"
              role="alert"
            >
              <span className="toast-icon">{typeIcon}</span>
              <span className="toast-message" data-testid="toast-message">
                {t.message}
              </span>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => removeToast(t.id)}
                data-testid="toast-close"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
