'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../contexts/CartContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { getCartCount } = useCart();
  const cartCount = getCartCount();

  // Hide bottom nav in admin routes and login route
  if (pathname?.startsWith('/admin') || pathname === '/login') {
    return null;
  }

  return (
    <nav className="bottom-nav">
      <Link href="/" className={`bottom-nav-item ${pathname === '/' ? 'active' : ''}`}>
        <span className="bottom-nav-icon">🏠</span>
        <span className="bottom-nav-label">Menu</span>
      </Link>
      
      <Link href="/cart" className={`bottom-nav-item ${pathname === '/cart' ? 'active' : ''}`}>
        <span className="bottom-nav-icon">🛒</span>
        {cartCount > 0 && <span className="bottom-nav-badge">{cartCount}</span>}
        <span className="bottom-nav-label">Cart</span>
      </Link>

      <Link href="/orders" className={`bottom-nav-item ${pathname === '/orders' ? 'active' : ''}`}>
        <span className="bottom-nav-icon">📋</span>
        <span className="bottom-nav-label">Orders</span>
      </Link>

      <Link href="/profile" className={`bottom-nav-item ${pathname === '/profile' ? 'active' : ''}`}>
        <span className="bottom-nav-icon">👤</span>
        <span className="bottom-nav-label">Profile</span>
      </Link>
    </nav>
  );
}
