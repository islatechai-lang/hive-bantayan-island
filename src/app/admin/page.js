'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import Link from 'next/link';

export default function AdminPage() {
  const { showToast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // orders | products | delivery
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('preparing');
  const [audioEnabled, setAudioEnabled] = useState(false);

  const initialLoadRef = useRef(true);

  // Auto-enable audio on first click on document
  useEffect(() => {
    const enableAudio = () => {
      setAudioEnabled(true);
      window.removeEventListener('click', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    return () => window.removeEventListener('click', enableAudio);
  }, []);

  // Verify auth session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('hive_admin_authenticated');
      if (isAuth === 'true') {
        setIsAuthenticated(true);
      }
    }
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

      // Play audio notification on new orders (after initial load)
      setOrders((prevOrders) => {
        if (!initialLoadRef.current && ordersData.length > prevOrders.length) {
          const hasNew = ordersData.some((n) => !prevOrders.some((o) => o.id === n.id));
          if (hasNew) {
            const audio = new Audio('/new-order.mp3');
            audio.play().catch((err) => console.log('Audio autoplay blocked or failed:', err));
          }
        }
        return ordersData;
      });

      setOrdersLoading(false);
      initialLoadRef.current = false;
    }, (error) => {
      console.error('Error listening to orders:', error);
      setOrdersLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Fetch products
  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchProducts() {
      try {
        const querySnapshot = await getDocs(query(collection(db, 'products'), orderBy('sortOrder', 'asc')));
        const productsData = [];
        querySnapshot.forEach((doc) => {
          productsData.push({ id: doc.id, ...doc.data() });
        });
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setProductsLoading(false);
      }
    }

    fetchProducts();
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '1234') {
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('hive_admin_authenticated', 'true');
      }
      showToast('Admin access granted', 'success');
    } else {
      showToast('Invalid password', 'error');
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      // Optimistic status update locally
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

      // Trigger PATCH route to update Firestore & send OneSignal push notification
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Status API error');
      
      showToast(`Order status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to update status', 'error');
    }
  };

  const handleToggleProduct = async (productId, currentAvailability) => {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, { available: !currentAvailability });
      
      // Update local state
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, available: !currentAvailability } : p));
      showToast('Product availability updated!', 'success');
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
      showToast('Stock quantity updated!', 'success');
    } catch (e) {
      showToast('Failed to update stock count', 'error');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <h1 className="auth-brand">Hive Admin Panel</h1>
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
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-pill mt-md">
              Unlock Dashboard
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

  return (
    <div className="page-no-nav">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Hive Admin</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Manage menu inventory and deliveries
            {!audioEnabled && (
              <span style={{ fontSize: '11px', background: 'var(--warning-bg)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                🔊 Tap screen to enable audio alerts
              </span>
            )}
          </p>
        </div>
        <button 
          onClick={() => {
            sessionStorage.removeItem('hive_admin_authenticated');
            setIsAuthenticated(false);
            showToast('Logged out of Admin Panel', 'info');
          }}
          className="btn btn-secondary btn-sm btn-pill"
        >
          Logout
        </button>
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
      </div>

      {/* Tab Contents: Orders list */}
      {activeTab === 'orders' && (
        <div className="flex flex-col gap-md">
          {/* Status Filters */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
            {['preparing', 'pending', 'out_for_delivery', 'delivered', 'cancelled', 'all'].map(f => (
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

                  <div className="admin-order-actions">
                    <select
                      className="status-select"
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    >
                      <option value="pending">Pending Approval</option>
                      <option value="preparing">Start Preparing</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancel Order</option>
                    </select>

                    <Link 
                      href={`/admin/delivery/${order.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, textAlign: 'center' }}
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
    </div>
  );
}
