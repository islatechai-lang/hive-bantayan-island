'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Image from 'next/image';
import { Plus, Minus, X, ShoppingBag, Heart } from 'lucide-react';

export default function ProductCard({ product }) {
  const { cart, addToCart, updateQuantity } = useCart();
  const { showToast } = useToast();
  const { user, dbUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isWanted, setIsWanted] = useState(false);
  const [interestCount, setInterestCount] = useState(product.interestCount || 0);

  const cartItem = cart.find((item) => item.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  const isComingSoon = Boolean(product.comingSoon);
  const isSoldOut = !isComingSoon && (!product.available || (product.stock !== undefined && product.stock <= 0));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wanted = localStorage.getItem('hive_wanted_' + product.id) === 'true';
      setIsWanted(wanted);
    }
  }, [product.id]);

  useEffect(() => {
    if (product.interestCount !== undefined) {
      setInterestCount(product.interestCount);
    }
  }, [product.interestCount]);

  const handleToggleInterest = async (e) => {
    if (e) e.stopPropagation();

    // Get or create persistent guest ID
    let guestId = '';
    if (!user && typeof window !== 'undefined') {
      guestId = localStorage.getItem('hive_guest_id');
      if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('hive_guest_id', guestId);
      }
    }

    const nextWanted = !isWanted;
    setIsWanted(nextWanted);
    setInterestCount((prev) => Math.max(0, prev + (nextWanted ? 1 : -1)));

    if (typeof window !== 'undefined') {
      if (nextWanted) {
        localStorage.setItem('hive_wanted_' + product.id, 'true');
        showToast(`Added to your wishlist! We'll notify you when ${product.name} launches.`, 'success');
      } else {
        localStorage.removeItem('hive_wanted_' + product.id);
        showToast(`Removed from wishlist.`, 'info');
      }
    }

    try {
      await fetch('/api/coming-soon/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          userId: user?.uid || null,
          userName: dbUser?.name || user?.displayName || '',
          userPhone: user?.phoneNumber || dbUser?.phone || '',
          guestId: guestId || null,
          action: nextWanted ? 'add' : 'remove',
        }),
      });
    } catch (err) {
      console.error('Error toggling product interest:', err);
    }
  };

  const handleIncrement = (e) => {
    if (e) e.stopPropagation();
    if (isComingSoon) {
      showToast(`${product.name} is launching soon. Stay tuned!`, 'info');
      return;
    }
    if (product.stock !== undefined && quantity >= product.stock) {
      showToast(`Only ${product.stock} items left in stock!`, 'warning');
      return;
    }
    if (quantity === 0) {
      addToCart(product, 1);
    } else {
      updateQuantity(product.id, quantity + 1);
    }
  };

  const handleDecrement = (e) => {
    if (e) e.stopPropagation();
    if (quantity > 0) {
      updateQuantity(product.id, quantity - 1);
    }
  };

  const handleModalAddToCart = () => {
    if (isComingSoon || isSoldOut) return;
    handleIncrement();
    showToast(`Added ${product.name} to cart!`, 'success');
    setShowModal(false);
  };

  return (
    <>
      <div className="product-card" style={{ cursor: 'pointer' }} onClick={() => setShowModal(true)}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 480px) 50vw, 240px"
            className="product-card-image"
            style={
              product.imagePosition
                ? { objectPosition: product.imagePosition }
                : (product.id === 'classic-tiramisu' || product.id === 'oreo-tiramisu')
                ? { objectPosition: 'center 30%' }
                : undefined
            }
            priority={product.sortOrder <= 4}
          />
          {isComingSoon && (
            <>
              <div className="product-coming-soon-badge">
                <span>✦</span> Coming Soon
              </div>
              <button
                type="button"
                onClick={handleToggleInterest}
                className={`product-card-heart-btn ${isWanted ? 'wanted' : ''}`}
                aria-label="I want this item"
                title={isWanted ? "You want this!" : "I want this!"}
              >
                <Heart size={15} fill={isWanted ? "#ef4444" : "rgba(0,0,0,0.3)"} color={isWanted ? "#ef4444" : "#ffffff"} />
              </button>
            </>
          )}
          {isSoldOut && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--error)', fontSize: '0.9rem', letterSpacing: '0.5px' }}>
              SOLD OUT
            </div>
          )}
        </div>
        <div className="product-card-body">
          <h3 className="product-card-name">{product.name}</h3>
          <p className="product-card-desc">{product.description}</p>
          
          {/* Stock Level Text */}
          <div style={{ minHeight: '18px', margin: '4px 0 8px' }}>
            {isComingSoon ? (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent, #c4622d)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ✦ Launching Soon
              </span>
            ) : isSoldOut ? (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--error)' }}>Out of Stock</span>
            ) : product.stock !== undefined ? (
              product.stock <= 5 ? (
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--error)' }}>Only {product.stock} left!</span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>{product.stock} items left</span>
              )
            ) : null}
          </div>

          <div className="product-card-footer">
            <div className="product-card-price">₱{product.price}</div>
            {isComingSoon ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleToggleInterest}
                  className={`coming-soon-want-btn ${isWanted ? 'wanted' : ''}`}
                  aria-label="I want this item"
                >
                  <Heart size={13} fill={isWanted ? "#ef4444" : "none"} color={isWanted ? "#ef4444" : "currentColor"} />
                  <span>{isWanted ? 'Wanted' : 'I Want This'}</span>
                  {interestCount > 0 && <span className="want-count">({interestCount})</span>}
                </button>
              </div>
            ) : quantity > 0 ? (
              <div className="qty-control" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleDecrement} className="qty-btn qty-btn-minus" aria-label="Decrease quantity"><Minus size={14} strokeWidth={2.5} /></button>
                <span className="qty-value">{quantity}</span>
                <button onClick={handleIncrement} className="qty-btn qty-btn-plus" aria-label="Increase quantity"><Plus size={14} strokeWidth={2.5} /></button>
              </div>
            ) : (
              <button onClick={handleIncrement} className="add-to-cart-btn" aria-label="Add to cart" disabled={isSoldOut} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '50%' }}>
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Preview Modal */}
      {showModal && (
        <div className="product-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="product-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="product-modal-close" onClick={() => setShowModal(false)} aria-label="Close modal">
              <X size={18} />
            </button>

            <div className="product-modal-img-wrapper">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 480px) 100vw, 420px"
                style={{
                  objectFit: 'cover',
                  objectPosition: product.previewPosition || product.imagePosition || ((product.id === 'classic-tiramisu' || product.id === 'oreo-tiramisu') ? 'center 30%' : 'center')
                }}
                priority
              />
              {isComingSoon && (
                <div className="product-modal-coming-soon-badge">
                  <span>✦</span> Coming Soon
                </div>
              )}
              {isSoldOut && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--error)', fontSize: '1.1rem' }}>
                  SOLD OUT
                </div>
              )}
            </div>

            <div className="product-modal-body">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h2 className="product-modal-title">{product.name}</h2>
                  <div className="product-modal-price">₱{product.price}</div>
                </div>
                <div style={{ marginTop: '4px' }}>
                  {isComingSoon ? (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#c4622d', background: 'rgba(196, 98, 45, 0.12)', padding: '3px 10px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      ✨ Coming Soon — Launching in Bantayan!
                    </span>
                  ) : isSoldOut ? (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--error)', background: '#fdecec', padding: '2px 8px', borderRadius: '10px' }}>Out of Stock</span>
                  ) : product.stock !== undefined ? (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: product.stock <= 5 ? 'var(--error)' : 'var(--accent)', background: 'var(--card-bg-accent)', padding: '2px 8px', borderRadius: '10px' }}>
                      {product.stock <= 5 ? `Only ${product.stock} items left!` : `${product.stock} in stock`}
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="product-modal-desc">{product.description}</p>

              {/* Action Buttons in Modal */}
              <div style={{ marginTop: '8px' }}>
                {isComingSoon ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleToggleInterest}
                      className={`btn btn-block btn-pill ${isWanted ? 'btn-wanted-active' : 'btn-primary'}`}
                      style={{
                        padding: '14px',
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Heart size={18} fill={isWanted ? "#ef4444" : "none"} color={isWanted ? "#ef4444" : "currentColor"} />
                      <span>{isWanted ? '❤️ You Want This! (On Wishlist)' : '🙋 I Want This! (Vote to Launch)'}</span>
                    </button>

                    <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {interestCount > 0 ? (
                        <span>🔥 <strong>{interestCount}</strong> {interestCount === 1 ? 'islander wants' : 'islanders want'} this on the menu!</span>
                      ) : (
                        <span>Be the first islander to vote and bring this to Bantayan! 🏝️</span>
                      )}
                    </div>
                  </div>
                ) : quantity > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg-accent)', padding: '10px 16px', borderRadius: '30px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>In Your Cart:</span>
                    <div className="qty-control">
                      <button onClick={handleDecrement} className="qty-btn qty-btn-minus"><Minus size={14} strokeWidth={2.5} /></button>
                      <span className="qty-value">{quantity}</span>
                      <button onClick={handleIncrement} className="qty-btn qty-btn-plus"><Plus size={14} strokeWidth={2.5} /></button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleModalAddToCart}
                    disabled={isSoldOut}
                    className="btn btn-primary btn-block btn-pill"
                    style={{ padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <ShoppingBag size={18} />
                    {isSoldOut ? 'Sold Out' : `Add to Order • ₱${product.price}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
