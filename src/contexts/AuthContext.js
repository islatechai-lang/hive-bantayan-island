'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create user doc in Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (docSnap.exists()) {
            setDbUser(docSnap.data());
          } else {
            // Initialize user doc
            const newUserData = {
              uid: firebaseUser.uid,
              phone: firebaseUser.phoneNumber,
              name: firebaseUser.displayName || 'Sweet Tooth Customer',
              createdAt: new Date().toISOString(),
              address: '',
              location: null
            };
            await setDoc(userRef, newUserData);
            setDbUser(newUserData);
          }
        } catch (err) {
          console.error('Error syncing user doc:', err);
        }
      } else {
        setUser(null);
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Create a fresh RecaptchaVerifier each time we need one
  const setupRecaptcha = useCallback((containerId) => {
    // Clear any existing recaptcha widgets in the container
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
      }
    });

    return verifier;
  }, []);

  const sendOTP = async (phoneNumber) => {
    let verifier = null;
    try {
      verifier = setupRecaptcha('recaptcha-container');
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
      return { success: true };
    } catch (error) {
      console.error('sendOTP error:', error);
      // Clean up failed verifier
      if (verifier) {
        try { verifier.clear(); } catch (e) { /* ignore */ }
      }
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';

      // Return a user-friendly error message
      let message = 'Failed to send verification code.';
      if (error.code === 'auth/invalid-phone-number') {
        message = 'Invalid phone number format. Please check and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/captcha-check-failed') {
        message = 'reCAPTCHA verification failed. Please refresh and try again.';
      } else if (error.code === 'auth/quota-exceeded') {
        message = 'SMS quota exceeded. Please try again later.';
      } else if (error.message) {
        message = error.message;
      }
      return { success: false, message };
    }
  };

  const verifyOTP = async (otpCode) => {
    if (!confirmationResult) {
      return { success: false, message: 'No verification in progress. Please send OTP first.' };
    }
    try {
      const result = await confirmationResult.confirm(otpCode);
      return { success: true, user: result.user };
    } catch (error) {
      console.error('verifyOTP error:', error);
      let message = 'Verification failed.';
      if (error.code === 'auth/invalid-verification-code') {
        message = 'Invalid verification code. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        message = 'Verification code expired. Please request a new one.';
      } else if (error.message) {
        message = error.message;
      }
      return { success: false, message };
    }
  };

  const updateUserName = async (name) => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName: name });
      
      // Update in Firestore
      const userRef = doc(db, 'users', user.uid);
      const updatedData = { ...dbUser, name };
      await setDoc(userRef, updatedData, { merge: true });
      setDbUser(updatedData);
    } catch (error) {
      console.error('Error updating name:', error);
      throw error;
    }
  };

  const updateUserAddress = async (address, location) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedData = { ...dbUser, address, location };
      await setDoc(userRef, updatedData, { merge: true });
      setDbUser(updatedData);
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  };

  const signOut = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{
      user,
      dbUser,
      loading,
      sendOTP,
      verifyOTP,
      signOut,
      updateUserName,
      updateUserAddress
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
