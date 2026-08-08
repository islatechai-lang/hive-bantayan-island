'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../../../lib/firebase';
import { signInAnonymously, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '../../../contexts/ToastContext';
import LoadingSpinner from '../../../components/LoadingSpinner';
import DeliveryMap from '../../../components/DeliveryMap';
import Link from 'next/link';
import { Smartphone, Navigation, Package, LogOut, CheckCircle, MapPin, ChevronLeft, Phone } from 'lucide-react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234';
const HEARTBEAT_INTERVAL = 30000; // 30s heartbeat to Firestore

export default function RiderPage() {
  const { showToast } = useToast();

  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Setup states
  const [isRegistered, setIsRegistered] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [riderId, setRiderId] = useState(null);
  const [registering, setRegistering] = useState(false);

  // Data states
  const [assignedOrders, setAssignedOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Location states
  const [riderLocation, setRiderLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const watchIdRef = useRef(null);
  const heartbeatRef = useRef(null);

  // Check Firebase Auth on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const isRider = typeof window !== 'undefined' && localStorage.getItem('hive_rider_role') === 'true';
        const savedRiderId = typeof window !== 'undefined' && localStorage.getItem('hive_rider_id');
        if (isRider && savedRiderId) {
          setIsAuthenticated(true);
          setRiderId(savedRiderId);
          setIsRegistered(true);
        } else if (isRider) {
          setIsAuthenticated(true);
        }
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Start GPS tracking
  useEffect(() => {
    if (!isAuthenticated || !isRegistered) return;

    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setRiderLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          updatedAt: new Date().toISOString(),
        });
        setLocationDenied(false);
      },
      (err) => {
        console.error('GPS error:', err);
        if (err.code === 1) setLocationDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isAuthenticated, isRegistered]);

  // Heartbeat: periodically update rider's lastSeen + location in Firestore
  useEffect(() => {
    if (!riderId || !isRegistered) return;

    const sendHeartbeat = async () => {
      try {
        const riderRef = doc(db, 'riders', riderId);
        const updateData = { lastSeen: new Date().toISOString() };
        if (riderLocation) {
          updateData.location = riderLocation;
        }
        await setDoc(riderRef, updateData, { merge: true });
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    };

    // Send immediately
    sendHeartbeat();

    // Then every HEARTBEAT_INTERVAL
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [riderId, isRegistered, riderLocation]);

  // Listen to orders assigned to this rider
  useEffect(() => {
    if (!isAuthenticated || !riderId) {
      setOrdersLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('assignedRiderId', '==', riderId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = [];
      querySnapshot.forEach((docSnap) => {
        ordersData.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAssignedOrders(ordersData);
      setOrdersLoading(false);
    }, (error) => {
      console.error('Error listening to assigned orders:', error);
      setOrdersLoading(false);
      // Firestore index may not exist yet for this compound query
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        showToast('Database index required. Check console for link.', 'error');
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, riderId, showToast]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (password !== ADMIN_PASSWORD) {
      showToast('Invalid password', 'error');
      return;
    }

    setLoggingIn(true);
    try {
      await signInAnonymously(auth);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hive_rider_role', 'true');
      }
      setIsAuthenticated(true);
      showToast('Rider access granted', 'success');
    } catch (error) {
      console.error('Auth error:', error);
      showToast('Authentication failed', 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  // Register device
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      showToast('Please enter a device name', 'error');
      return;
    }

    setRegistering(true);
    try {
      const newRiderId = `rider_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const riderData = {
        deviceName: deviceName.trim(),
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        authUid: auth.currentUser?.uid || null,
        location: riderLocation || null,
      };

      await setDoc(doc(db, 'riders', newRiderId), riderData);

      if (typeof window !== 'undefined') {
        localStorage.setItem('hive_rider_id', newRiderId);
      }

      setRiderId(newRiderId);
      setIsRegistered(true);
      showToast(`Device "${deviceName.trim()}" registered!`, 'success');
    } catch (error) {
      console.error('Registration error:', error);
      showToast('Failed to register device', 'error');
    } finally {
      setRegistering(false);
    }
  };

  // Mark order as delivered
  const handleMarkDelivered = async (orderId) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' })
      });

      if (!res.ok) throw new Error('Status API error');
      showToast('Marked as Delivered!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to update status', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hive_rider_role');
        localStorage.removeItem('hive_rider_id');
      }
      await firebaseSignOut(auth);
      setIsAuthenticated(false);
      setIsRegistered(false);
      setRiderId(null);
      showToast('Logged out', 'info');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Navigate to customer via Google Maps
  const handleNavigate = (order) => {
    if (!order.location) {
      showToast('Customer location not available', 'error');
      return;
    }
    const lat = order.location.lat || order.location._lat;
    const lng = order.location.lng || order.location._long;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (authChecking) {
    return <LoadingSpinner fullPage={true} text="Checking authentication..." />;
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <div className="auth-logo" style={{ fontSize: '3rem', margin: '0 auto 1.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '5rem', height: '5rem', background: 'var(--card-bg-accent)', borderRadius: '50%' }}>🛵</div>
        <h1 className="auth-brand">Rider Mode</h1>
        <p className="auth-tagline text-secondary text-sm">Enter admin password to activate rider mode</p>
        <div className="auth-card">
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="input text-center"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                disabled={loggingIn}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-pill mt-md" disabled={loggingIn}>
              {loggingIn ? 'Authenticating...' : 'Activate Rider Mode'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Device registration screen
  if (!isRegistered) {
    return (
      <div className="auth-page">
        <div className="auth-logo" style={{ fontSize: '3rem', margin: '0 auto 1.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '5rem', height: '5rem', background: 'var(--card-bg-accent)', borderRadius: '50%' }}>
          <Smartphone size={36} />
        </div>
        <h1 className="auth-brand">Register This Device</h1>
        <p className="auth-tagline text-secondary text-sm">Give this device a name so the admin can assign deliveries to it</p>
        <div className="auth-card">
          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label className="input-label">Device Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Noel's Phone, Bike Rider 1..."
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
                autoFocus
                disabled={registering}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-pill mt-md" disabled={registering || !deviceName.trim()}>
              {registering ? 'Registering...' : 'Register Device'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active/delivered split
  const activeOrders = assignedOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const completedOrders = assignedOrders.filter(o => o.status === 'delivered');

  return (
    <div className="page-no-nav">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛵 Rider Mode
          </h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {riderLocation ? (
              <span style={{ fontSize: '11px', background: '#e8f7ef', color: '#246b38', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                📍 GPS Active
              </span>
            ) : locationDenied ? (
              <span style={{ fontSize: '11px', background: '#fdecec', color: '#c0392b', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                ⚠️ Location Denied
              </span>
            ) : (
              <span style={{ fontSize: '11px', background: 'var(--warning-bg)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                ⏳ Getting GPS...
              </span>
            )}
            <span className="text-secondary text-xs">{activeOrders.length} active delivery{activeOrders.length !== 1 ? 'ies' : 'y'}</span>
          </p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm btn-pill" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <LogOut size={14} /> Exit
        </button>
      </div>

      {/* Active Deliveries */}
      {ordersLoading ? (
        <LoadingSpinner />
      ) : activeOrders.length === 0 ? (
        <div className="rider-empty-state">
          <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h2 style={{ fontWeight: 700, marginBottom: '4px' }}>No deliveries assigned</h2>
          <p className="text-secondary text-sm">Waiting for the admin to assign orders to this device.</p>
          <p className="text-secondary text-xs" style={{ marginTop: '12px' }}>
            Orders will appear here automatically when assigned.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {activeOrders.map(order => (
            <div key={order.id} className="card rider-order-card">
              {/* Order header */}
              <div 
                className="rider-order-header"
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
              >
                <div>
                  <div className="rider-order-customer">{order.userName}</div>
                  <div className="text-xs text-secondary">{order.userPhone}</div>
                  <div className="text-xs text-secondary" style={{ marginTop: '2px' }}>
                    ₱{order.total} • {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge badge-${order.status === 'out_for_delivery' ? 'out-for-delivery' : order.status}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Address always visible */}
              <div className="rider-order-address">
                <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 500 }}>{order.address}</p>
                  {order.riderNote && (
                    <p className="text-secondary text-xs" style={{ fontStyle: 'italic', marginTop: '2px' }}>
                      Note: {order.riderNote}
                    </p>
                  )}
                </div>
              </div>

              {/* Expanded: map + details */}
              {expandedOrderId === order.id && (
                <div className="rider-order-expanded">
                  {/* Items */}
                  <div className="rider-order-items">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="rider-order-item-row">
                        <span>{item.quantity}× {item.name}</span>
                        <span>₱{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div className="rider-order-total">
                      <span>Total:</span>
                      <span>₱{order.total}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <strong>Payment:</strong> <span className="text-secondary">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'GCash'}</span>
                  </div>

                  {/* Embedded map */}
                  <div className="rider-map-container">
                    <DeliveryMap
                      location={order.location}
                      buyerUserId={order.userId}
                      buyerName={order.userName}
                      buyerPhone={order.userPhone}
                    />
                  </div>
                </div>
              )}

              {/* Action buttons - always visible */}
              <div className="rider-order-actions">
                <button
                  onClick={() => handleNavigate(order)}
                  className="btn btn-primary btn-sm btn-pill"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Navigation size={16} /> Navigate
                </button>
                {order.userPhone && (
                  <a
                    href={`tel:${order.userPhone}`}
                    className="btn btn-secondary btn-sm btn-pill"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1rem' }}
                  >
                    <Phone size={16} />
                  </a>
                )}
                <button
                  onClick={() => handleMarkDelivered(order.id)}
                  disabled={updatingOrderId === order.id || order.status === 'delivered'}
                  className="btn btn-sm btn-pill"
                  style={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    background: '#246b38', color: '#fff', border: 'none',
                    opacity: order.status === 'delivered' ? 0.5 : 1,
                  }}
                >
                  <CheckCircle size={16} />
                  {updatingOrderId === order.id ? 'Updating...' : 'Delivered'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed deliveries section */}
      {completedOrders.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 className="section-title text-secondary" style={{ fontSize: '14px' }}>
            ✅ Completed Today ({completedOrders.length})
          </h3>
          <div className="flex flex-col gap-sm">
            {completedOrders.slice(0, 5).map(order => (
              <div key={order.id} className="card" style={{ opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="font-semibold">{order.userName}</div>
                    <div className="text-xs text-secondary">₱{order.total}</div>
                  </div>
                  <span className="badge badge-delivered">Delivered</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
