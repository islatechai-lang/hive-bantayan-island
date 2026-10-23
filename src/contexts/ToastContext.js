'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext({});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 3400) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon-wrapper">
              {toast.type === 'success' && <CheckCircle2 size={16} strokeWidth={2.5} />}
              {toast.type === 'error' && <AlertCircle size={16} strokeWidth={2.5} />}
              {toast.type === 'warning' && <AlertTriangle size={16} strokeWidth={2.5} />}
              {toast.type === 'info' && <Info size={16} strokeWidth={2.5} />}
            </div>
            <div className="toast-message">{toast.message}</div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="toast-dismiss-btn"
              aria-label="Dismiss notification"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
