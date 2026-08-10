'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Terms of Service
        </h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bantayan Hive • Official Policy</span>
      </div>

      {/* Policy Card */}
      <div className="card" style={{ padding: '28px', lineHeight: 1.7, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
              <FileText size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Terms of Service</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last updated: August 8, 2026</span>
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
      </div>
    </div>
  );
}
