'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { supabase } from '../../lib/supabase';
import LocationPicker from '../../components/LocationPicker';
import LoadingSpinner from '../../components/LoadingSpinner';
import Image from 'next/image';
import { CartIcon, UploadIcon, ChevronLeftIcon } from '../../components/Icons';

export default function CartPage() {
  const { user, dbUser } = useAuth();
  const { cart, updateQuantity, removeFromCart, getSubtotal, getTotal, clearCart } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDetails, setAddressDetails] = useState(null); // { location: { lat, lng }, address }
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // cod | gcash
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      showToast('Please sign in to view your cart and checkout', 'info');
      router.push('/login');
    }
  }, [user, router, showToast]);

  // Pre-fill user data
  useEffect(() => {
    if (dbUser) {
      setName(dbUser.name || '');
      setPhone(dbUser.phone || '');
      if (dbUser.address && dbUser.location) {
        setAddressDetails({
          address: dbUser.address,
          location: dbUser.location,
        });
      }
    }
  }, [dbUser]);

  // Verify store status
  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      const hour = now.getHours();
      setIsOpen(hour >= 8 && hour < 24);
    };
    checkStoreStatus();
  }, []);

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    setReceiptFile(file);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      // Upload file to Supabase Storage bucket 'receipts'
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
      setReceiptUrl(data.publicUrl);
      showToast('GCash receipt screenshot uploaded!', 'success');
    } catch (error) {
      console.error('Error uploading file:', error);
      showToast('Failed to upload receipt screenshot. Try again.', 'error');
      setReceiptFile(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!isOpen) {
      showToast('Ordering is currently disabled. We are closed.', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    if (!addressDetails?.address || !addressDetails?.location) {
      showToast('Please set your delivery location on the map', 'error');
      return;
    }

    if (paymentMethod === 'gcash' && !receiptUrl) {
      showToast('Please upload your GCash payment receipt screenshot', 'error');
      return;
    }

    setSubmittingOrder(true);

    try {
      const orderData = {
        userId: user.uid,
        userName: name,
        userPhone: phone,
        address: addressDetails.address,
        location: addressDetails.location,
        addressNotes: notes,
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
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save order to Firestore
      await addDoc(collection(db, 'orders'), orderData);
      
      showToast('Order placed successfully!', 'success');
      clearCart();
      router.push('/orders');
    } catch (error) {
      console.error('Error saving order:', error);
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
          <ChevronLeftIcon className="w-4 h-4" /> Menu
        </button>
        <h1 className="page-title" style={{ flex: 1, textAlign: 'center', marginRight: '64px' }}>Checkout</h1>
      </div>

      {cart.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '6rem', height: '6rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <CartIcon className="w-12 h-12" style={{ width: '3rem', height: '3rem' }} />
          </div>
          <h2 className="empty-state-title">Your cart is empty</h2>
          <p className="empty-state-text">Browse our menu and satisfy your sweet cravings!</p>
          <button onClick={() => router.push('/')} className="btn btn-primary btn-pill">
            Explore Menu
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-lg">
          {/* Cart items list */}
          <div className="card">
            <h3 className="section-title">Items in Order</h3>
            {cart.map((item) => (
              <div key={item.id} className="cart-item">
                <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden' }}>
                  <Image 
                    src={item.image} 
                    alt={item.name} 
                    fill 
                    style={{ objectFit: 'cover' }} 
                  />
                </div>
                <div className="cart-item-info">
                  <h4 className="cart-item-name">{item.name}</h4>
                  <div className="cart-item-price">₱{item.price}</div>
                  <div className="cart-item-actions">
                    <div className="qty-control">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="qty-btn qty-btn-minus">—</button>
                      <span className="qty-value">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="qty-btn qty-btn-plus">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="cart-item-remove">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Delivery Details Form */}
          <form onSubmit={handlePlaceOrder}>
            <div className="card mt-md">
              <h3 className="section-title">Delivery Info</h3>
              
              <div className="input-group">
                <label className="input-label">Customer Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Contact Number</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="Contact number for driver"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              {/* Maps Location Picker */}
              <LocationPicker 
                value={addressDetails}
                onChange={(details) => setAddressDetails(details)}
              />

              <div className="input-group">
                <label className="input-label">Landmarks / Delivery Notes</label>
                <textarea
                  className="textarea"
                  placeholder="e.g. Near Barangay Hall, Green Gate, call before arriving..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Method Option */}
            <div className="card mt-md">
              <h3 className="section-title">Payment Method</h3>
              <div className="payment-options">
                <div 
                  className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('cod')}
                >
                  <div className="payment-option-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h.007v.008H3.75V4.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3 16.5m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm15 3a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm-1.5-12a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h.008v.008H12V7.5zM12 16.5h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="payment-option-name">Cash on Delivery</div>
                </div>
                <div 
                  className={`payment-option ${paymentMethod === 'gcash' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('gcash')}
                >
                  <div className="payment-option-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 15h9" />
                    </svg>
                  </div>
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
                      <UploadIcon className="w-8 h-8 text-secondary mb-xs" />
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

            {/* Total summary */}
            <div className="card mt-md">
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
              className="btn btn-primary btn-block mt-lg btn-pill btn-lg"
              disabled={
                submittingOrder || 
                uploadingReceipt || 
                !name || 
                !phone || 
                !addressDetails ||
                (paymentMethod === 'gcash' && !receiptUrl) ||
                !isOpen
              }
            >
              {submittingOrder ? 'Submitting Order...' : 'Place Order'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
