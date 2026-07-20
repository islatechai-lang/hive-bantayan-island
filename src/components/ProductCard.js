'use client';

import React from 'react';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import Image from 'next/image';
import { Plus, Minus } from 'lucide-react';

export default function ProductCard({ product }) {
  const { cart, addToCart, updateQuantity } = useCart();
  const { showToast } = useToast();

  const cartItem = cart.find((item) => item.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  const isSoldOut = !product.available || (product.stock !== undefined && product.stock <= 0);

  const handleIncrement = () => {
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

  const handleDecrement = () => {
    if (quantity > 0) {
      updateQuantity(product.id, quantity - 1);
    }
  };

  return (
    <div className="product-card">
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
        <Image src={product.image} alt={product.name} fill sizes="(max-width: 480px) 50vw, 240px" className="product-card-image" priority={product.sortOrder <= 4} />
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
          {isSoldOut ? (
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
          {quantity > 0 ? (
            <div className="qty-control">
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
  );
}
