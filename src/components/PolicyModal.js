'use client';

import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

export default function PolicyModal({ type, onClose }) {
  if (!type) return null;

  const isTerms = type === 'terms';

  return (
    <div className="product-modal-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="product-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '24px' }}>
        <button className="product-modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', padding: '10px', borderRadius: '50%', display: 'flex' }}>
            {isTerms ? <FileText size={24} /> : <ShieldCheck size={24} />}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {isTerms ? 'Terms of Service' : 'Privacy Policy'}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bantayan Hive • Updated 2026</span>
          </div>
        </div>

        <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
          {isTerms ? (
            <>
              <p>Welcome to Bantayan Hive. By placing an order or creating an account on our platform, you agree to the following terms:</p>
              
              <strong style={{ color: 'var(--text-primary)' }}>1. Delivery Services</strong>
              <p style={{ margin: 0 }}>We deliver fresh handcrafted tiramisu cakes and creamy milkshakes directly to your doorstep or hotel across Bantayan Island. Delivery times may vary slightly based on weather and road conditions.</p>

              <strong style={{ color: 'var(--text-primary)' }}>2. Payment Methods</strong>
              <p style={{ margin: 0 }}>We accept Cash on Delivery (COD) and GCash e-wallet payments. For GCash orders, a valid transaction receipt screenshot must be uploaded during checkout.</p>

              <strong style={{ color: 'var(--text-primary)' }}>3. Order Cancellations</strong>
              <p style={{ margin: 0 }}>You may request order cancellations while your status is set to "Preparing". Orders already marked "Out for Delivery" cannot be cancelled.</p>

              <strong style={{ color: 'var(--text-primary)' }}>4. Product Quality</strong>
              <p style={{ margin: 0 }}>All tiramisu slices and milkshakes are prepared fresh to order. Please store cakes in a refrigerator upon arrival for optimal taste.</p>
            </>
          ) : (
            <>
              <p>Your privacy is extremely important to us at Bantayan Hive. This policy outlines how we collect and safeguard your personal information:</p>

              <strong style={{ color: 'var(--text-primary)' }}>1. Information We Collect</strong>
              <p style={{ margin: 0 }}>We collect your mobile phone number (for SMS authentication), your display name, and your live GPS delivery pin to ensure accurate courier navigation.</p>

              <strong style={{ color: 'var(--text-primary)' }}>2. How We Use Your Information</strong>
              <p style={{ margin: 0 }}>Your phone number and location are used exclusively to process your orders, send delivery status updates, and navigate riders to your exact location.</p>

              <strong style={{ color: 'var(--text-primary)' }}>3. Data Protection & Sharing</strong>
              <p style={{ margin: 0 }}>We use secure Firebase Authentication and encrypted connections. We never sell, trade, or expose your personal information to third parties.</p>

              <strong style={{ color: 'var(--text-primary)' }}>4. Location Tracking</strong>
              <p style={{ margin: 0 }}>GPS location tracking is only active while placing an order or tracking a live delivery. You may disable location permissions in your browser or device settings at any time.</p>
            </>
          )}
        </div>

        <button 
          onClick={onClose} 
          className="btn btn-primary btn-block btn-pill mt-lg"
          style={{ padding: '12px' }}
        >
          I Understand &amp; Agree
        </button>
      </div>
    </div>
  );
}
