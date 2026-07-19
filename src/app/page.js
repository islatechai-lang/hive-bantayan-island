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
import { ShoppingBag, Clock, MapPin } from 'lucide-react';

export default function MenuPage() {
  const { user, dbUser, liveLocation, startTracking } = useAuth();
  const { getCartCount, getTotal } = useCart();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('cake');
  const [isOpen, setIsOpen] = useState(true);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);
  const [requestingGps, setRequestingGps] = useState(false);

  // Check if store is open (8AM - 12AM)
  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      const hour = now.getHours();
      setIsOpen(hour >= 8 && hour < 24);
    };

    checkStoreStatus();
    const interval = setInterval(checkStoreStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // GPS prompt overlay on first use
  useEffect(() => {
    if (user && dbUser && !dbUser.liveLocation && !liveLocation) {
      setShowGpsPrompt(true);
    }
  }, [user, dbUser, liveLocation]);

  // Fetch products from Firestore
  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
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

  const handleEnableGps = async () => {
    setRequestingGps(true);
    try {
      // Start continuous tracking — this triggers the browser GPS prompt
      // and begins syncing to Firestore automatically
      startTracking();
      // Give it a moment to get initial fix
      await new Promise((r) => setTimeout(r, 2500));
      setShowGpsPrompt(false);
    } catch (err) {
      console.error('GPS prompt error:', err);
      setShowGpsPrompt(false);
    } finally {
      setRequestingGps(false);
    }
  };

  const filteredProducts = products.filter(p => p.category === category);
  const cartCount = getCartCount();
  const cartTotal = getTotal();

  return (
    <div className="page">
      {/* GPS Permission Prompt Overlay */}
      {showGpsPrompt && (
        <div className="gps-prompt-overlay">
          <div className="gps-prompt-card">
            <div className="gps-prompt-icon">
              <MapPin size={40} className="text-accent" />
            </div>
            <h2>Enable Live Location</h2>
            <p>Share your GPS so our riders can navigate directly to you — just like Grab! No address forms needed.</p>
            <button 
              className="btn btn-primary btn-block btn-pill"
              onClick={handleEnableGps}
              disabled={requestingGps}
            >
              {requestingGps ? 'Accessing GPS...' : 'Share My Location'}
            </button>
            <button 
              className="btn btn-ghost btn-block mt-sm"
              onClick={() => setShowGpsPrompt(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Closed Warning Banner */}
      {!isOpen && (
        <div className="closed-banner">
          <Clock size={20} className="text-accent" />
          <div>
            <div className="closed-banner-text" style={{ fontWeight: 700 }}>Currently Closed</div>
            <div className="closed-banner-hours">Ordering is active between 8:00 AM and 12:00 AM.</div>
          </div>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="card-accent mb-lg text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.75rem 1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', margin: 0 }}>Free Delivery Islandwide!</h2>
        <p className="text-secondary text-sm" style={{ margin: 0, lineHeight: 1.4, maxWidth: '280px' }}>
          Indulge in artisanal tiramisu slices & premium thick milkshakes delivered straight to your home in Bantayan Island.
        </p>
      </div>

      {/* Categories Switch Tabs */}
      <div className="category-tabs">
        <button 
          onClick={() => setCategory('cake')}
          className={`category-tab ${category === 'cake' ? 'active' : ''}`}
        >
          Tiramisu Cakes
        </button>
        <button 
          onClick={() => setCategory('milkshake')}
          className={`category-tab ${category === 'milkshake' ? 'active' : ''}`}
        >
          Creamy Shakes
        </button>
      </div>

      {/* Products Grid */}
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

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="floating-cart">
          <Link href="/cart" className="floating-cart-btn">
            <ShoppingBag size={18} />
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
