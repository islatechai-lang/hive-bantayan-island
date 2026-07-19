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
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
        <Image 
          src={product.image} 
          alt={product.name} 
          fill
          sizes="(max-width: 480px) 50vw, 240px"
          className="product-card-image"
          priority={product.sortOrder <= 4}
        />
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
                -
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
            >
              {product.available ? '+' : '❌'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
