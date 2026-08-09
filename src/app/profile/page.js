'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../../components/LoadingSpinner';
import PolicyModal from '../../components/PolicyModal';
import { LogOut, ChevronRight, ChevronLeft, Truck, Phone } from 'lucide-react';

export default function ProfilePage() {
  const { user, dbUser, signOut, updateUserName } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [policyType, setPolicyType] = useState(null); // 'terms' | 'privacy' | null

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (dbUser) {
      setName(dbUser.name || '');
    }
  }, [dbUser]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    setUpdating(true);
    try {
      await updateUserName(name);
      showToast('Profile updated successfully!', 'success');
    } catch (error) {
      showToast('Failed to update profile name', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast('Signed out successfully', 'success');
      router.push('/login');
    } catch (e) {
      showToast('Failed to sign out', 'error');
    }
  };

  if (!user) {
    return <LoadingSpinner fullPage={true} text="Verifying session..." />;
  }

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'center', marginBottom: '2rem' }}>
        <button 
          onClick={() => router.push('/')} 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.8rem', background: '#f5f5f5', border: 'none', borderRadius: '20px' }}
        >
          <ChevronLeft size={16} /> Menu
        </button>
        <h1 className="page-title" style={{ flex: 1, textAlign: 'center', marginRight: '64px' }}>Profile Settings</h1>
      </div>

      <div className="profile-avatar">
        {name.slice(0, 1).toUpperCase() || 'S'}
      </div>

      <form onSubmit={handleUpdateProfile} className="card">
        <h3 className="section-title">Edit Profile</h3>
        
        <div className="input-group">
          <label className="input-label">Display Name</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={updating}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label">Phone Number</label>
          <div className="phone-input-group" style={{ opacity: 0.8 }}>
            <span className="phone-prefix" style={{ background: '#f5f5f5', borderRight: '1px solid #ddd', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center' }}>
              <Phone size={16} className="text-secondary" />
            </span>
            <input
              type="text"
              className="input"
              value={user.phoneNumber || ''}
              disabled={true}
              style={{ background: '#f5f5f5', borderLeft: 'none' }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block btn-pill mt-md"
          disabled={updating || name === dbUser?.name}
        >
          {updating ? 'Updating...' : 'Save Changes'}
        </button>
      </form>

      <div className="card mt-md">
        <h3 className="section-title">My Account</h3>
        
        <div className="profile-section">
          <div className="profile-item" onClick={() => router.push('/orders')} style={{ cursor: 'pointer', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div className="profile-item-left">
              <span className="profile-item-icon" style={{ background: 'rgba(235, 104, 126, 0.1)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '50%' }}>
                <Truck size={20} />
              </span>
              <span className="profile-item-label" style={{ fontWeight: 600 }}>My Orders</span>
            </div>
            <span className="profile-item-arrow" style={{ display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={18} className="text-secondary" />
            </span>
          </div>

          <div className="profile-item" onClick={handleSignOut} style={{ cursor: 'pointer', color: 'var(--error)' }}>
            <div className="profile-item-left">
              <span className="profile-item-icon" style={{ background: 'var(--error-bg)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '50%' }}>
                <LogOut size={20} />
              </span>
              <span className="profile-item-label" style={{ fontWeight: 600 }}>Log Out</span>
            </div>
            <span className="profile-item-arrow" style={{ display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={18} className="text-secondary" style={{ opacity: 0.5 }} />
            </span>
          </div>
        </div>
      </div>

      {/* Terms & Privacy Policy Footer */}
      <div className="text-center text-xs text-secondary mt-xl pb-lg" style={{ opacity: 0.85 }}>
        <p style={{ margin: '0 0 4px' }}>Bantayan Hive v1.0.0</p>
        <p style={{ margin: 0 }}>
          <button 
            type="button" 
            onClick={() => setPolicyType('terms')} 
            style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            Terms of Service
          </button>
          {' • '}
          <button 
            type="button" 
            onClick={() => setPolicyType('privacy')} 
            style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            Privacy Policy
          </button>
        </p>
      </div>

      {/* Policy Modal */}
      {policyType && (
        <PolicyModal type={policyType} onClose={() => setPolicyType(null)} />
      )}
    </div>
  );
}
