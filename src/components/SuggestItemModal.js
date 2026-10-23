'use client';

import React, { useState } from 'react';
import { X, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function SuggestItemModal({ isOpen, onClose }) {
  const { user, dbUser } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('shake');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(dbUser?.name || user?.displayName || '');
  const [phone, setPhone] = useState(user?.phoneNumber || dbUser?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a flavor or item name!', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Get or create persistent guest ID
      let guestId = '';
      if (!user) {
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
          category,
          notes: notes.trim(),
          userName: name.trim() || (user ? 'Valued Customer' : 'Anonymous Island Foodie'),
          userPhone: phone.trim(),
          userId: user?.uid || null,
          guestId: guestId || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        showToast(`Suggestion submitted! Thank you for the sweet idea! 💡`, 'success');
      } else {
        showToast(data.error || 'Failed to submit suggestion', 'error');
      }
    } catch (err) {
      console.error('Error submitting suggestion:', err);
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setNotes('');
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="product-modal-backdrop" onClick={handleResetAndClose} style={{ zIndex: 1100 }}>
      <div 
        className="product-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: 0, overflow: 'hidden' }}
      >
        <button 
          className="product-modal-close" 
          onClick={handleResetAndClose} 
          aria-label="Close modal"
          style={{ top: '14px', right: '14px', zIndex: 10 }}
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: 'rgba(34, 197, 94, 0.12)', 
              color: '#16a34a',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              We Got Your Suggestion! 🎉
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              Thank you for suggesting <strong>"{title}"</strong>! Our team reviews every idea to bring the sweetest treats to Bantayan Island.
            </p>
            <button
              onClick={handleResetAndClose}
              className="btn btn-primary btn-block btn-pill"
              style={{ padding: '12px' }}
            >
              Back to Menu
            </button>
          </div>
        ) : (
          <div>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(196, 98, 45, 0.12) 0%, rgba(232, 117, 138, 0.12) 100%)', 
              padding: '24px 20px 18px',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                <Sparkles size={16} />
                <span>CUSTOMER WISHLIST</span>
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Suggest a Flavor or Item 💡
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                Craving something special? Tell us what milkshake flavor, drink, or dessert you want us to make next!
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  What kind of treat?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'shake', label: '🥤 Milkshake', desc: 'Thick & Creamy' },
                    { id: 'coffee', label: '☕ Iced Coffee / Drink', desc: 'Cold & Refreshing' },
                    { id: 'cake', label: '🍰 Tiramisu / Cake', desc: 'Artisanal Dessert' },
                    { id: 'other', label: '✨ Other Treat', desc: 'Special Snack' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        border: category === cat.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: category === cat.id ? 'rgba(196, 98, 45, 0.08)' : 'var(--bg-secondary)',
                        color: category === cat.id ? 'var(--accent)' : 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: category === cat.id ? 700 : 500,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>{cat.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{cat.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Flavor / Item Name Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Flavor / Item Name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Mango Graham Shake, Ube Tiramisu..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.92rem',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Notes / Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Notes / Recipe Ideas (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Less sweet with extra toppings, or served in a bottle!"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.88rem',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Contact info (Optional) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Mobile No. (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0917..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-block btn-pill"
                style={{
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px'
                }}
              >
                <Send size={16} />
                {submitting ? 'Submitting Idea...' : 'Submit Suggestion ✨'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
