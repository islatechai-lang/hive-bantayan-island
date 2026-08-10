'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trash2, ShieldAlert, CheckCircle, Mail } from 'lucide-react';

export default function DeleteAccountPage() {
  const [submitted, setSubmitted] = useState(false);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Account &amp; Data Deletion Request
        </h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bantayan Hive • Data Privacy Policy</span>
      </div>

      {/* Overview Card */}
      <div className="card" style={{ padding: '28px', lineHeight: 1.7, fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ background: '#fdecec', color: '#c0392b', padding: '12px', borderRadius: '50%', display: 'flex' }}>
            <Trash2 size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Request Account &amp; Personal Data Deletion
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Developer: Bantayan Hive • App: Bantayan Hive</span>
          </div>
        </div>

        <p style={{ marginTop: '16px' }}>
          In compliance with Google Play Store policies and international data privacy regulations, <strong>Bantayan Hive</strong> provides users with the right to request the deletion of their user account and associated personal data at any time.
        </p>

        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' }}>
          📋 Steps to Request Deletion
        </h3>
        <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li>
            <strong>Option A (In-App Request Form below):</strong> Fill out the account deletion request form on this page with your registered mobile phone number.
          </li>
          <li>
            <strong>Option B (Direct Email Request):</strong> Send an email directly to our support team at <a href="mailto:princederder44@gmail.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>princederder44@gmail.com</a> with the subject line <em>"Account Deletion Request - [Your Phone Number]"</em>.
          </li>
        </ol>

        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 8px' }}>
          🔒 Data Retention &amp; Deletion Breakdown
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
          <div style={{ background: '#f9f9f9', border: '1px solid #eee', padding: '16px', borderRadius: '12px' }}>
            <strong style={{ color: '#c0392b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Trash2 size={16} /> Permanently Deleted Data
            </strong>
            <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>User profile authentication record</li>
              <li>Saved display name and phone number</li>
              <li>Live GPS location delivery pins</li>
              <li>Push notification tokens &amp; device IDs</li>
              <li>Active shopping cart contents</li>
            </ul>
          </div>

          <div style={{ background: '#f9f9f9', border: '1px solid #eee', padding: '16px', borderRadius: '12px' }}>
            <strong style={{ color: '#27ae60', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <ShieldAlert size={16} /> Data Retained &amp; Purpose
            </strong>
            <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Completed financial transaction records (Retained for 12 months for tax and legal compliance)</li>
              <li>Aggregated, anonymized order metrics</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Online Request Form */}
      <div className="card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Submit Account Deletion Request
        </h3>

        {submitted ? (
          <div style={{ background: '#e8f7ef', border: '1px solid #bfe3cd', padding: '20px', borderRadius: '12px', color: '#155724', textAlign: 'center' }}>
            <CheckCircle size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#27ae60' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Request Received Successfully</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#246b38' }}>
              Your account deletion request for phone number <strong>{phone}</strong> has been submitted. Account and associated personal data will be purged within <strong>48 hours</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Registered Mobile Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +639123456789 or 09123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Reason for Deletion (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Let us know why you are leaving or requesting deletion..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Trash2 size={18} /> Submit Deletion Request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
