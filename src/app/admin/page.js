'use client';

import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../lib/firebase';
import { signInAnonymously, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import Link from 'next/link';
import { Truck, Smartphone, Users, ChevronDown, Lightbulb, Heart, Trash2, Sun, Moon, Volume2, VolumeX } from 'lucide-react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234';

export default function AdminPage() {
  const { showToast } = useToast();
  const { theme, isDark, toggleTheme } = useTheme();
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
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [inventoryCategory, setInventoryCategory] = useState('all'); // all | cake | milkshake
  const [broadcasting, setBroadcasting] = useState(null); // null | 'restock' | 'open' | 'closed'
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [storeIsOpen, setStoreIsOpen] = useState(true);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const initialLoadRef = useRef(true);
  const assignRef = useRef(null);

  // Close rider assignment dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (assignRef.current && !assignRef.current.contains(event.target)) {
        setAssigningOrderId(null);
      }
    };

    if (assigningOrderId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [assigningOrderId]);

  // Real-time store status listener in admin: directly reflects Firestore products/store_status
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(doc(db, 'products', 'store_status'), (snap) => {
      if (snap.exists() && typeof snap.data().isOpen === 'boolean') {
        setStoreIsOpen(snap.data().isOpen);
      }
    }, (err) => {
      console.warn('Admin storeStatus subscription warning:', err);
    });

    return () => unsub();
  }, [isAuthenticated]);

  // Broadcast Notification Handler to all registered customer app devices & manage Store Status
  const handleSendBroadcast = async (type) => {
    setBroadcasting(type);
    try {
      // 1. Immediately update storeStatus in Firestore if opening or closing
      if (type === 'open' || type === 'closed') {
        const nextIsOpen = type === 'open';
        setStoreIsOpen(nextIsOpen);
        try {
          await setDoc(doc(db, 'products', 'store_status'), {
            isOpen: nextIsOpen,
            lastAction: type,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Direct storeStatus update warning:', dbErr);
        }
      }

      // 2. Call broadcast API route (triggers OneSignal push)
      let pushOk = false;
      try {
        const res = await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type })
        });
        const data = await res.json().catch(() => ({}));
        console.log('📢 [Admin] Broadcast API & OneSignal Result:', data);
        pushOk = res.ok;
      } catch (fetchErr) {
        console.warn('Broadcast API push dispatch warning:', fetchErr);
      }

      if (type === 'open') {
        showToast('🟢 Store is now OPEN & broadcast alert sent!', 'success');
      } else if (type === 'closed') {
        showToast('🔴 Store is now CLOSED & broadcast alert sent!', 'success');
      } else {
        showToast('📢 Restock notification sent to all app customers!', 'success');
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      showToast('Broadcast error: ' + err.message, 'error');
    } finally {
      setBroadcasting(null);
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

  // Check Admin state on mount (persists across reloads & devices)
  useEffect(() => {
    const isAdmin = typeof window !== 'undefined' && localStorage.getItem('hive_admin_role') === 'true';
    if (isAdmin) {
      setIsAuthenticated(true);
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((err) => console.warn('Admin auto-auth error:', err));
      }
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecking(false);
    });
    setAuthChecking(false);
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
        if (doc.id === 'store_status') return;
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

  // Fetch customer suggestions in real time
  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const suggestionsData = [];
      querySnapshot.forEach((doc) => {
        suggestionsData.push({ id: doc.id, ...doc.data() });
      });
      setSuggestions(suggestionsData);
      setSuggestionsLoading(false);
    }, (error) => {
      console.error('Error listening to suggestions:', error);
      setSuggestionsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleUpdateSuggestionStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'suggestions', id), { status });
      showToast(`Suggestion marked as ${status}!`, 'success');
    } catch (err) {
      console.error('Error updating suggestion status:', err);
      showToast('Failed to update suggestion status', 'error');
    }
  };

  const handleDeleteSuggestion = async (id) => {
    if (!window.confirm('Are you sure you want to delete this suggestion?')) return;
    try {
      await deleteDoc(doc(db, 'suggestions', id));
      showToast('Suggestion deleted', 'info');
    } catch (err) {
      console.error('Error deleting suggestion:', err);
      showToast('Failed to delete suggestion', 'error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password !== ADMIN_PASSWORD) {
      showToast('Invalid password', 'error');
      return;
    }

    setLoggingIn(true);
    try {
      // Try to sign in anonymously if not already signed in with Firebase
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (anonErr) {
          console.warn('Anonymous sign-in not enabled or failed:', anonErr);
        }
      }
      
      // Mark this session as admin in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('hive_admin_role', 'true');
      }
      
      setIsAuthenticated(true);
      showToast('Admin access granted', 'success');
    } catch (error) {
      console.error('Admin login error:', error);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hive_admin_role', 'true');
      }
      setIsAuthenticated(true);
      showToast('Admin access granted', 'success');
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
        body: JSON.stringify({ 
          status: newStatus,
          cancelledBy: newStatus === 'cancelled' ? 'admin' : undefined
        })
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

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setDeletingOrder(true);
    const idToDelete = orderToDelete.id;
    try {
      // 1. Call DELETE API route (uses adminDb)
      const res = await fetch(`/api/orders/${idToDelete}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete order');
      }

      // 2. Remove locally from state for immediate UI feedback
      setOrders(prev => prev.filter(o => o.id !== idToDelete));
      showToast(`Order #${idToDelete.slice(-6).toUpperCase()} removed from list!`, 'success');
      setOrderToDelete(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      // Fallback: Try direct client deleteDoc if API had an issue
      try {
        await deleteDoc(doc(db, 'orders', idToDelete));
        setOrders(prev => prev.filter(o => o.id !== idToDelete));
        showToast(`Order #${idToDelete.slice(-6).toUpperCase()} removed!`, 'success');
        setOrderToDelete(null);
      } catch (clientErr) {
        showToast('Error removing order: ' + err.message, 'error');
      }
    } finally {
      setDeletingOrder(false);
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
      <div className="auth-page" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun size={14} color="#FBBF24" /> : <Moon size={14} color="var(--accent)" />}
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
        <h1 className="auth-brand">Bantayan Hive Admin Panel</h1>
        <p className="auth-tagline text-secondary text-sm">Please enter passkey to continue</p>
        <div className="auth-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
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
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
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

  // Filter orders and compute status category counts
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const outOrders = orders.filter(o => o.status === 'out_for_delivery');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Bantayan Hive Admin</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span className="text-secondary text-xs">Menu, inventory &amp; real-time orders</span>
            <button
              onClick={() => {
                if (!audioEnabled) {
                  setAudioEnabled(true);
                  showToast('Audio alerts enabled', 'success');
                } else {
                  setAudioEnabled(false);
                  showToast('Audio alerts muted', 'info');
                }
              }}
              style={{
                fontSize: '11px',
                background: audioEnabled ? 'rgba(34, 197, 94, 0.12)' : 'var(--warning-bg)',
                color: audioEnabled ? '#10b981' : 'var(--warning)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Click to toggle order notification sound"
            >
              {audioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              {audioEnabled ? 'Audio Active' : 'Tap to Enable Audio'}
            </button>
            {onlineRiders.length > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.12)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                {onlineRiders.length} rider{onlineRiders.length > 1 ? 's' : ''} online
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Dark / Light Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun size={14} color="#FBBF24" /> : <Moon size={14} color="var(--accent)" />}
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{isDark ? 'Light' : 'Dark'}</span>
          </button>

          {/* Live Store Status Pill */}
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 700, 
            padding: '6px 12px', 
            borderRadius: '20px', 
            background: storeIsOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
            color: storeIsOpen ? '#10b981' : '#ef4444',
            border: `1px solid ${storeIsOpen ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeIsOpen ? '#10b981' : '#ef4444' }}></span>
            <span>Store: {storeIsOpen ? 'OPEN' : 'CLOSED'}</span>
          </div>

          <button 
            onClick={handleLogout}
            className="btn btn-secondary btn-sm btn-pill"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs with Count Badges */}
      <div className="category-tabs mb-lg">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`category-tab ${activeTab === 'orders' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Orders</span>
          <span className="tab-count-badge">{orders.length}</span>
          {pendingOrders.length > 0 && (
            <span className="tab-alert-pill" title={`${pendingOrders.length} pending orders need review`}>
              {pendingOrders.length} new
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`category-tab ${activeTab === 'products' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Inventory</span>
          <span className="tab-count-badge">{products.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('delivery')}
          className={`category-tab ${activeTab === 'delivery' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Deliveries</span>
          <span className="tab-count-badge">{activeDeliveries.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('riders')}
          className={`category-tab ${activeTab === 'riders' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Smartphone size={14} />
          <span>Riders</span>
          <span className="tab-count-badge">{onlineRiders.length}/{riders.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('suggestions')}
          className={`category-tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Lightbulb size={14} />
          <span>Suggestions</span>
          <span className="tab-count-badge">{suggestions.length}</span>
        </button>
      </div>

      {/* Tab Contents: Orders list */}
      {activeTab === 'orders' && (
        <div className="flex flex-col gap-md">
          {/* Status Filter Pills with Counts */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
            {[
              { key: 'pending', label: 'Pending Review', count: pendingOrders.length, icon: '⏳', isAlert: pendingOrders.length > 0 },
              { key: 'preparing', label: 'Preparing', count: preparingOrders.length, icon: '👩‍🍳' },
              { key: 'out_for_delivery', label: 'Out for Delivery', count: outOrders.length, icon: '🛵' },
              { key: 'delivered', label: 'Delivered', count: deliveredOrders.length, icon: '🍰' },
              { key: 'cancelled', label: 'Cancelled', count: cancelledOrders.length, icon: '❌' },
              { key: 'all', label: 'All Orders', count: orders.length, icon: '📋' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`filter-pill ${statusFilter === f.key ? 'active' : ''} ${f.isAlert && statusFilter !== f.key ? 'filter-pill-alert' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{f.icon} {f.label}</span>
                <span className="filter-pill-count">{f.count}</span>
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

                  <div className="admin-order-items" style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="admin-order-item">
                        <span>{item.quantity}x {item.name}</span>
                        <span>₱{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
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
                      <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '12px' }}>📱 Customer GCash Receipt:</strong>
                          {order.gcashReceiptUrl && (
                            <button
                              onClick={() => setViewingReceiptUrl(order.gcashReceiptUrl)}
                              className="btn btn-xs"
                              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600 }}
                            >
                              🔍 View Full Image
                            </button>
                          )}
                        </div>

                        {order.gcashReceiptUrl ? (
                          <div 
                            onClick={() => setViewingReceiptUrl(order.gcashReceiptUrl)}
                            style={{ cursor: 'pointer', position: 'relative', width: '100%', maxHeight: '160px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border)', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                          <div style={{ fontSize: '12px', color: 'var(--error)', background: 'var(--error-bg)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
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
                            style={{ flex: 2, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, padding: '8px 10px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            ✅ Approve Payment &amp; Prepare
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 1, background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, padding: '8px 10px', fontSize: '13px', borderRadius: '8px' }}
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
                            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, padding: '8px 10px', fontSize: '13px', borderRadius: '8px' }}
                          >
                            🛵 Out for Delivery
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 1, background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, padding: '8px 10px', fontSize: '13px', borderRadius: '8px' }}
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
                            style={{ flex: 2, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, padding: '8px 10px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            🍰 Mark as Delivered
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={updatingStatusId === order.id}
                            className="btn btn-sm"
                            style={{ flex: 1, background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, padding: '8px 10px', fontSize: '13px', borderRadius: '8px' }}
                          >
                            ❌ Cancel
                          </button>
                        </>
                      )}

                      {order.status === 'delivered' && (
                        <div style={{ flex: 1, padding: '8px 12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          ✅ Order Complete &amp; Delivered
                        </div>
                      )}

                      {order.status === 'cancelled' && (
                        <div style={{ flex: 1, padding: '8px 12px', background: 'var(--error-bg)', color: 'var(--error)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                          <div>❌ Order Cancelled {order.cancelledBy === 'customer' ? '(by Customer)' : '(by Admin)'}</div>
                          {order.cancelReason && (
                            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--error)', marginTop: '3px' }}>
                              Reason: {order.cancelReason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Assign to Rider section */}
                    <div style={{ position: 'relative' }}>
                      {assigningOrderId === order.id ? (
                        <div ref={assignRef} className="rider-assign-dropdown">
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

                  {(order.status === 'delivered' || order.status === 'cancelled') && (
                    <div style={{ marginTop: '8px' }}>
                      <button
                        onClick={() => setOrderToDelete(order)}
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          background: 'var(--error-bg)',
                          color: 'var(--error)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          fontSize: '12px',
                          borderRadius: '8px',
                          padding: '7px 10px'
                        }}
                      >
                        <Trash2 size={13} /> Delete / Remove Order
                      </button>
                    </div>
                  )}
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
          <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', margin: 0 }}>
                📢 Broadcast &amp; Store Status Controls
              </h3>
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: '16px', 
                background: storeIsOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                color: storeIsOpen ? '#10b981' : '#ef4444',
                border: storeIsOpen ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                Live Store Status: {storeIsOpen ? '🟢 OPEN' : '🔴 CLOSED'}
              </div>
            </div>
            <p className="text-xs text-secondary mb-md">
              Send an instant push alert to customers. Clicking <strong>Broadcast Store Open</strong> or <strong>Broadcast Store Closed</strong> immediately updates the live store status across the customer app and cart.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <button
                onClick={() => handleSendBroadcast('restock')}
                disabled={broadcasting !== null}
                className="btn btn-sm"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '20px', padding: '10px 14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                🍰 {broadcasting === 'restock' ? 'Broadcasting...' : 'Broadcast Restock'}
              </button>

              <button
                onClick={() => handleSendBroadcast('open')}
                disabled={broadcasting !== null}
                className="btn btn-sm"
                style={{ 
                  background: '#10b981', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '20px', 
                  padding: '10px 14px', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  boxShadow: storeIsOpen ? '0 0 0 2px var(--bg-secondary), 0 0 0 4px #10b981' : 'none'
                }}
              >
                🟢 {broadcasting === 'open' ? 'Opening Store...' : 'Broadcast Store Open'}
              </button>

              <button
                onClick={() => handleSendBroadcast('closed')}
                disabled={broadcasting !== null}
                className="btn btn-sm"
                style={{ 
                  background: '#ef4444', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '20px', 
                  padding: '10px 14px', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  boxShadow: !storeIsOpen ? '0 0 0 2px var(--bg-secondary), 0 0 0 4px #ef4444' : 'none'
                }}
              >
                🔴 {broadcasting === 'closed' ? 'Closing Store...' : 'Broadcast Store Closed'}
              </button>
            </div>
          </div>

          {/* Menu Inventory Card with Category Filter Tabs */}
          <div className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Menu Inventory &amp; Stock</h3>
              
              {/* Category Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '20px', border: '1px solid var(--border)' }}>
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
                  🥤 Shakes &amp; Drinks ({products.filter(p => p.category === 'milkshake').length})
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
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{p.name}</span>
                          {p.comingSoon && (
                            <span style={{ fontSize: '10px', background: 'rgba(244, 140, 160, 0.18)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
                              COMING SOON
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-secondary">
                          ₱{p.price} • {p.category === 'cake' ? '🍰 TIRAMISU' : '🥤 DRINKS'}
                          {Math.max(0, p.interestCount || 0) > 0 && (
                            <span style={{ marginLeft: '6px', color: '#ef4444', fontWeight: 600 }}>
                              • ❤️ {Math.max(0, p.interestCount)} {Math.max(0, p.interestCount) === 1 ? 'person wants' : 'people want'} this
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {/* Stock Counter Control */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '2px' }}>Qty:</span>
                          <button
                            onClick={() => handleUpdateStock(p.id, (p.stock || 0) - 1)}
                            className="qty-btn"
                            style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={p.stock !== undefined ? p.stock : 0}
                            onChange={(e) => handleUpdateStock(p.id, e.target.value)}
                            style={{ width: '32px', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}
                          />
                          <button
                            onClick={() => handleUpdateStock(p.id, (p.stock || 0) + 1)}
                            className="qty-btn"
                            style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
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
            <div className="admin-orders-grid">
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
              <div className="admin-products-grid">
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

      {/* Tab Contents: Customer Suggestions & Wishlist */}
      {activeTab === 'suggestions' && (
        <div className="flex flex-col gap-md">
          {/* Coming Soon Demand Summary */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Heart size={18} color="#ef4444" fill="#ef4444" />
              <h3 className="section-title" style={{ margin: 0 }}>Upcoming Drinks Wishlist Demand</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {products.filter(p => p.comingSoon).map(prod => (
                <div key={prod.id} style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{prod.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>₱{prod.price} • Coming Soon</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
                      {Math.max(0, prod.interestCount || 0)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>WANTS</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Flavor Suggestions */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lightbulb size={18} color="#f59e0b" />
                <h3 className="section-title" style={{ margin: 0 }}>Customer Food & Drink Requests ({suggestions.length})</h3>
              </div>
            </div>

            {suggestionsLoading ? (
              <LoadingSpinner />
            ) : suggestions.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Lightbulb size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, margin: 0 }}>No customer requests yet.</p>
                <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  When island visitors tap "Request Food or Drinks" on the Coming Soon tab, their ideas will appear here!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suggestions.map((item) => {
                  const categoryLabels = {
                    burger: '🍔 Burger & Sandwich',
                    snack: '🍟 Snacks & Sides',
                    shake: '🥤 Milkshake',
                    coffee: '☕ Coffee / Drink',
                    cake: '🍰 Tiramisu / Cake',
                    meal: '🍽️ Rice Meal / Main',
                    other: '✨ Other Food or Drink'
                  };

                  const statusColors = {
                    new: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'New Idea' },
                    considering: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Under Consideration' },
                    planned: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', label: 'Planned for Menu' },
                    archived: { bg: 'rgba(156, 163, 175, 0.15)', text: 'var(--text-secondary)', label: 'Archived' }
                  };

                  const currentStatus = statusColors[item.status] || statusColors.new;

                  return (
                    <div 
                      key={item.id}
                      style={{ 
                        padding: '16px', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border)', 
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: currentStatus.bg, color: currentStatus.text }}>
                              {currentStatus.label}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                              {categoryLabels[item.category] || item.category}
                            </span>
                          </div>

                          {item.notes && (
                            <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              "{item.notes}"
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleUpdateSuggestionStatus(item.id, item.status === 'considering' ? 'new' : 'considering')}
                            className="btn btn-xs"
                            style={{ 
                              background: item.status === 'considering' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)', 
                              color: item.status === 'considering' ? '#10b981' : 'var(--text-primary)',
                              border: '1px solid var(--border)',
                              borderRadius: '14px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {item.status === 'considering' ? '✓ Considering' : 'Consider'}
                          </button>

                          <button
                            onClick={() => handleUpdateSuggestionStatus(item.id, item.status === 'archived' ? 'new' : 'archived')}
                            className="btn btn-xs"
                            style={{ 
                              background: 'var(--bg-tertiary)', 
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border)',
                              borderRadius: '14px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            {item.status === 'archived' ? 'Unarchive' : 'Archive'}
                          </button>

                          <button
                            onClick={() => handleDeleteSuggestion(item.id)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: 'var(--text-secondary)', 
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Delete suggestion"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Customer attribution info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', paddingTop: '8px', borderTop: '1px dashed var(--border)', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>Suggested by: <strong style={{ color: 'var(--text-primary)' }}>{item.userName && item.userName !== 'Sweet Tooth Customer' ? item.userName : 'Customer'}</strong></span>
                          {item.userPhone ? (
                            <a 
                              href={`tel:${item.userPhone}`} 
                              style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              📞 {item.userPhone}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.74rem' }}>
                              (No phone provided)
                            </span>
                          )}
                        </div>
                        <div>
                          {item.createdAt && new Date(item.createdAt?.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 'bold' }}>📱 Customer GCash Payment Receipt</h4>
              <button
                onClick={() => setViewingReceiptUrl(null)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => !deletingOrder && setOrderToDelete(null)}
        >
          <div 
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              maxWidth: '420px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)', flexShrink: 0 }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Remove Order?</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Order #{orderToDelete.id.slice(-6).toUpperCase()} ({orderToDelete.status.toUpperCase()})
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to permanently delete this order from the system? This action will remove the record completely to keep your orders board clean and organized.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                disabled={deletingOrder}
                className="btn btn-ghost"
                style={{ flex: 1, padding: '10px' }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
                disabled={deletingOrder}
                className="btn"
                style={{
                  flex: 1,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  padding: '10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {deletingOrder ? 'Removing...' : 'Delete Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
