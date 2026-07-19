'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '../../../../contexts/ToastContext';
import DeliveryMap from '../../../../components/DeliveryMap';
import LoadingSpinner from '../../../../components/LoadingSpinner';

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
        showToast('Error loading delivery coordinates', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [params.id, router, showToast]);

  const handleMarkDelivered = async () => {
    setUpdating(true);
    try {
      // Trigger PATCH route to update Firestore & send OneSignal push notification
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
    return <LoadingSpinner fullPage={true} text="Loading delivery route coordinates..." />;
  }

  if (!order) return null;

  return (
    <div className="page-no-nav">
      <div className="page-header">
        <div>
          <button onClick={() => router.push('/admin')} className="btn btn-secondary btn-sm mb-sm">
            ⬅️ Back to Admin Dashboard
          </button>
          <h1 className="page-title">Delivery Route Navigation</h1>
          <p className="page-subtitle">Order #{order.id.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <div className="card mb-md">
        <h3 className="section-title">Delivery Details</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
          <div>
            <strong>Customer:</strong> {order.userName}
          </div>
          <div>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${order.userPhone}`} style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 'bold' }}>
              {order.userPhone} (Call Customer 📞)
            </a>
          </div>
          <div>
            <strong>Address:</strong>
            <p className="text-secondary mt-xs">{order.address}</p>
          </div>
          {order.addressNotes && (
            <div>
              <strong>Delivery Notes:</strong>
              <p className="text-secondary mt-xs"><em>&ldquo;{order.addressNotes}&rdquo;</em></p>
            </div>
          )}
          <div>
            <strong>Payment Method:</strong> {order.paymentMethod.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Map showing pin coordinates and navigation link */}
      <div className="card mb-lg">
        <h3 className="section-title">Visual Map Guide</h3>
        <DeliveryMap location={order.location} address={order.address} />
      </div>

      <button
        onClick={handleMarkDelivered}
        className="btn btn-primary btn-block btn-pill btn-lg mb-xl"
        disabled={updating || order.status === 'delivered'}
      >
        {updating ? 'Updating...' : 'Mark as Delivered 🏁'}
      </button>
    </div>
  );
}
