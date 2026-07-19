'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '../../../../contexts/ToastContext';
import DeliveryMap from '../../../../components/DeliveryMap';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { ChevronLeft, CheckCircle } from 'lucide-react';

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Authenticate driver view (uses same sessionStorage as admin)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('hive_admin_authenticated');
      if (isAuth !== 'true') {
        showToast('Unauthorized access. Please login.', 'error');
        router.push('/admin');
      }
    }
  }, [router, showToast]);

  useEffect(() => {
    async function fetchOrder() {
      if (!params.id) return;
      try {
        const docRef = doc(db, 'orders', params.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        } else {
          showToast('Order not found', 'error');
          router.push('/admin');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        showToast('Error loading delivery', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [params.id, router, showToast]);

  const handleMarkDelivered = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' })
      });

      if (!res.ok) throw new Error('Status API error');

      showToast('Delivery marked as Delivered!', 'success');
      router.push('/admin');
    } catch (error) {
      console.error(error);
      showToast('Failed to update delivery status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage={true} text="Loading delivery..." />;
  }

  if (!order) return null;

  return (
    <div className="page-no-nav">
      <div className="page-header" style={{ alignItems: 'center' }}>
        <button 
          onClick={() => router.push('/admin')} 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.8rem', background: '#f5f5f5', border: 'none', borderRadius: '20px' }}
        >
          <ChevronLeft size={16} /> Dashboard
        </button>
        <div style={{ flex: 1, textAlign: 'center', marginRight: '80px' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Delivery</h1>
          <p className="text-secondary text-sm">Order #{order.id.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      {/* Order summary card */}
      <div className="card mb-md">
        <h3 className="section-title">Order Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
          <div><strong>Customer:</strong> {order.userName}</div>
          <div><strong>Payment:</strong> {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'GCash'}</div>
          <div><strong>Total:</strong> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>₱{order.total}</span></div>
          {order.riderNote && (
            <div style={{ marginTop: '4px', padding: '8px 12px', background: 'var(--card-bg-accent)', borderRadius: '8px', fontSize: '13px' }}>
              <strong>Rider Note:</strong> <em>{order.riderNote}</em>
            </div>
          )}
          {/* Legacy addressNotes support */}
          {order.addressNotes && !order.riderNote && (
            <div style={{ marginTop: '4px', padding: '8px 12px', background: 'var(--card-bg-accent)', borderRadius: '8px', fontSize: '13px' }}>
              <strong>Delivery Notes:</strong> <em>{order.addressNotes}</em>
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <strong>Items:</strong>
          {order.items?.map((item, idx) => (
            <div key={idx} style={{ padding: '2px 0' }}>
              {item.quantity}× {item.name} — ₱{item.price * item.quantity}
            </div>
          ))}
        </div>
      </div>

      {/* Live Navigation Map — shows buyer's live pin + rider's blue dot */}
      <div className="card mb-lg">
        <h3 className="section-title">Live Navigation</h3>
        <DeliveryMap
          location={order.location}
          buyerUserId={order.userId}
          buyerName={order.userName}
          buyerPhone={order.userPhone}
        />
      </div>

      <button
        onClick={handleMarkDelivered}
        className="btn btn-primary btn-block btn-pill btn-lg mb-xl"
        disabled={updating || order.status === 'delivered'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
      >
        <CheckCircle size={20} />
        {updating ? 'Updating...' : order.status === 'delivered' ? 'Already Delivered' : 'Mark as Delivered'}
      </button>
    </div>
  );
}
