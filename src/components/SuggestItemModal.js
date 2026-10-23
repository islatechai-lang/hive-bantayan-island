'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function SuggestItemModal({ isOpen, onClose }) {
  const { user, dbUser } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

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

      const res = await fetch('/api/coming-soon/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: 'request',
          notes: '',
          userName: dbUser?.name || user?.displayName || 'Customer',
          userPhone: user?.phoneNumber || dbUser?.phone || '',
          userId: user?.uid || null,
          guestId: guestId || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        showToast('Request received! Thank you.', 'success');
        setTimeout(() => {
          setTitle('');
          setSubmitted(false);
          onClose();
        }, 1200);
      } else {
        showToast(data.error || 'Failed to submit request', 'error');
      }
    } catch (err) {
      console.error('Error submitting suggestion:', err);
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setSubmitted(false);
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
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ 
              width: '44px', 
              height: '44px', 
              borderRadius: '50%', 
              background: '#ecfdf5', 
              color: '#059669',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <Check size={22} strokeWidth={2.5} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              Request Received
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              We'll consider "{title}" for our menu!
            </p>
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
