'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function SuggestItemModal({ isOpen, onClose }) {
  const { user, dbUser } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedItemName, setSubmittedItemName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemTitle = title.trim();
    if (!itemTitle) return;

    setSubmitting(true);
    try {
      let guestId = '';
      if (!user && typeof window !== 'undefined') {
        guestId = localStorage.getItem('hive_guest_id');
        if (!guestId) {
          guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
          localStorage.setItem('hive_guest_id', guestId);
        }
      }

      const payload = {
        title: itemTitle,
        category: 'request',
        notes: '',
        userName: dbUser?.name || user?.displayName || 'Customer',
        userPhone: user?.phoneNumber || dbUser?.phone || '',
        userId: user?.uid || null,
        guestId: guestId || null,
        status: 'new',
        createdAt: serverTimestamp(),
      };

      // 1. Direct write to client Firestore (instant, zero server latency)
      let writeSuccess = false;
      try {
        await addDoc(collection(db, 'suggestions'), payload);
        writeSuccess = true;
      } catch (clientErr) {
        console.warn('Client Firestore write encountered error, falling back to API:', clientErr);
      }

      // 2. If client direct write was blocked, try API endpoint safely
      if (!writeSuccess) {
        try {
          const res = await fetch('/api/coming-soon/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({ success: true }));
            if (data.success) writeSuccess = true;
          }
        } catch (apiErr) {
          console.warn('API fallback error:', apiErr);
        }
      }

      if (!writeSuccess) {
        throw new Error('Failed to record suggestion to database');
      }

      // Success feedback: user stays in control of closing when they are ready
      setSubmittedItemName(itemTitle);
      setSubmitted(true);
      setTitle('');
      showToast('Request received! Thank you.', 'success');
    } catch (err) {
      console.error('Error submitting suggestion:', err);
      showToast('Could not send request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setSubmitted(false);
    setSubmittedItemName('');
    onClose();
  };

  return (
    <div className="product-modal-backdrop" onClick={handleClose} style={{ zIndex: 1100 }}>
      <div 
        className="product-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '380px', padding: '24px 20px', borderRadius: '18px' }}
      >
        <button 
          className="product-modal-close" 
          onClick={handleClose} 
          aria-label="Close modal"
          style={{ top: '14px', right: '14px' }}
        >
          <X size={16} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '50%', 
              background: '#ecfdf5', 
              color: '#059669',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}>
              <Check size={24} strokeWidth={2.5} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              Request Received!
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.45 }}>
              We'll consider adding <strong style={{ color: 'var(--text-primary)' }}>"{submittedItemName}"</strong> to our menu. Thank you for your feedback!
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-primary btn-pill btn-block"
              style={{
                padding: '12px 20px',
                fontSize: '0.92rem',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(196, 98, 45, 0.25)',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              Request an Item
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.4 }}>
              What food or drink would you love to see on Bantayan Hive?
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Smash Burger, Loaded Fries, Mango Shake..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border)',
                  fontSize: '0.92rem',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />

              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="btn btn-primary btn-block btn-pill"
                style={{
                  padding: '12px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  marginTop: '4px',
                  opacity: (!title.trim() || submitting) ? 0.6 : 1,
                  cursor: (!title.trim() || submitting) ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Sending...' : 'Submit Request'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
