'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '../../../components/LoadingSpinner';
import StatusBadge from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import { ArrowRight, ShieldCheck, HelpCircle, XCircle } from 'lucide-react';

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
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

  const isCancelled = order.status === 'cancelled';

  return (
    <div className="page">
      <div className="text-center mb-lg">
        {/* Header Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', marginBottom: '0.75rem' }}>
          {isCancelled ? (
            <span style={{ fontSize: '3.6rem', lineHeight: 1 }} title="Order Cancelled">
              🛑
            </span>
          ) : (
            <>
              <span style={{ fontSize: '3.6rem', lineHeight: 1 }} title="Rider on the way">
                🛵
              </span>
              <span style={{ fontSize: '2.2rem', opacity: 0.85, marginTop: '12px' }}>
                💨
              </span>
            </>
          )}
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          {isCancelled ? 'Order Cancelled' : 'Rider is on its way!'}
        </h1>
        <p className="text-secondary" style={{ fontSize: '1rem', margin: 0 }}>
          {isCancelled
            ? (order.cancelledBy === 'customer' 
                ? 'This order was cancelled by you.' 
                : 'This order has been cancelled by the store/admin.')
            : 'Your order has been received and your rider will arrive in 10-20 mins!'}
        </p>

        {isCancelled && order.cancelReason && (
          <div style={{ marginTop: '0.6rem', display: 'inline-block', background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            Reason: {order.cancelReason}
          </div>
        )}
      </div>

      {/* GCash Payment Notice */}
      {order.paymentMethod === 'gcash' && (
        <div 
          className="card" 
          style={{ 
            background: isCancelled ? 'var(--error-bg)' : (order.status === 'pending' ? 'var(--warning-bg)' : 'var(--success-bg)'), 
            border: `1px solid ${isCancelled ? 'var(--error)' : (order.status === 'pending' ? 'var(--warning)' : 'var(--success)')}`, 
            marginBottom: '1.5rem',
            padding: '1rem' 
          }}
        >
          {isCancelled ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <XCircle size={20} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--error)', fontSize: '14px', display: 'block' }}>Payment Cancelled / Order Voided</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  This order was cancelled. If you already sent GCash payment, please reach out to our store support.
                </span>
              </div>
            </div>
          ) : order.status === 'pending' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <HelpCircle size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--warning)', fontSize: '14px', display: 'block' }}>Payment Under Review</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  Receipt received! We will confirm your order shortly.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <ShieldCheck size={20} className="text-success" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--success)', fontSize: '14px', display: 'block' }}>Payment Confirmed</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
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
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total Payment ({order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD'})</span>
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
