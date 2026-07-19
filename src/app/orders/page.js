'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ChevronLeft, Package } from 'lucide-react';

export default function OrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [indexError, setIndexError] = useState(false);

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

  if (!user) {
    return <LoadingSpinner fullPage={true} text="Checking auth..." />;
  }

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'center' }}>
        <button 
          onClick={() => router.push('/profile')} 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.8rem', background: '#f5f5f5', border: 'none', borderRadius: '20px' }}
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
                  </div>
                )}

                <div className="order-card-footer">
                  <div className="text-secondary text-sm">Total Amount</div>
                  <div className="order-total">₱{order.total}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
