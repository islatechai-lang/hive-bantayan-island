'use client';

import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../lib/firebase';
import { signInAnonymously, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import Link from 'next/link';
import { Truck, Smartphone, Users, ChevronDown } from 'lucide-react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234';

export default function AdminPage() {
  const { showToast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('orders'); // orders | products | delivery | riders
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [riders, setRiders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('preparing');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [testingPush, setTestingPush] = useState(false);

  const initialLoadRef = useRef(true);

  // Test OneSignal Push notification endpoint
  const handleTestPushNotification = async () => {
    setTestingPush(true);
    try {
      const res = await fetch('/api/onesignal/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendToAll: true })
      });
      const data = await res.json();
      console.log('⚡ Test Push API Result:', data);
      
      const recipients = data.pushResult?.data?.recipients || 0;
      const ok = data.pushResult?.ok;
      const status = data.pushResult?.status;
      const errorMsg = data.pushResult?.data?.errors ? JSON.stringify(data.pushResult.data.errors) : (data.error || 'None');

      alert(`⚡ OneSignal Push Test Result:\n\nHTTP Status: ${status || 'N/A'}\nAPI Success: ${ok ? 'YES' : 'NO'}\nRecipients Reached: ${recipients}\nErrors: ${errorMsg}\n\nFull Diagnostic Payload:\n${JSON.stringify(data, null, 2)}`);
    } catch (e) {
      alert(`Test push failed: ${e.message}`);
    } finally {
      setTestingPush(false);
    }
  };

  // Auto-enable audio on first click on document without re-triggering sound logic unexpectedly
  useEffect(() => {
    const enableAudio = () => {
      setAudioEnabled(true);
      window.removeEventListener('click', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    return () => window.removeEventListener('click', enableAudio);
  }, []);

  // Check Firebase Auth state on mount (persists across reloads & devices)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Check if admin flag is stored in localStorage (set when they enter the password)
        const isAdmin = typeof window !== 'undefined' && localStorage.getItem('hive_admin_role') === 'true';
        if (isAdmin) {
          setIsAuthenticated(true);
        }
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch orders in real time with background MP3 audio alert
  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = [];
      querySnapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() });
      });

      // Play audio notification strictly when a NEW order is created after initial load
      if (initialLoadRef.current) {
        setOrders(ordersData);
        initialLoadRef.current = false;
      } else {
        setOrders((prevOrders) => {
          if (ordersData.length > prevOrders.length) {
            const hasNew = ordersData.some((n) => !prevOrders.some((o) => o.id === n.id));
            if (hasNew) {
              const audio = new Audio('/new-order.mp3');
              audio.play().catch((err) => console.log('Audio autoplay blocked or failed:', err));
            }
          }
          return ordersData;
        });
      }

      setOrdersLoading(false);
    }, (error) => {
      console.error('Error listening to orders:', error);
      setOrdersLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Fetch products in real time
  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      setProductsLoading(false);
    }, (error) => {
      console.error('Error listening to products in admin:', error);
      setProductsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Fetch active rider devices in real time
  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'riders'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ridersData = [];
      querySnapshot.forEach((doc) => {
        ridersData.push({ id: doc.id, ...doc.data() });
      });
      setRiders(ridersData);
    }, (error) => {
      console.error('Error listening to riders:', error);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password !== ADMIN_PASSWORD) {
      showToast('Invalid password', 'error');
      return;
    }

    setLoggingIn(true);
    try {
      // Sign in anonymously to get a real Firebase Auth token
      // This makes Firestore reads work on ANY device
      await signInAnonymously(auth);
      
      // Mark this session as admin in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('hive_admin_role', 'true');
      }
      
      setIsAuthenticated(true);
      showToast('Admin access granted', 'success');
    } catch (error) {
      console.error('Anonymous auth error:', error);
      showToast('Authentication failed. Please try again.', 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hive_admin_role');
      }
      await firebaseSignOut(auth);
      setIsAuthenticated(false);
      showToast('Logged out of Admin Panel', 'info');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatusId(orderId);
    try {
      // Optimistic status update locally
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

      // Auto-switch view to the target status tab
      setStatusFilter(newStatus);

      // Trigger PATCH route to update Firestore & send OneSignal push notification
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      console.log('🔔 [Admin] Status Update API & OneSignal Result:', data);

      if (!res.ok) throw new Error(data.error || 'Status API error');

      const recipients = data.pushResult?.data?.recipients;
      if (recipients === 0) {
        showToast(`Status updated to ${newStatus.replace('_', ' ')} (0 devices registered with OneSignal yet)`, 'info');
      } else if (recipients > 0) {
        showToast(`Status updated! Push notification sent to ${recipients} device(s)`, 'success');
      } else {
        showToast(`Order status updated to ${newStatus.replace('_', ' ')}`, 'success');
      }
    } catch (error) {
      console.error('Status update error:', error);
      showToast('Failed to update status: ' + error.message, 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleToggleProduct = async (productId, currentAvailability) => {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, { available: !currentAvailability });
      
      // Update local state
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, available: !currentAvailability } : p));
    } catch (e) {
      showToast('Failed to update product availability', 'error');
    }
  };

  const handleUpdateStock = async (productId, newStock) => {
    const stockVal = Math.max(0, parseInt(newStock) || 0);
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, { stock: stockVal });
      
      // Update local state
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: stockVal } : p));
    } catch (e) {
      showToast('Failed to update stock count', 'error');
    }
  };

  // Assign an order to a specific rider device
  const handleAssignToRider = async (orderId, riderId, riderName) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        assignedRiderId: riderId,
        assignedRiderName: riderName,
        assignedAt: new Date().toISOString()
      });

      // Update local state
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, assignedRiderId: riderId, assignedRiderName: riderName, assignedAt: new Date().toISOString() }
        : o
      ));

      setAssigningOrderId(null);
      showToast(`Order assigned to ${riderName}`, 'success');
    } catch (error) {
      console.error('Assign error:', error);
      showToast('Failed to assign order', 'error');
    }
  };

  // Unassign an order
  const handleUnassignOrder = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        assignedRiderId: null,
        assignedRiderName: null,
        assignedAt: null
      });

      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, assignedRiderId: null, assignedRiderName: null, assignedAt: null }
        : o
      ));

      showToast('Order unassigned', 'info');
    } catch (error) {
      console.error('Unassign error:', error);
      showToast('Failed to unassign order', 'error');
    }
  };

  // Remove a rider device
  const handleRemoveRider = async (riderId) => {
    try {
      await deleteDoc(doc(db, 'riders', riderId));
      showToast('Rider device removed', 'info');
    } catch (error) {
      showToast('Failed to remove rider', 'error');
    }
  };

  if (authChecking) {
    return <LoadingSpinner fullPage={true} text="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <h1 className="auth-brand">Bantayan Hive Admin Panel</h1>
        <p className="auth-tagline text-secondary text-sm">Please enter passkey to continue</p>
        <div className="auth-card">
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Admin Password</label>
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
              {loggingIn ? 'Authenticating...' : 'Unlock Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter orders by status
  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const activeDeliveries = orders.filter(o => o.status === 'preparing' || o.status === 'out_for_delivery');

  // Count online riders (active in last 2 minutes)
  const onlineRiders = riders.filter(r => {
    if (!r.lastSeen) return false;
    const diff = Date.now() - new Date(r.lastSeen).getTime();
    return diff < 120000; // 2 minutes
  });

  return (
    <div className="page-no-nav">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Bantayan Hive Admin</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            Manage menu inventory and deliveries
            {!audioEnabled && (
              <span style={{ fontSize: '11px', background: 'var(--warning-bg)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                🔊 Tap screen to enable audio alerts
              </span>
            )}
            {onlineRiders.length > 0 && (
              <span style={{ fontSize: '11px', background: '#e8f7ef', color: '#246b38', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                🟢 {onlineRiders.length} rider{onlineRiders.length > 1 ? 's' : ''} online
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleTestPushNotification}
            disabled={testingPush}
            className="btn btn-sm btn-pill"
            style={{ background: '#fff', border: '1px solid var(--accent)', color: 'var(--accent)', fontWeight: 600 }}
          >
            {testingPush ? 'Testing...' : '⚡ Test OneSignal Push'}
          </button>
          <button 
            onClick={handleLogout}
            className="btn btn-secondary btn-sm btn-pill"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="category-tabs mb-lg">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`category-tab ${activeTab === 'orders' ? 'active' : ''}`}
        >
          Orders ({orders.length})
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`category-tab ${activeTab === 'products' ? 'active' : ''}`}
        >
          Inventory
        </button>
        <button 
          onClick={() => setActiveTab('delivery')}
          className={`category-tab ${activeTab === 'delivery' ? 'active' : ''}`}
        >
          Deliveries ({activeDeliveries.length})
        </button>
        <button 
          onClick={() => setActiveTab('riders')}
          className={`category-tab ${activeTab === 'riders' ? 'active' : ''}`}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Smartphone size={14} /> Riders ({riders.length})
          </span>
        </button>
      </div>

      {/* Tab Contents: Orders list */}
      {activeTab === 'orders' && (
        <div className="flex flex-col gap-md">
          {/* Status Filters */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
            {['preparing', 'out_for_delivery', 'delivered', 'cancelled', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`filter-pill ${statusFilter === f ? 'active' : ''}`}
              >
                {f.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {ordersLoading ? (
            <LoadingSpinner />
          ) : filteredOrders.length === 0 ? (
            <div className="text-center text-secondary py-xl" style={{ padding: '60px 0' }}>No orders found matching filter</div>
          ) : (
            <div className="flex flex-col gap-md">
              {filteredOrders.map(order => (
                <div key={order.id} className="card">
                  <div className="admin-order-header">
                    <div className="admin-order-customer">
                      <div className="admin-order-name">{order.userName}</div>
                      <div className="admin-order-phone">{order.userPhone}</div>
                      <div className="text-xs text-secondary">Ordered: {new Date(order.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="admin-order-items">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="admin-order-item">
                        <span>{item.quantity}x {item.name}</span>
                        <span>₱{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--divider)', marginTop: '8px', paddingTop: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Amount:</span>
                      <span>₱{order.total}</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px', fontSize: '13px' }}>
                    <strong>Address:</strong>
                    <p className="text-secondary">{order.address}</p>
                    {order.riderNote && (
                      <p className="text-secondary" style={{ fontStyle: 'italic' }}>Note: {order.riderNote}</p>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                    <strong>Payment:</strong> <span className="text-secondary">{order.paymentMethod.toUpperCase()}</span>
                    {order.paymentMethod === 'gcash' && order.gcashReceiptUrl && (
                      <div style={{ marginTop: '4px' }}>
                        <a href={order.gcashReceiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                          View Uploaded GCash Receipt 📸
                        </a>
                        {order.aiVerification && (
                          <div style={{ marginTop: '6px', padding: '6px 10px', background: order.aiVerification.valid ? '#e8f7ef' : '#fdecec', border: `1px solid ${order.aiVerification.valid ? '#bfe3cd' : '#f8c0c0'}`, borderRadius: '6px', fontSize: '12px' }}>
                            <strong style={{ color: order.aiVerification.valid ? '#246b38' : '#c0392b' }}>AI Receipt Review:</strong>
                            <p style={{ margin: '2px 0 0', color: 'var(--text-primary)' }}>{order.aiVerification.reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rider Assignment Badge */}
                  {order.assignedRiderName && (
                    <div className="rider-assignment-badge">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} />
                        <span>Assigned to <strong>{order.assignedRiderName}</strong></span>
                      </div>
                      <button
                        onClick={() => handleUnassignOrder(order.id)}
                        className="btn-unassign"
                        title="Unassign rider"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="admin-order-actions" style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {order.status !== 'preparing' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'preparing')}
                          disabled={updatingStatusId === order.id}
                          className="btn btn-sm"
                          style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', fontWeight: 600, flex: 1, padding: '6px 8px', fontSize: '12px' }}
                        >
                          👨‍🍳 Start Preparing
                        </button>
                      )}
                      {order.status !== 'out_for_delivery' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'out_for_delivery')}
                          disabled={updatingStatusId === order.id}
                          className="btn btn-sm"
                          style={{ background: '#cce5ff', color: '#004085', border: '1px solid #b8daff', fontWeight: 600, flex: 1, padding: '6px 8px', fontSize: '12px' }}
                        >
                          🛵 Out for Delivery
                        </button>
                      )}
                      {order.status !== 'delivered' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'delivered')}
                          disabled={updatingStatusId === order.id}
                          className="btn btn-sm"
                          style={{ background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', fontWeight: 600, flex: 1, padding: '6px 8px', fontSize: '12px' }}
                        >
                          🍰 Delivered
                        </button>
                      )}
                      {order.status !== 'cancelled' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'cancelled')}
                          disabled={updatingStatusId === order.id}
                          className="btn btn-sm"
                          style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', fontWeight: 600, flex: 1, padding: '6px 8px', fontSize: '12px' }}
                        >
                          ❌ Cancel
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="status-select"
                        value={order.status}
                        disabled={updatingStatusId === order.id}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="preparing">Start Preparing</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancel Order</option>
                      </select>

                    {/* Assign to Rider dropdown */}
                    <div style={{ position: 'relative', flex: 1 }}>
                      {assigningOrderId === order.id ? (
                        <div className="rider-assign-dropdown">
                          <div className="rider-assign-header">
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>Assign to rider:</span>
                            <button onClick={() => setAssigningOrderId(null)} className="btn-close-assign">✕</button>
                          </div>
                          {riders.length === 0 ? (
                            <div className="rider-assign-empty">
                              No rider devices registered yet. A rider needs to open <strong>/admin/rider</strong> on their phone first.
                            </div>
                          ) : (
                            riders.map(rider => {
                              const isOnline = rider.lastSeen && (Date.now() - new Date(rider.lastSeen).getTime() < 120000);
                              return (
                                <button
                                  key={rider.id}
                                  onClick={() => handleAssignToRider(order.id, rider.id, rider.deviceName)}
                                  className="rider-assign-option"
                                >
                                  <span className={`rider-status-dot ${isOnline ? 'online' : 'offline'}`} />
                                  <span>{rider.deviceName}</span>
                                  <span className="text-xs text-secondary" style={{ marginLeft: 'auto' }}>
                                    {isOnline ? 'Online' : 'Offline'}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssigningOrderId(order.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <Truck size={14} />
                          {order.assignedRiderName ? 'Reassign' : 'Assign Rider'}
                          <ChevronDown size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                  <div style={{ marginTop: '8px' }}>
                    <Link 
                      href={`/admin/delivery/${order.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', textAlign: 'center', display: 'block' }}
                    >
                      🛵 Route Navigation
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Menu Inventory with Stock and Sold Out controls */}
      {activeTab === 'products' && (
        <div className="card">
          <h3 className="section-title">Menu Inventory & Stocks</h3>
          {productsLoading ? (
            <LoadingSpinner />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {products.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--divider)' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                    <div className="text-xs text-secondary">₱{p.price} • {p.category.toUpperCase()}</div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Stock Counter Control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#f8f0f2', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '2px' }}>Qty:</span>
                      <button
                        onClick={() => handleUpdateStock(p.id, (p.stock || 0) - 1)}
                        className="qty-btn"
                        style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={p.stock !== undefined ? p.stock : 0}
                        onChange={(e) => handleUpdateStock(p.id, e.target.value)}
                        style={{ width: '36px', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}
                      />
                      <button
                        onClick={() => handleUpdateStock(p.id, (p.stock || 0) + 1)}
                        className="qty-btn"
                        style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleProduct(p.id, p.available)}
                      className={`btn btn-sm ${p.available ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minWidth: '90px' }}
                    >
                      {p.available ? 'Active' : 'Sold Out'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Active Deliveries */}
      {activeTab === 'delivery' && (
        <div>
          {activeDeliveries.length === 0 ? (
            <div className="text-center text-secondary py-xl" style={{ padding: '60px 0' }}>No active deliveries on road</div>
          ) : (
            <div className="flex flex-col gap-md">
              {activeDeliveries.map(order => (
                <div key={order.id} className="card">
                  <div className="flex justify-between items-center mb-sm">
                    <div>
                      <div className="font-semibold">{order.userName}</div>
                      <div className="text-xs text-secondary">{order.userPhone}</div>
                    </div>
                    <span className="badge badge-out-for-delivery">{order.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-secondary mb-md">{order.address}</p>
                  
                  {order.assignedRiderName && (
                    <div className="rider-assignment-badge mb-sm">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} />
                        <span>Rider: <strong>{order.assignedRiderName}</strong></span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-sm">
                    <Link 
                      href={`/admin/delivery/${order.id}`}
                      className="btn btn-primary btn-sm btn-block"
                      style={{ textAlign: 'center' }}
                    >
                      Open Navigation Map
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Rider Devices Management */}
      {activeTab === 'riders' && (
        <div>
          <div className="card mb-md">
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} /> Registered Rider Devices
            </h3>
            <p className="text-secondary text-sm mb-md">
              Riders register by opening <strong style={{ color: 'var(--accent)' }}>/admin/rider</strong> on their mobile device and entering the admin password.
            </p>

            {riders.length === 0 ? (
              <div className="text-center text-secondary" style={{ padding: '40px 0' }}>
                <Smartphone size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>No rider devices registered yet</p>
                <p className="text-xs" style={{ marginTop: '4px' }}>Share the rider link with your delivery team</p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {riders.map(rider => {
                  const isOnline = rider.lastSeen && (Date.now() - new Date(rider.lastSeen).getTime() < 120000);
                  const assignedCount = orders.filter(o => o.assignedRiderId === rider.id).length;
                  return (
                    <div key={rider.id} className="rider-device-card">
                      <div className="rider-device-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`rider-status-dot-lg ${isOnline ? 'online' : 'offline'}`} />
                          <div>
                            <div className="rider-device-name">{rider.deviceName}</div>
                            <div className="text-xs text-secondary">
                              {isOnline ? 'Online now' : rider.lastSeen ? `Last seen ${new Date(rider.lastSeen).toLocaleTimeString()}` : 'Never connected'}
                            </div>
                          </div>
                        </div>
                        <div className="rider-device-stats">
                          <span className="rider-stat-badge">{assignedCount} assigned</span>
                          <button
                            onClick={() => handleRemoveRider(rider.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick link to copy */}
          <div className="card">
            <h3 className="section-title">Rider Setup Link</h3>
            <p className="text-secondary text-sm mb-sm">Share this URL with your rider's mobile device:</p>
            <div 
              className="rider-link-box"
              onClick={() => {
                const url = `${window.location.origin}/admin/rider`;
                navigator.clipboard.writeText(url).then(() => {
                  showToast('Rider link copied!', 'success');
                }).catch(() => {
                  showToast('Failed to copy', 'error');
                });
              }}
            >
              <code>{typeof window !== 'undefined' ? `${window.location.origin}/admin/rider` : '/admin/rider'}</code>
              <span className="text-xs" style={{ color: 'var(--accent)' }}>Tap to copy</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
