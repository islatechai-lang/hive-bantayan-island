'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../../components/LoadingSpinner';
import { LogOutIcon, ChevronRightIcon, DeliveryIcon, PhoneIcon } from '../../components/Icons';

export default function ProfilePage() {
  const { user, dbUser, signOut, updateUserName } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [updating, setUpdating] = useState(false);

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
      <div className="page-header" style={{ justifyContent: 'center', textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title">Profile Settings</h1>
      </div>

      <div className="profile-avatar" style={{ background: 'var(--card-bg-accent)', color: 'var(--accent)', fontWeight: 800 }}>
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
              <PhoneIcon className="w-4 h-4 text-secondary" style={{ width: '1rem', height: '1rem' }} />
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
          {/* Order history redirection link */}
          <div className="profile-item" onClick={() => router.push('/orders')} style={{ cursor: 'pointer', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div className="profile-item-left">
              <span className="profile-item-icon" style={{ background: 'rgba(235, 104, 126, 0.1)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '50%' }}>
                <DeliveryIcon className="w-5 h-5" style={{ width: '1.25rem', height: '1.25rem' }} />
              </span>
              <span className="profile-item-label" style={{ fontWeight: 600 }}>My Orders</span>
            </div>
            <span className="profile-item-arrow" style={{ display: 'flex', alignItems: 'center' }}>
              <ChevronRightIcon className="w-5 h-5 text-secondary" style={{ width: '1.25rem', height: '1.25rem' }} />
            </span>
          </div>

          {/* Logout button */}
          <div className="profile-item" onClick={handleSignOut} style={{ cursor: 'pointer', color: 'var(--error)' }}>
            <div className="profile-item-left">
              <span className="profile-item-icon" style={{ background: 'var(--error-bg)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '50%' }}>
                <LogOutIcon className="w-5 h-5" style={{ width: '1.25rem', height: '1.25rem' }} />
              </span>
              <span className="profile-item-label" style={{ fontWeight: 600 }}>Log Out</span>
            </div>
            <span className="profile-item-arrow" style={{ display: 'flex', alignItems: 'center' }}>
              <ChevronRightIcon className="w-5 h-5 text-secondary" style={{ width: '1.25rem', height: '1.25rem', opacity: 0.5 }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
