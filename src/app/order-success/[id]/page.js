'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot, writeBatch, increment } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '../../../components/LoadingSpinner';
import StatusBadge from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import { ArrowRight, ShieldCheck, HelpCircle, XCircle, AlertTriangle } from 'lucide-react';

const CANCEL_REASONS = [
  'Mistake in order items',
  'Need to change delivery address / info',
  'Change of mind',
  'Ordered by accident',
  'Other'
];

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cancellation modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Mistake in order items');
  const [customReason, setCustomReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

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

  // Check if an order is eligible for cancellation by the customer
  // Allowed while pending or preparing, BEFORE a rider has been assigned or out for delivery
  const canCancelOrder = (ord) => {
    if (!ord) return false;
    const isPendingOrPreparing = ord.status === 'pending' || ord.status === 'preparing';
    const hasNoRider = !ord.assignedRiderId && !ord.assignedRiderName;
    return isPendingOrPreparing && hasNoRider;
  };

  const handleConfirmCancel = async () => {
    if (!order) return;
    setIsSubmittingCancel(true);
    const finalReason = cancelReason === 'Other' 
      ? (customReason.trim() || 'Cancelled by customer') 
      : cancelReason;

    try {
      // 1. Direct Firestore write: mark order cancelled and restore item stock
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', order.id);

      batch.update(orderRef, {
        status: 'cancelled',
        cancelledBy: 'customer',
        cancelReason: finalReason,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Restore product stock count
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          if (item.id && item.quantity) {
            const productRef = doc(db, 'products', item.id);
            batch.update(productRef, {
              stock: increment(item.quantity)
            });
          }
        });
      }

      await batch.commit();

      // 2. Trigger status API route to notify admin and send push notification
      fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancelledBy: 'customer',
          cancelReason: finalReason
        })
      }).catch(apiErr => console.warn('Status API notify warning:', apiErr));

      showToast(`Order #${order.id.slice(-6).toUpperCase()} was cancelled.`, 'info');
      setShowCancelModal(false);
    } catch (err) {
      console.error('Error cancelling order:', err);
      showToast('Failed to cancel order: ' + err.message, 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

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
  const cancellable = canCancelOrder(order);

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
          <div style={{ marginTop: '0.6rem', display: 'inline-block', background: '#fdecec', color: '#c0392b', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 500 }}>
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

        {/* Customer Cancel Option if eligible */}
        {cancellable && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-secondary text-xs">
              Made a mistake or changed your mind?
            </span>
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn btn-sm"
              style={{
                background: '#fff0f0',
                color: '#c0392b',
                border: '1px solid #f8d7da',
                borderRadius: '9999px',
                fontWeight: 600,
                padding: '6px 14px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <XCircle size={14} /> Cancel Order
            </button>
          </div>
        )}
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

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => !isSubmittingCancel && setShowCancelModal(false)}
        >
          <div 
            style={{
              background: 'var(--card-bg, #ffffff)',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--divider)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0392b', flexShrink: 0 }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Cancel Order?</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Order #{order.id.slice(-6).toUpperCase()}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Are you sure you want to cancel this order? This action cannot be undone. Reserved items will be restored to store inventory.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Reason for cancellation:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {CANCEL_REASONS.map((reason) => (
                  <label 
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: cancelReason === reason ? '1.5px solid var(--primary, #d35400)' : '1px solid var(--divider)',
                      background: cancelReason === reason ? 'rgba(211, 84, 0, 0.05)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <input 
                      type="radio"
                      name="cancelReason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      style={{ accentColor: 'var(--primary, #d35400)' }}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {cancelReason === 'Other' && (
                <textarea
                  className="input mt-xs"
                  placeholder="Please specify reason..."
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  style={{ width: '100%', fontSize: '13px', marginTop: '8px', padding: '8px' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isSubmittingCancel}
                className="btn btn-ghost"
                style={{ flex: 1, padding: '10px' }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="btn"
                style={{
                  flex: 1,
                  background: '#c0392b',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  padding: '10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
