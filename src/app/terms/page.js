'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, FileText, ArrowLeft } from 'lucide-react';

export default function TermsAndPolicyPage() {
  const [activeTab, setActiveTab] = useState('terms'); // 'terms' | 'privacy'

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link 
          href="/" 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '20px', padding: '8px 14px' }}
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Terms &amp; Privacy Policy
          </h1>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bantayan Hive • Official Policy Page</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="category-tabs mb-lg" style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setActiveTab('terms')}
          className={`category-tab ${activeTab === 'terms' ? 'active' : ''}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', fontWeight: 700 }}
        >
          <FileText size={18} /> Terms of Service
        </button>
        <button 
          onClick={() => setActiveTab('privacy')}
          className={`category-tab ${activeTab === 'privacy' ? 'active' : ''}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', fontWeight: 700 }}
        >
          <ShieldCheck size={18} /> Privacy Policy
        </button>
      </div>

      {/* Policy Card */}
      <div className="card" style={{ padding: '28px', lineHeight: 1.7, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
        {activeTab === 'terms' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                <FileText size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Terms of Service</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last updated: 2026</span>
              </div>
            </div>

            <p>Welcome to Bantayan Hive. By placing an order, registering an account, or using our delivery services, you agree to comply with and be bound by the following terms and conditions:</p>
            
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>1. Delivery Services</h3>
            <p style={{ margin: 0 }}>We deliver fresh handcrafted tiramisu cakes and creamy milkshakes directly to your doorstep or hotel across Bantayan Island. Delivery times may vary slightly based on weather, traffic, and road conditions.</p>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>2. Payment Methods</h3>
            <p style={{ margin: 0 }}>We accept Cash on Delivery (COD) and GCash e-wallet payments. For GCash orders, a valid transaction receipt screenshot must be uploaded during checkout for admin verification.</p>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>3. Order Cancellations &amp; Refunds</h3>
            <p style={{ margin: 0 }}>You may request order cancellations while your order status is set to "Pending" or "Preparing". Orders already marked "Out for Delivery" cannot be cancelled as items are already in transit.</p>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>4. Product Care &amp; Quality</h3>
            <p style={{ margin: 0 }}>All tiramisu slices and milkshakes are prepared fresh to order. Please store tiramisu cakes in a refrigerator upon arrival for optimal taste and quality.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                <ShieldCheck size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Privacy Policy</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last updated: 2026</span>
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
        )}
      </div>
    </div>
  );
}
