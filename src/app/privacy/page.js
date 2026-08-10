'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Privacy Policy
        </h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bantayan Hive • Official Policy</span>
      </div>

      {/* Policy Card */}
      <div className="card" style={{ padding: '28px', lineHeight: 1.7, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Privacy Policy</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last updated: August 8, 2026</span>
            </div>
          </div>

          <p>Your privacy is extremely important to us at Bantayan Hive. This policy outlines how we collect, use, and safeguard your personal information:</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>1. Information We Collect</h3>
          <p style={{ margin: 0 }}>We collect your mobile phone number (for SMS authentication), display name, delivery notes, and live GPS delivery coordinates to ensure accurate courier navigation.</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>2. How We Use Your Information</h3>
          <p style={{ margin: 0 }}>Your phone number and location are used exclusively to process your orders, send status updates via push notifications, and navigate delivery riders to your exact location.</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>3. Data Protection &amp; Security</h3>
          <p style={{ margin: 0 }}>We use secure Firebase Authentication and encrypted SSL connections. We never sell, trade, or share your personal information with third parties.</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>4. Location Tracking</h3>
          <p style={{ margin: 0 }}>GPS location tracking is active only while placing an order or tracking a live delivery. You may disable location permissions in your browser settings at any time.</p>
        </div>
      </div>
    </div>
  );
}
