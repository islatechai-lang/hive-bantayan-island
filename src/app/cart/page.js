'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, addDoc, writeBatch, doc, increment } from 'firebase/firestore';
import { supabase } from '../../lib/supabase';
import LiveLocationPreview from '../../components/LiveLocationPreview';
import LoadingSpinner from '../../components/LoadingSpinner';
import Image from 'next/image';
import { ShoppingBag, Upload, ChevronLeft, Minus, Plus, Banknote, Smartphone, MessageSquare, Clock } from 'lucide-react';

export default function CartPage() {
  const { user, dbUser, liveLocation, startTracking, forceLocationSync } = useAuth();
  const { cart, updateQuantity, removeFromCart, getSubtotal, getTotal, clearCart } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [riderNote, setRiderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [refreshingGps, setRefreshingGps] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      showToast('Please sign in to view your cart and checkout', 'info');
      router.push('/login');
    }
  }, [user, router, showToast]);

  // Verify store status
  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      const hour = now.getHours();
      setIsOpen(hour >= 8 && hour < 24);
    };
    checkStoreStatus();
  }, []);

  const handleRefreshGps = async () => {
    setRefreshingGps(true);
    try {
      // Start tracking (if not already) which triggers watchPosition
      startTracking();
      // Give it a moment to get a fresh fix
      await new Promise((r) => setTimeout(r, 2000));
      showToast('Location updated!', 'success');
    } catch (err) {
      showToast('Could not access GPS. Check your device settings.', 'error');
    } finally {
      setRefreshingGps(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    setReceiptFile(file);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
      setReceiptUrl(data.publicUrl);
      showToast('GCash receipt uploaded!', 'success');
    } catch (error) {
      console.error('Error uploading file:', error);
      showToast('Failed to upload receipt. Try again.', 'error');
      setReceiptFile(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!isOpen) {
      showToast('We are currently closed. Orders open at 8 AM.', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    if (!liveLocation) {
      showToast('We need your GPS location to deliver. Please enable GPS.', 'error');
      return;
    }

    if (paymentMethod === 'gcash' && !receiptUrl) {
      showToast('Please upload your GCash payment receipt screenshot', 'error');
      return;
    }

    setSubmittingOrder(true);

    try {
      // Force-sync the latest GPS coordinates to Firestore before placing order
      const freshLocation = await forceLocationSync();

      // COD = auto-confirmed (preparing), GCash = pending until AI verifies
      const initialStatus = paymentMethod === 'cod' ? 'preparing' : 'pending';

      const orderData = {
        userId: user.uid,
        userName: dbUser?.name || 'Customer',
        userPhone: dbUser?.phone || user.phoneNumber || '',
        location: {
          lat: freshLocation.lat,
          lng: freshLocation.lng,
        },
        address: 'Live GPS Location',
        riderNote: riderNote.trim() || '',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category
        })),
        subtotal: getSubtotal(),
        deliveryFee: 0,
        total: getTotal(),
        paymentMethod,
        gcashReceiptUrl: paymentMethod === 'gcash' ? receiptUrl : null,
        status: initialStatus,
        aiVerification: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write directly to Firestore (client-side — always works)
      const docRef = await addDoc(collection(db, 'orders'), orderData);

      // Decrement product stock count atomatically in Firestore
      try {
        const batch = writeBatch(db);
        cart.forEach((item) => {
          const productRef = doc(db, 'products', item.id);
          batch.update(productRef, {
            stock: increment(-item.quantity)
          });
        });
        await batch.commit();
      } catch (stockErr) {
        console.error('Failed to update product stock counts:', stockErr);
      }

      // For GCash, kick off AI receipt verification in the background (fire-and-forget)
      if (paymentMethod === 'gcash' && receiptUrl) {
        fetch('/api/verify-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: docRef.id, gcashReceiptUrl: receiptUrl, total: getTotal() })
        }).catch(err => console.warn('AI verification request failed (non-blocking):', err));
      }
      
      showToast('Order placed! Your rider will navigate to your GPS pin.', 'success');
      clearCart();
      router.push(`/order-success/${docRef.id}`);
    } catch (error) {
      console.error('Error placing order:', error);
      showToast('Failed to place order. Please try again.', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (!user) {
    return <LoadingSpinner fullPage={true} text="Verifying session..." />;
  }

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'center' }}>
        <button 
          onClick={() => router.push('/')} 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.8rem', background: '#f5f5f5', border: 'none', borderRadius: '20px' }}
        >
          <ChevronLeft size={16} /> Menu
        </button>
        <h1 className="page-title" style={{ flex: 1, textAlign: 'center', marginRight: '64px' }}>Checkout</h1>
      </div>

      {!isOpen && (
        <div className="closed-banner">
          <Clock size={20} className="text-accent" />
          <div>
            <div className="closed-banner-text" style={{ fontWeight: 700 }}>We're currently closed</div>
            <div className="closed-banner-hours">Orders can be placed between 8:00 AM and 12:00 AM.</div>
          </div>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '6rem', height: '6rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <ShoppingBag size={36} />
          </div>
          <h2 className="empty-state-title">Your cart is empty</h2>
          <p className="empty-state-text">Browse our menu and satisfy your sweet cravings!</p>
          <button onClick={() => router.push('/')} className="btn btn-primary btn-pill">
            Explore Menu
          </button>
        </div>
      ) : (
        <form onSubmit={handlePlaceOrder} className="flex flex-col gap-lg">
          {/* Cart items */}
          <div className="card">
            <h3 className="section-title">Your Order</h3>
            {cart.map((item) => (
              <div key={item.id} className="cart-item">
                <div style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                  <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                </div>
                <div className="cart-item-info">
                  <h4 className="cart-item-name">{item.name}</h4>
                  <div className="cart-item-price">₱{item.price}</div>
                  <div className="cart-item-actions">
                    <div className="qty-control">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="qty-btn qty-btn-minus">
                        <Minus size={12} strokeWidth={2.5} />
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="qty-btn qty-btn-plus">
                        <Plus size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeFromCart(item.id)} className="cart-item-remove">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live GPS Location Preview */}
          <LiveLocationPreview
            location={liveLocation}
            onRefresh={handleRefreshGps}
            refreshing={refreshingGps}
          />

          {/* Optional rider note */}
          <div className="card">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MessageSquare size={14} className="text-secondary" />
                Note for Rider <span className="text-secondary" style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Gate code 1234, I'm at the parking lot..."
                value={riderNote}
                onChange={(e) => setRiderNote(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="card">
            <h3 className="section-title">Payment Method</h3>
            <div className="payment-options">
              <div 
                className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('cod')}
              >
                <div className="payment-option-icon"><Banknote size={24} /></div>
                <div className="payment-option-name">Cash on Delivery</div>
              </div>
              <div 
                className={`payment-option ${paymentMethod === 'gcash' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('gcash')}
              >
                <div className="payment-option-icon"><Smartphone size={24} /></div>
                <div className="payment-option-name">GCash E-Wallet</div>
              </div>
            </div>

            {paymentMethod === 'gcash' && (
              <div className="gcash-instructions">
                <h4>GCash Payment Steps:</h4>
                <p className="text-sm text-secondary">
                  Send the exact total amount to the GCash account below:
                </p>
                <div className="gcash-number">09454320799</div>
                <div className="gcash-name">Account Name: AL****H M** G.</div>
                <div className="gcash-amount">Total: ₱{getTotal()}</div>
                
                <div className="receipt-upload">
                  <label className="input-label">Upload Receipt Screenshot</label>
                  <input 
                    type="file" 
                    id="receipt-file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleReceiptUpload} 
                  />
                  <label htmlFor="receipt-file" className="receipt-upload-area">
                    <Upload size={28} className="text-secondary mb-xs" />
                    {uploadingReceipt ? (
                      <p>Uploading receipt screenshot...</p>
                    ) : (
                      <p>Click here to attach GCash Receipt Screenshot</p>
                    )}
                  </label>

                  {receiptUrl && (
                    <div className="receipt-preview">
                      <img src={receiptUrl} alt="Receipt preview" />
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--success)' }}>Receipt Attached</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Click &apos;Place Order&apos; to submit</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Order Total */}
          <div className="card">
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <span>₱{getSubtotal()}</span>
            </div>
            <div className="cart-summary-row">
              <span>Delivery Fee</span>
              <span className="free-delivery-badge">FREE</span>
            </div>
            <div className="cart-summary-row total">
              <span>Total Amount</span>
              <span className="price">₱{getTotal()}</span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-pill btn-lg"
            disabled={
              submittingOrder || 
              uploadingReceipt || 
              !liveLocation ||
              (paymentMethod === 'gcash' && !receiptUrl) ||
              !isOpen
            }
          >
            {submittingOrder ? 'Placing Order...' : !isOpen ? 'Store is Closed' : !liveLocation ? 'Waiting for GPS...' : 'Place Order'}
          </button>
        </form>
      )}
    </div>
  );
}
