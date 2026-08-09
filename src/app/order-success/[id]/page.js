'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '../../../components/LoadingSpinner';
import StatusBadge from '../../../components/StatusBadge';
import { ShoppingBag, ArrowRight, ShieldCheck, HelpCircle, XCircle } from 'lucide-react';

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    const unsubscribe = onSnapshot(doc(db, 'orders', params.id), (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [params.id]);

  if (loading) {
    return <LoadingSpinner fullPage={true} text="Fetching order details..." />;
  }

  if (!order) {
    return (
      <div className="page text-center py-xl">
        <h2>Order Not Found</h2>
        <button onClick={() => router.push('/')} className="btn btn-primary mt-md">Go to Home</button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="text-center mb-lg">
        {/* Clean Standalone Motorcycle Header */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '3.6rem', lineHeight: 1 }} title="Rider on the way">
            🛵
          </span>
          <span style={{ fontSize: '2.2rem', opacity: 0.85, marginTop: '12px' }}>
            💨
          </span>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          {order.status === 'cancelled' ? 'Order Cancelled' : 'Rider is on its way!'}
        </h1>
        <p className="text-secondary" style={{ fontSize: '1rem', margin: 0 }}>
          {order.status === 'cancelled'
            ? 'This order has been cancelled by admin.'
            : 'Your order has been received and your rider will arrive in 10-20 mins!'}
        </p>
      </div>

      {/* GCash Payment Notice */}
      {order.paymentMethod === 'gcash' && (
        <div 
          className="card" 
          style={{ 
            background: order.status === 'cancelled' ? '#fdecec' : (order.status === 'pending' ? '#fdf8e2' : '#f0fbf5'), 
            border: order.status === 'cancelled' ? '1px solid #f8c0c0' : (order.status === 'pending' ? '1px solid #fbeeb5' : '1px solid #c3e6cb'), 
            marginBottom: '1.5rem',
            padding: '1rem' 
          }}
        >
          {order.status === 'cancelled' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <XCircle style={{ color: '#c0392b' }} size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#c0392b', fontSize: '14px', display: 'block' }}>Payment Rejected / Cancelled</strong>
                <span style={{ color: '#900c3f', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  This order was cancelled. If you believe this was an error, please contact store support.
                </span>
              </div>
            </div>
          ) : order.status === 'pending' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <HelpCircle style={{ color: '#856404' }} size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#856404', fontSize: '14px', display: 'block' }}>Payment Under Review</strong>
                <span style={{ color: '#997305', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  Receipt received! We will confirm your order shortly.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <ShieldCheck className="text-success" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#155724', fontSize: '14px', display: 'block' }}>Payment Confirmed</strong>
                <span style={{ color: '#246b38', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  Your GCash payment receipt was confirmed! Your order is being processed.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Status Card */}
      <div className="card mb-md">
        <h3 className="section-title">Order Status</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Order #{order.id.slice(-6).toUpperCase()}</div>
            <div className="text-secondary text-xs" style={{ marginTop: '2px' }}>
              Placed at: {new Date(order.createdAt).toLocaleTimeString()}
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Order details summary */}
      <div className="card mb-lg">
        <h3 className="section-title">Items Ordered</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span className="text-secondary">
                <strong style={{ color: 'var(--text-primary)' }}>{item.quantity}x</strong> {item.name}
              </span>
              <span style={{ fontWeight: 600 }}>₱{item.price * item.quantity}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--divider)', marginTop: '6px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total Payment ({order.paymentMethod.toUpperCase()})</span>
            <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>₱{order.total}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button 
          onClick={() => router.push('/orders')} 
          className="btn btn-primary btn-block btn-pill btn-lg"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          Track All Orders <ArrowRight size={18} />
        </button>
        <button 
          onClick={() => router.push('/')} 
          className="btn btn-ghost btn-block"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
