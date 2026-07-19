'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext({});

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to prevent hydration mismatch with localStorage
  useEffect(() => {
    setIsMounted(true);
    const savedCart = localStorage.getItem('hive_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error parsing cart from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('hive_cart', JSON.stringify(cart));
    }
  }, [cart, isMounted]);

  const addToCart = (product, quantity = 1) => {
    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingItemIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingItemIndex].quantity += quantity;
        return newCart;
      }
      return [...prevCart, { ...product, quantity }];
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  // Delivery is free, so total is equal to subtotal
  const getTotal = () => {
    return getSubtotal();
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      getSubtotal,
      getCartCount,
      getTotal
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
