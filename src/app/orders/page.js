'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function OrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

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
    }, (error) => {
      console.error('Error fetching orders:', error);
      setLoading(false);
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
      <div className="page-header">
        <h1 className="page-title">My Orders</h1>
        <span style={{ fontSize: '20px' }}>📋</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <LoadingSpinner />
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🛵</span>
          <h2 className="empty-state-title">No orders yet</h2>
          <p className="empty-state-text">You haven&apos;t placed any orders yet. Treat yourself to a cake now!</p>
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
                    <div key={idx}>
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
                        <a href={order.gcashReceiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--accent)', textDecoration: 'underline', marginTop: '4px' }}>
                          View Uploaded Screenshot
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
