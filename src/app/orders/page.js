'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, increment } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ChevronLeft, Package, XCircle, AlertTriangle, X } from 'lucide-react';

export default function OrdersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [indexError, setIndexError] = useState(false);

  // Cancellation state
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('Mistake in order items');
  const [customReason, setCustomReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = [];
      querySnapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() });
      });
      setOrders(ordersData);
      setLoading(false);
      setIndexError(false);
    }, (error) => {
      console.error('Error fetching orders:', error);
      setLoading(false);
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        setIndexError(true);
      }
    });

    return () => unsubscribe();
  }, [user, router]);

  const toggleExpand = (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
    }
  };

  // Check if an order is eligible for cancellation by the customer
  // Allowed while pending or preparing, BEFORE a rider has been assigned or out for delivery
  const canCancelOrder = (order) => {
    const isPendingOrPreparing = order.status === 'pending' || order.status === 'preparing';
    const hasNoRider = !order.assignedRiderId && !order.assignedRiderName;
    return isPendingOrPreparing && hasNoRider;
  };

  const handleOpenCancelModal = (e, order) => {
    e.stopPropagation();
    setCancellingOrder(order);
    setCancelReason('Mistake in order items');
    setCustomReason('');
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    setIsSubmittingCancel(true);
    const targetOrder = cancellingOrder;
    const finalReason = cancelReason === 'Other' 
      ? (customReason.trim() || 'Cancelled by customer') 
      : cancelReason;

    try {
      // 1. Direct Firestore write: mark order cancelled and restore item stock
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', targetOrder.id);
      
      batch.update(orderRef, {
        status: 'cancelled',
        cancelledBy: 'customer',
        cancelReason: finalReason,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Restore product stock count
      if (Array.isArray(targetOrder.items)) {
        targetOrder.items.forEach((item) => {
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
      fetch(`/api/orders/${targetOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancelledBy: 'customer',
          cancelReason: finalReason
        })
      }).catch(apiErr => console.warn('Status API notify warning:', apiErr));

      showToast(`Order #${targetOrder.id.slice(-6).toUpperCase()} was cancelled.`, 'info');
      setCancellingOrder(null);
    } catch (err) {
      console.error('Error cancelling order:', err);
      showToast('Failed to cancel order: ' + err.message, 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  if (!user) {
    return <LoadingSpinner fullPage={true} text="Checking auth..." />;
  }

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'center' }}>
        <button 
          onClick={() => router.push('/profile')} 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.8rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '20px' }}
        >
          <ChevronLeft size={16} /> Profile
        </button>
        <h1 className="page-title" style={{ flex: 1, textAlign: 'center', marginRight: '64px' }}>My Orders</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <LoadingSpinner />
        </div>
      ) : indexError ? (
        <div className="card text-center" style={{ padding: '2rem 1.5rem', borderColor: 'var(--error)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>⚙️</span>
          <h3 style={{ color: 'var(--error)', marginBottom: '0.5rem' }}>Database Index Setup Required</h3>
          <p className="text-secondary text-sm">
            Firebase requires a composite index to display your orders. Please contact the administrator or click the link in your console log to create it.
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '6rem', height: '6rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <Package size={36} />
          </div>
          <h2 className="empty-state-title">No orders yet</h2>
          <p className="empty-state-text">Treat yourself to our sweet tiramisu cakes and creamy shakes!</p>
          <button onClick={() => router.push('/')} className="btn btn-primary btn-pill">
            Order Now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const date = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const cancellable = canCancelOrder(order);

            return (
              <div key={order.id} className="order-card" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(order.id)}>
                <div className="order-card-header">
                  <div>
                    <div className="order-number">Order #{order.id.slice(-6).toUpperCase()}</div>
                    <div className="order-date">{date}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="order-items-summary">
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ padding: '0.25rem 0' }}>
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--divider)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div>
                      <strong>Delivery Address:</strong>
                      <p className="text-secondary mt-xs">{order.address}</p>
                      {order.addressNotes && (
                        <p className="text-secondary mt-xs"><em>Note: {order.addressNotes}</em></p>
                      )}
                    </div>
                    <div>
                      <strong>Payment Method:</strong>{' '}
                      <span className="text-secondary">
                        {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'GCash'}
                      </span>
                    </div>
                    {order.paymentMethod === 'gcash' && order.gcashReceiptUrl && (
                      <div>
                        <strong>GCash Receipt:</strong>
                        <a href={order.gcashReceiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--accent)', textDecoration: 'underline', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
                          View Uploaded Screenshot 📸
                        </a>
                      </div>
                    )}

                    {/* Rider assignment notice */}
                    {order.assignedRiderName && (
                      <div style={{ background: 'var(--success-bg)', padding: '8px 12px', borderRadius: '8px', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '12px', fontWeight: 600 }}>
                        🛵 Rider assigned: <strong>{order.assignedRiderName}</strong>
                      </div>
                    )}

                    {/* Cancelled notice */}
                    {order.status === 'cancelled' && (
                      <div style={{ background: 'var(--error-bg)', padding: '8px 12px', borderRadius: '8px', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '12px' }}>
                        <strong>Order was cancelled {order.cancelledBy === 'customer' ? 'by you' : 'by store'}</strong>
                        {order.cancelReason && (
                          <div style={{ marginTop: '2px', opacity: 0.9 }}>Reason: "{order.cancelReason}"</div>
                        )}
                      </div>
                    )}

                    {/* Cancellation eligibility note */}
                    {cancellable && (
                      <div style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border)', padding: '10px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Need to change items or address? You can cancel before a rider is dispatched.
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleOpenCancelModal(e, order)}
                          className="btn btn-sm"
                          style={{
                            background: 'var(--error-bg)',
                            color: 'var(--error)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '20px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <XCircle size={14} /> Cancel Order
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="order-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="text-secondary text-sm">Total Amount</div>
                    <div className="order-total">₱{order.total}</div>
                  </div>

                  {/* Quick Cancel button visible even when card collapsed if eligible */}
                  {cancellable && !isExpanded && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenCancelModal(e, order)}
                      className="btn btn-sm"
                      style={{
                        background: 'var(--error-bg)',
                        color: 'var(--error)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '20px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Order Cancellation */}
      {cancellingOrder && (
        <div className="product-modal-backdrop" onClick={() => !isSubmittingCancel && setCancellingOrder(null)} style={{ zIndex: 1100 }}>
          <div 
            className="product-modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '380px', padding: '24px 20px', borderRadius: '18px' }}
          >
            <button 
              className="product-modal-close" 
              onClick={() => !isSubmittingCancel && setCancellingOrder(null)} 
              aria-label="Close modal"
              style={{ top: '14px', right: '14px' }}
            >
              <X size={16} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: 'var(--error-bg)', 
                color: 'var(--error)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <AlertTriangle size={24} strokeWidth={2.2} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                Cancel Order #{cancellingOrder.id.slice(-6).toUpperCase()}?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Are you sure you want to cancel this order? If you made a mistake, you can place a new order anytime.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                REASON FOR CANCELLATION
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border)',
                  fontSize: '0.88rem',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                <option value="Mistake in order items">Ordered wrong items / quantities</option>
                <option value="Change delivery address">Need to change delivery location</option>
                <option value="Change payment method">Want to change payment method</option>
                <option value="Changed my mind">Changed my mind / not craving anymore</option>
                <option value="Other">Other reason</option>
              </select>

              {cancelReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Please specify..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.88rem',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    marginTop: '8px'
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                disabled={isSubmittingCancel}
                className="btn btn-secondary btn-block btn-pill"
                style={{ padding: '12px', fontSize: '0.92rem', fontWeight: 600 }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="btn btn-block btn-pill"
                style={{
                  padding: '12px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                }}
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
