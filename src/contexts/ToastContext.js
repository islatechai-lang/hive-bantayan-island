'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext({});

function ToastItem({ toast, onDismiss }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dismissDirection, setDismissDirection] = useState(null); // 'left' | 'right' | null
  
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const startTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const timerRef = useRef(null);

  const triggerSlideDismiss = useCallback((direction = 'right') => {
    setDismissDirection(direction);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 250);
  }, [onDismiss, toast.id]);

  const startAutoDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      triggerSlideDismiss('right');
    }, toast.duration || 3400);
  }, [toast.duration, triggerSlideDismiss]);

  const pauseAutoDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoDismiss();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startAutoDismiss]);

  const handlePointerDown = (e) => {
    pauseAutoDismiss();
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback if pointer capture fails
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const diff = e.clientX - startXRef.current;
    currentXRef.current = diff;
    setDragX(diff);
  };

  const handlePointerUpOrCancel = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const diff = currentXRef.current;
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = Math.abs(diff) / elapsed; // px per ms

    // If dragged more than 45px or swiped with velocity (> 0.35 px/ms)
    if (Math.abs(diff) > 45 || velocity > 0.35) {
      triggerSlideDismiss(diff >= 0 ? 'right' : 'left');
    } else {
      // Snap back smoothly in a straight line
      setDragX(0);
      startAutoDismiss();
    }
  };

  // Pure horizontal slide without any tilt/rotation
  let transform = 'translateX(0)';
  let opacity = 1;

  if (dismissDirection === 'right') {
    transform = 'translateX(120%)';
    opacity = 0;
  } else if (dismissDirection === 'left') {
    transform = 'translateX(-120%)';
    opacity = 0;
  } else if (isDragging || dragX !== 0) {
    transform = `translateX(${dragX}px)`;
    opacity = Math.max(0.15, 1 - Math.abs(dragX) / 240);
  }

  const transition = isDragging
    ? 'none'
    : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease';

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onMouseEnter={pauseAutoDismiss}
      onMouseLeave={() => {
        if (!isDraggingRef.current && !dismissDirection) {
          startAutoDismiss();
        }
      }}
      style={{
        transform,
        opacity,
        transition,
        touchAction: 'pan-y',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      className={`toast toast-${toast.type} ${dismissDirection ? 'toast-dismissing' : ''}`}
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

  const showToast = useCallback((message, type = 'success', duration = 3400) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
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
