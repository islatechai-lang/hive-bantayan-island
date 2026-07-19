'use client';

import React, { useState, useEffect } from 'react';
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
  const [statusFilter, setStatusFilter] = useState('all');

  // Verify auth session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('hive_admin_authenticated');
      if (isAuth === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Fetch orders in real time
  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = [];
      querySnapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() });
      });
      setOrders(ordersData);
      setOrdersLoading(false);
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
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-pill mt-md">
              Login
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

  // Active delivery orders (preparing or out_for_delivery)
  const activeDeliveries = orders.filter(o => o.status === 'preparing' || o.status === 'out_for_delivery');

  return (
    <div className="page-no-nav" style={{ paddingBottom: '40px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ color: 'var(--accent)' }}>Admin Workspace</h1>
          <p className="page-subtitle">Real-time Order & Delivery Management</p>
        </div>
        <button 
          onClick={() => {
            sessionStorage.removeItem('hive_admin_authenticated');
            setIsAuthenticated(false);
          }} 
          className="btn btn-secondary btn-sm"
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
        >
          Orders ({orders.length})
        </button>
        <button 
          onClick={() => setActiveTab('products')} 
          className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`}
        >
          Menu Inventory
        </button>
        <button 
          onClick={() => setActiveTab('delivery')} 
          className={`admin-tab ${activeTab === 'delivery' ? 'active' : ''}`}
        >
          Active Deliveries ({activeDeliveries.length})
        </button>
      </div>

      {/* Tab Contents: Orders */}
      {activeTab === 'orders' && (
        <div>
          {/* Status Filters */}
          <div className="filter-pills">
            {['all', 'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map(f => (
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
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><LoadingSpinner /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center text-secondary py-xl" style={{ padding: '60px 0' }}>No orders found matching filter</div>
          ) : (
            <div className="flex flex-col gap-md">
              {filteredOrders.map(order => (
                <div key={order.id} className="admin-order-card">
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
                    {order.addressNotes && (
                      <p className="text-secondary" style={{ fontStyle: 'italic' }}>Note: {order.addressNotes}</p>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                    <strong>Payment:</strong> <span className="text-secondary">{order.paymentMethod.toUpperCase()}</span>
                    {order.paymentMethod === 'gcash' && order.gcashReceiptUrl && (
                      <div style={{ marginTop: '4px' }}>
                        <a href={order.gcashReceiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                          View Uploaded GCash Receipt 📸
                        </a>
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
                      <option value="confirmed">Confirm Order</option>
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

      {/* Tab Contents: Menu Inventory */}
      {activeTab === 'products' && (
        <div className="card">
          <h3 className="section-title">In-Stock Toggles</h3>
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
                  
                  <button
                    onClick={() => handleToggleProduct(p.id, p.available)}
                    className={`btn btn-sm ${p.available ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {p.available ? 'In Stock (Active)' : 'Sold Out (Disabled)'}
                  </button>
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
