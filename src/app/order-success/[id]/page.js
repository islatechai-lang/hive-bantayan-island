'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '../../../components/LoadingSpinner';
import StatusBadge from '../../../components/StatusBadge';
import { ShoppingBag, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

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
    }, (error) => {
      console.error('Error fetching order:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [params.id]);

  if (loading) {
    return <LoadingSpinner fullPage={true} text="Preparing your receipt..." />;
  }

  if (!order) {
    return (
      <div className="page text-center">
        <div style={{ padding: '80px 0' }}>
          <h2>Order Not Found</h2>
          <p className="text-secondary">We couldn't retrieve the details of this order.</p>
          <button onClick={() => router.push('/')} className="btn btn-primary btn-pill mt-md">
            Go to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="text-center mb-lg">
        {/* Custom CSS-animated Checkmark (Plays exactly once) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            display: 'block',
            strokeWidth: '4',
            stroke: '#25cf73',
            strokeMiterlimit: '10',
            boxShadow: 'inset 0px 0px 0px #25cf73',
            animation: 'fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both'
          }}>
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" style={{
              strokeDasharray: '166',
              strokeDashoffset: '166',
              strokeWidth: '4',
              strokeMiterlimit: '10',
              stroke: '#25cf73',
              fill: 'none',
              animation: 'stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards'
            }} />
            <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style={{
              transformOrigin: '50% 50%',
              strokeDasharray: '48',
              strokeDashoffset: '48',
              stroke: '#fff',
              animation: 'stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards'
            }} />
          </svg>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes stroke {
              100% {
                stroke-dashoffset: 0;
              }
            }
            @keyframes scale {
              0%, 100% {
                transform: none;
              }
              50% {
                transform: scale3d(1.1, 1.1, 1);
              }
            }
            @keyframes fill {
              100% {
                box-shadow: inset 0px 0px 0px 40px #25cf73;
              }
            }
          `}} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          Order Received!
        </h1>
        <p className="text-secondary" style={{ fontSize: '1rem', margin: 0 }}>
          Your sweet treats will be delivered in <strong style={{ color: 'var(--accent)' }}>10-20 mins</strong>!
        </p>
      </div>

      {/* AI Verification Notice (For GCash payments) */}
      {order.paymentMethod === 'gcash' && (
        <div 
          className="card" 
          style={{ 
            background: order.status === 'preparing' ? '#f0fbf5' : '#fdf8e2', 
            border: order.status === 'preparing' ? '1px solid #c3e6cb' : '1px solid #fbeeb5', 
            marginBottom: '1.5rem',
            padding: '1rem' 
          }}
        >
          {order.status === 'preparing' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <ShieldCheck className="text-success" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#155724', fontSize: '14px', display: 'block' }}>GCash Auto-Verified</strong>
                <span style={{ color: '#246b38', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  {order.aiVerification?.reason || 'Our AI verified your payment receipt screenshot. Your order is now preparing!'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <HelpCircle style={{ color: '#856404' }} size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#856404', fontSize: '14px', display: 'block' }}>Payment Pending Verification</strong>
                <span style={{ color: '#997305', fontSize: '12px', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  {order.aiVerification?.reason || 'Our AI is reviewing your screenshot. An admin will confirm it shortly.'}
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
