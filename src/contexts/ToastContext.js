'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext({});

function ToastItem({ toast, onDismiss }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startXRef.current;
    currentXRef.current = diff;
    setDragX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(currentXRef.current) > 55) {
      setIsDismissed(true);
      setTimeout(() => {
        onDismiss(toast.id);
      }, 180);
    } else {
      setDragX(0);
    }
  };

  const opacity = isDismissed ? 0 : Math.max(0.2, 1 - Math.abs(dragX) / 180);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: isDismissed 
          ? `translateX(${currentXRef.current > 0 ? 120 : -120}%)` 
          : `translateX(${dragX}px)`,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        touchAction: 'pan-y',
        userSelect: 'none',
      }}
      className={`toast toast-${toast.type}`}
    >
      <div className="toast-icon-wrapper">
        {toast.type === 'success' && <CheckCircle2 size={16} strokeWidth={2.5} />}
        {toast.type === 'error' && <AlertCircle size={16} strokeWidth={2.5} />}
        {toast.type === 'warning' && <AlertTriangle size={16} strokeWidth={2.5} />}
        {toast.type === 'info' && <Info size={16} strokeWidth={2.5} />}
      </div>
      <div className="toast-message">{toast.message}</div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 3200) => {
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
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
