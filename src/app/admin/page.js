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
  const [statusFilter, setStatusFilter] = useState('pending');
  const [inventoryCategory, setInventoryCategory] = useState('all'); // all | cake | milkshake
  const [broadcasting, setBroadcasting] = useState(null); // null | 'restock' | 'open' | 'closed'
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [testingPush, setTestingPush] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState(null);

  const initialLoadRef = useRef(true);

  // Broadcast Notification Handler to all registered customer app devices
  const handleSendBroadcast = async (type) => {
    setBroadcasting(type);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      console.log('📢 [Admin] Broadcast API & OneSignal Result:', data);

      if (!res.ok) throw new Error(data.error || 'Failed to send broadcast');

      const recipients = data.pushResult?.data?.recipients;
      if (recipients === 0) {
        showToast(`📢 ${type.toUpperCase()} alert sent (0 registered devices reached)`, 'info');
      } else if (recipients > 0) {
        showToast(`📢 ${type.toUpperCase()} broadcast sent to ${recipients} device(s)!`, 'success');
      } else {
        showToast(`📢 ${type.toUpperCase()} notification sent to all app customers!`, 'success');
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      showToast('Failed to send broadcast: ' + err.message, 'error');
    } finally {
      setBroadcasting(null);
    }
  };

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

      {/* Desktop Dashboard Overview Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card" style={{ borderLeft: '4px solid #f39c12' }}>
          <div className="admin-stat-icon" style={{ background: '#fef5e7', color: '#f39c12' }}>⏳</div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#333' }}>
              {orders.filter(o => o.status === 'pending').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#777', fontWeight: 600 }}>Pending Review</div>
          </div>
        </div>

        <div className="admin-stat-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div className="admin-stat-icon" style={{ background: '#fde8ec', color: 'var(--accent)' }}>👩‍🍳</div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#333' }}>
              {orders.filter(o => o.status === 'preparing').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#777', fontWeight: 600 }}>Preparing Orders</div>
          </div>
        </div>

        <div className="admin-stat-card" style={{ borderLeft: '4px solid #27ae60' }}>
          <div className="admin-stat-icon" style={{ background: '#e8f7ef', color: '#27ae60' }}>🛵</div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#333' }}>
              {orders.filter(o => o.status === 'out_for_delivery').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#777', fontWeight: 600 }}>Out for Delivery</div>
          </div>
        </div>

        <div className="admin-stat-card" style={{ borderLeft: '4px solid #3498db' }}>
          <div className="admin-stat-icon" style={{ background: '#ebf5fb', color: '#3498db' }}>📱</div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#333' }}>
              {onlineRiders.length} / {riders.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#777', fontWeight: 600 }}>Riders Online</div>
          </div>
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
            {['pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`filter-pill ${statusFilter === f ? 'active' : ''}`}
              >
                {f === 'pending' ? '⏳ PENDING REVIEW' : f.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {ordersLoading ? (
            <LoadingSpinner />
          ) : filteredOrders.length === 0 ? (
            <div className="text-center text-secondary py-xl" style={{ padding: '60px 0' }}>No orders found matching filter</div>
          ) : (
            <div className="admin-orders-grid">
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
                    <strong>Payment:</strong> <span className="text-secondary" style={{ fontWeight: 600 }}>{order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD'}</span>
                    {order.paymentMethod === 'gcash' && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <strong style={{ color: '#2b2b2b', fontSize: '12px' }}>📱 Customer GCash Receipt:</strong>
                          {order.gcashReceiptUrl && (
                            <button
                              onClick={() => setViewingReceiptUrl(order.gcashReceiptUrl)}
                              className="btn btn-xs"
                              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', background: '#e83e8c', color: '#fff', border: 'none', fontWeight: 600 }}
                            >
                              🔍 View Full Image
                            </button>
                          )}
                        </div>

                        {order.gcashReceiptUrl ? (
                          <div 
                            onClick={() => setViewingReceiptUrl(order.gcashReceiptUrl)}
                            style={{ cursor: 'pointer', position: 'relative', width: '100%', maxHeight: '160px', overflow: 'hidden', borderRadius: '6px', border: '1px solid #ddd', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <img
                              src={order.gcashReceiptUrl}
                              alt="GCash Receipt"
                              style={{ width: '100%', height: 'auto', maxHeight: '160px', objectFit: 'contain' }}
                            />
                            <div style={{ position: 'absolute', bottom: 4, right: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                              Tap to inspect receipt
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#721c24', background: '#f8d7da', padding: '6px 10px', borderRadius: '4px' }}>
                            ⚠️ No receipt attached yet
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

                  <div className="admin-order-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Simplified Status Action Buttons with Pending Manual Review */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(order.id, 'preparing')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 2, background: '#28a745', color: '#fff', border: 'none', fontWeight: 600, padding: '8px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            ✅ Approve Payment & Prepare
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 1, background: '#fff0f0', color: '#c0392b', border: '1px solid #f8d7da', fontWeight: 600, padding: '8px 10px', fontSize: '13px' }}
                          >
                            ❌ Reject / Cancel
                          </button>
                        </>
                      )}

                      {order.status === 'preparing' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(order.id, 'out_for_delivery')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm btn-primary"
                            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, padding: '8px 10px', fontSize: '13px' }}
                          >
                            🛵 Out for Delivery
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 1, background: '#fff0f0', color: '#c0392b', border: '1px solid #f8d7da', fontWeight: 600, padding: '8px 10px', fontSize: '13px' }}
                          >
                            ❌ Cancel
                          </button>
                        </>
                      )}

                      {order.status === 'out_for_delivery' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(order.id, 'delivered')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 2, background: '#27ae60', color: '#fff', border: 'none', fontWeight: 600, padding: '8px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            🍰 Mark as Delivered
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 1, background: '#fff0f0', color: '#c0392b', border: '1px solid #f8d7da', fontWeight: 600, padding: '8px 10px', fontSize: '13px' }}
                          >
                            ❌ Cancel
                          </button>
                        </>
                      )}

                      {order.status === 'delivered' && (
                        <div style={{ flex: 1, padding: '8px 12px', background: '#e8f7ef', color: '#27ae60', borderRadius: '8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>
                          ✅ Order Complete & Delivered
                        </div>
                      )}

                      {order.status === 'cancelled' && (
                        <div style={{ flex: 1, padding: '8px 12px', background: '#fdecec', color: '#c0392b', borderRadius: '8px', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>
                          ❌ Order Cancelled
                        </div>
                      )}
                    </div>

                    {/* Assign to Rider section */}
                    <div style={{ position: 'relative' }}>
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
                          {order.assignedRiderName ? `Assigned: ${order.assignedRiderName} (Reassign)` : 'Assign Rider'}
                          <ChevronDown size={12} />
                        </button>
                      )}
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

      {/* Tab Contents: Menu Inventory with Tiramisu & Milkshakes tabs and Broadcast Push buttons */}
      {activeTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Broadcast Push Notifications Card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #fff5f7 0%, #fff 100%)', border: '1px solid #f8d7da' }}>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', marginBottom: '8px' }}>
              📢 Broadcast Customer Push Notifications
            </h3>
            <p className="text-xs text-secondary mb-md">
              Send an instant push notification alert to all app customers on their phones with 1-click.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <button
                onClick={() => handleSendBroadcast('restock')}
                disabled={broadcasting !== null}
                className="btn btn-sm"
                style={{ background: '#e83e8c', color: '#fff', border: 'none', borderRadius: '20px', padding: '10px 14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                🍰 {broadcasting === 'restock' ? 'Broadcasting...' : 'Broadcast Restock'}
              </button>

              <button
                onClick={() => handleSendBroadcast('open')}
                disabled={broadcasting !== null}
                className="btn btn-sm"
                style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: '20px', padding: '10px 14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                🟢 {broadcasting === 'open' ? 'Broadcasting...' : 'Broadcast Store Open'}
              </button>

              <button
                onClick={() => handleSendBroadcast('closed')}
                disabled={broadcasting !== null}
                className="btn btn-sm"
                style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '20px', padding: '10px 14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                🔴 {broadcasting === 'closed' ? 'Broadcasting...' : 'Broadcast Store Closed'}
              </button>
            </div>
          </div>

          {/* Menu Inventory Card with Category Filter Tabs */}
          <div className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Menu Inventory & Stock</h3>
              
              {/* Category Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: '#f5f5f5', padding: '4px', borderRadius: '20px' }}>
                <button
                  onClick={() => setInventoryCategory('all')}
                  className={`btn-xs ${inventoryCategory === 'all' ? 'active' : ''}`}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: inventoryCategory === 'all' ? 'var(--accent)' : 'transparent',
                    color: inventoryCategory === 'all' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  All ({products.length})
                </button>
                <button
                  onClick={() => setInventoryCategory('cake')}
                  className={`btn-xs ${inventoryCategory === 'cake' ? 'active' : ''}`}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: inventoryCategory === 'cake' ? 'var(--accent)' : 'transparent',
                    color: inventoryCategory === 'cake' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  🍰 Tiramisu ({products.filter(p => p.category === 'cake').length})
                </button>
                <button
                  onClick={() => setInventoryCategory('milkshake')}
                  className={`btn-xs ${inventoryCategory === 'milkshake' ? 'active' : ''}`}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: inventoryCategory === 'milkshake' ? 'var(--accent)' : 'transparent',
                    color: inventoryCategory === 'milkshake' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  🥤 Milkshakes ({products.filter(p => p.category === 'milkshake').length})
                </button>
              </div>
            </div>

            {productsLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="admin-products-grid">
                {products
                  .filter(p => inventoryCategory === 'all' || p.category === inventoryCategory)
                  .map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fafafa', borderRadius: '12px', border: '1px solid #eee' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{p.name}</div>
                        <div className="text-xs text-secondary">₱{p.price} • {p.category === 'cake' ? '🍰 TIRAMISU' : '🥤 MILKSHAKE'}</div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {/* Stock Counter Control */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#fff', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '2px' }}>Qty:</span>
                          <button
                            onClick={() => handleUpdateStock(p.id, (p.stock || 0) - 1)}
                            className="qty-btn"
                            style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f5f5f5', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={p.stock !== undefined ? p.stock : 0}
                            onChange={(e) => handleUpdateStock(p.id, e.target.value)}
                            style={{ width: '32px', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}
                          />
                          <button
                            onClick={() => handleUpdateStock(p.id, (p.stock || 0) + 1)}
                            className="qty-btn"
                            style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f5f5f5', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleToggleProduct(p.id, p.available)}
                          className={`btn btn-sm ${p.available ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ minWidth: '80px', padding: '6px 10px', fontSize: '12px' }}
                        >
                          {p.available ? 'Active' : 'Sold Out'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
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

      {/* GCash Receipt Lightbox Modal for High Resolution Inspection */}
      {viewingReceiptUrl && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setViewingReceiptUrl(null)}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#fff',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#333', fontWeight: 'bold' }}>📱 Customer GCash Payment Receipt</h4>
              <button
                onClick={() => setViewingReceiptUrl(null)}
                style={{ background: '#f0f0f0', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflow: 'auto', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={viewingReceiptUrl}
                alt="Customer GCash Receipt Full Resolution"
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
