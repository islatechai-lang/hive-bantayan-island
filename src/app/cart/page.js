'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, addDoc, writeBatch, doc, increment } from 'firebase/firestore';
import LiveLocationPreview from '../../components/LiveLocationPreview';
import LoadingSpinner from '../../components/LoadingSpinner';
import Image from 'next/image';
import { ShoppingBag, Upload, ChevronLeft, Minus, Plus, Banknote, Smartphone, MessageSquare, Clock, CheckCircle, X } from 'lucide-react';

export default function CartPage() {
  const { user, dbUser, liveLocation, startTracking, forceLocationSync } = useAuth();
  const { cart, updateQuantity, removeFromCart, getSubtotal, getTotal, clearCart } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [riderNote, setRiderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');    // base64 data URL
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(''); // object URL for preview
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [refreshingGps, setRefreshingGps] = useState(false);
  const fileInputRef = useRef(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (JPG, PNG, etc.)', 'error');
      return;
    }

    setUploadingReceipt(true);
    setReceiptFile(file);

    try {
      // Compress the image before uploading to Firestore to stay well under 1MB limits
      const compressedBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG with 0.6 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            resolve(dataUrl);
          };
          img.onerror = reject;
          img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setReceiptUrl(compressedBase64);
      setReceiptPreviewUrl(URL.createObjectURL(file));
      showToast('Receipt attached successfully!', 'success');
    } catch (error) {
      console.error('Error compressing receipt file:', error);
      showToast('Failed to process image. Please try again.', 'error');
      setReceiptFile(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptUrl('');
    setReceiptPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
                <h4 style={{ marginBottom: '1rem', fontWeight: 700 }}>How to Pay via GCash</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { n: 1, text: 'Open your GCash app on your phone.' },
                    { n: 2, text: 'Tap "Send Money" then choose "Express Send".' },
                    { n: 3, text: <>Enter the number: <strong style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>0945 432 0799</strong></> },
                    { n: 4, text: <>Account Name: <strong>AL****H M** G.</strong></> },
                    { n: 5, text: <>Enter the exact amount: <strong style={{ color: 'var(--accent)' }}>₱{getTotal()}</strong></> },
                    { n: 6, text: 'Take a screenshot or download the success receipt screen.' },
                  ].map(({ n, text }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <span style={{ minWidth: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
                      <span style={{ fontSize: '13px', lineHeight: 1.5, paddingTop: '4px' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <div className="receipt-upload">
                  <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Upload Your GCash Receipt</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="receipt-file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                  />

                  {!receiptUrl ? (
                    <label
                      htmlFor="receipt-file"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', border: '2px dashed var(--border)', borderRadius: '12px',
                        padding: '1.5rem 1rem', cursor: 'pointer', transition: 'all 0.2s',
                        background: 'var(--bg-secondary)', textAlign: 'center'
                      }}
                    >
                      {uploadingReceipt ? (
                        <>
                          <div className="spinner" style={{ width: '28px', height: '28px' }} />
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Reading receipt image...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={28} color="var(--accent)" />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Tap to Upload Receipt</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>JPG, PNG — Max 5MB</span>
                        </>
                      )}
                    </label>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      background: 'var(--success-bg)', borderRadius: '12px', padding: '0.75rem 1rem',
                      border: '1.5px solid var(--success)'
                    }}>
                      <img src={receiptPreviewUrl} alt="Receipt" style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} /> Receipt Attached
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{receiptFile?.name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', flexShrink: 0 }}
                        aria-label="Remove receipt"
                      >
                        <X size={16} />
                      </button>
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
