'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { products as fallbackProducts } from '../lib/products';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Clock, MapPin } from 'lucide-react';

export default function MenuPage() {
  const { user, loading: authLoading, locationDenied, liveLocation, startTracking } = useAuth();
  const { getCartCount, getTotal } = useCart();
  const router = useRouter();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('cake');
  const [isOpen, setIsOpen] = useState(true);
  const [requestingGps, setRequestingGps] = useState(false);

  // Require login immediately on startup
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

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

  // Fetch products from Firestore in real-time with automatic database seeding if empty
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      if (querySnapshot.empty) {
        // Seed the products database with default items
        try {
          const batch = writeBatch(db);
          fallbackProducts.forEach((p) => {
            const docRef = doc(db, 'products', p.id);
            batch.set(docRef, {
              name: p.name,
              description: p.description,
              price: p.price,
              category: p.category,
              image: p.image,
              available: p.available !== undefined ? p.available : true,
              stock: p.stock !== undefined ? p.stock : 20, // default stock count
              sortOrder: p.sortOrder
            }, { merge: true });
          });
          await batch.commit();
        } catch (seedErr) {
          console.error('Auto-seeding error:', seedErr);
        }
      } else {
        const loadedProducts = [];
        querySnapshot.forEach((doc) => {
          loadedProducts.push({ id: doc.id, ...doc.data() });
        });
        setProducts(loadedProducts);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to products:', error);
      setProducts(fallbackProducts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEnableGps = async () => {
    setRequestingGps(true);
    try {
      // Start continuous tracking — this triggers the browser GPS prompt
      // and begins syncing to Firestore automatically
      startTracking();
      // Give it a moment to get initial fix
      await new Promise((r) => setTimeout(r, 2500));
    } catch (err) {
      console.error('GPS prompt error:', err);
    } finally {
      setRequestingGps(false);
    }
  };

  const filteredProducts = products.filter(p => p.category === category);
  const cartCount = getCartCount();
  const cartTotal = getTotal();

  return (
    <div className="page">
      {/* GPS Blocker Overlay — Required only when explicitly denied */}
      {locationDenied && (
        <div className="gps-prompt-overlay" style={{ zIndex: 9999 }}>
          <div className="gps-prompt-card">
            <div className="gps-prompt-icon">
              <MapPin size={40} className="text-accent" />
            </div>
            <h2>Location Permission Denied</h2>
            <p>You have denied location access. We need your live GPS location to deliver your order accurately. Please enable location permissions in your app settings to proceed.</p>
            <button 
              className="btn btn-primary btn-block btn-pill"
              onClick={handleEnableGps}
              disabled={requestingGps}
            >
              {requestingGps ? 'Retrying GPS Access...' : 'Retry / Enable Location'}
            </button>
            <p className="text-center text-xs text-secondary mt-md" style={{ margin: 0 }}>
              Go to your Android Device Settings {"\u2192"} Apps {"\u2192"} Hive {"\u2192"} Permissions {"\u2192"} Location {"\u2192"} set to "Allow only while using the app".
            </p>
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
