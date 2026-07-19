'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { CartIcon, UserIcon } from './Icons';

export default function Header() {
  const pathname = usePathname();
  const { getCartCount } = useCart();
  const { user } = useAuth();
  
  const cartCount = getCartCount();

  // Hide header in admin routes and login route
  if (pathname?.startsWith('/admin') || pathname === '/login') {
    return null;
  }

  return (
    <header className="sticky-header">
      <div className="header-container">
        <Link href="/" className="header-logo">
          <span className="logo-icon">🍰</span>
          <span className="logo-text">Hive</span>
        </Link>

        <div className="header-actions">
          {user && (
            <>
              <Link href="/cart" className={`header-btn ${pathname === '/cart' ? 'active' : ''}`} aria-label="View Cart">
                <CartIcon className="w-6 h-6" />
                {cartCount > 0 && <span className="header-badge">{cartCount}</span>}
              </Link>

              <Link href="/profile" className={`header-btn ${pathname === '/profile' ? 'active' : ''}`} aria-label="View Profile">
                <UserIcon className="w-6 h-6" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
