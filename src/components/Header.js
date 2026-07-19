'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, User } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { getCartCount } = useCart();
  const { user } = useAuth();
  const cartCount = getCartCount();

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
                <ShoppingBag size={22} strokeWidth={1.8} />
                {cartCount > 0 && <span className="header-badge">{cartCount}</span>}
              </Link>
              <Link href="/profile" className={`header-btn ${pathname === '/profile' ? 'active' : ''}`} aria-label="View Profile">
                <User size={22} strokeWidth={1.8} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
