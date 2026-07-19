'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { products as fallbackProducts } from '../lib/products';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Link from 'next/link';

export default function MenuPage() {
  const { user } = useAuth();
  const { getCartCount, getTotal } = useCart();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('cake'); // cake | milkshake
  const [isOpen, setIsOpen] = useState(true);

  // Check if store is open (8AM - 12AM)
  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      const hour = now.getHours();
      setIsOpen(hour >= 8 && hour < 24);
    };

    checkStoreStatus();
    const interval = setInterval(checkStoreStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Fetch products from Firestore
  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          // If Firestore is empty, seed/fallback to the static list
          setProducts(fallbackProducts);
        } else {
          const loadedProducts = [];
          querySnapshot.forEach((doc) => {
            loadedProducts.push({ id: doc.id, ...doc.data() });
          });
          setProducts(loadedProducts);
        }
      } catch (error) {
        console.error('Error fetching products, using fallback:', error);
        setProducts(fallbackProducts);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => p.category === category);
  const cartCount = getCartCount();
  const cartTotal = getTotal();

  return (
    <div className="page">
      {/* Brand Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontFamily: 'var(--font-family)', fontWeight: 800, color: 'var(--accent)' }}>
            🍰 Hive Bantayan
          </h1>
          <p className="page-subtitle">Premium Desserts & Milkshakes</p>
        </div>
        <div style={{ fontSize: '24px' }}>🌸</div>
      </div>

      {/* Closed Warning Banner */}
      {!isOpen && (
        <div className="closed-banner">
          <span className="closed-banner-icon">💤</span>
          <div>
            <div className="closed-banner-text">We are currently closed</div>
            <div className="closed-banner-hours">Ordering is active between 8:00 AM and 12:00 AM only.</div>
          </div>
        </div>
      )}

      {/* Hero Card */}
      <div className="card-accent mb-lg text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '32px' }}>✨</span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#9c3447' }}>Free Delivery Across Bantayan Island!</h2>
        <p className="text-secondary text-xs">
          Handcrafted tiramisu cakes (₱210) & thick creamy milkshakes (₱39) delivered straight to your door.
        </p>
      </div>

      {/* Categories Tabs */}
      <div className="category-tabs">
        <button 
          onClick={() => setCategory('cake')}
          className={`category-tab ${category === 'cake' ? 'active' : ''}`}
        >
          🍰 Tiramisu Cakes (₱210)
        </button>
        <button 
          onClick={() => setCategory('milkshake')}
          className={`category-tab ${category === 'milkshake' ? 'active' : ''}`}
        >
          🥤 Thick Milkshakes (₱39)
        </button>
      </div>

      {/* Product List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <LoadingSpinner />
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="floating-cart">
          <Link href="/cart" className="floating-cart-btn">
            <span className="cart-icon">🛒</span>
            <span>View Order</span>
            <span className="cart-count">{cartCount}</span>
            <span>•</span>
            <span>₱{cartTotal}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
