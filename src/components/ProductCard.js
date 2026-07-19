'use client';

import React from 'react';
import { useCart } from '../contexts/CartContext';
import Image from 'next/image';

export default function ProductCard({ product }) {
  const { cart, addToCart, updateQuantity } = useCart();

  const cartItem = cart.find((item) => item.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  const handleIncrement = () => {
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
        <Image 
          src={product.image} 
          alt={product.name} 
          fill
          sizes="(max-width: 480px) 50vw, 240px"
          className="product-card-image"
          priority={product.sortOrder <= 4}
        />
        {!product.available && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Sold Out
          </div>
        )}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-desc">{product.description}</p>
        <div className="product-card-footer">
          <div className="product-card-price">
            ₱{product.price}
          </div>
          
          {quantity > 0 ? (
            <div className="qty-control">
              <button 
                onClick={handleDecrement}
                className="qty-btn qty-btn-minus"
                aria-label="Decrease quantity"
              >
                —
              </button>
              <span className="qty-value">{quantity}</span>
              <button 
                onClick={handleIncrement}
                className="qty-btn qty-btn-plus"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button 
              onClick={handleIncrement}
              className="add-to-cart-btn"
              aria-label="Add to cart"
              disabled={!product.available}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '50%' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5" strokeWidth={2.5} style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
