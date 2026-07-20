'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

// Throttle interval for Firestore location updates (ms)
const LOCATION_UPDATE_INTERVAL = 15000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);

  const watchIdRef = useRef(null);
  const lastFirestoreUpdateRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create user doc in Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDbUser(data);
            // Restore last known live location
            if (data.liveLocation) {
              setLiveLocation(data.liveLocation);
            }
          } else {
            // Initialize user doc
            const newUserData = {
              uid: firebaseUser.uid,
              phone: firebaseUser.phoneNumber,
              name: firebaseUser.displayName || 'Sweet Tooth Customer',
              createdAt: new Date().toISOString(),
              address: '',
              location: null,
              liveLocation: null
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
        setLiveLocation(null);
        stopTracking();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Median iOS bridge callback globally as early as possible to prevent race conditions
  if (typeof window !== 'undefined' && !window.median_geolocation_ready) {
    window.median_geolocation_ready = () => {
      console.log('Median iOS native location initialization completed (early hook)');
      if (window.triggerStartTracking) {
        window.triggerStartTracking();
      } else {
        window.startTrackingPending = true;
      }
    };
  }

  // Start continuous GPS tracking with watchPosition
  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return; // Already tracking

    const runWatchPosition = () => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported by this browser');
        return;
      }

      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            updatedAt: new Date().toISOString(),
          };

          // Always update local state immediately
          setLiveLocation(loc);

          // Throttle Firestore writes to every LOCATION_UPDATE_INTERVAL
          const now = Date.now();
          if (now - lastFirestoreUpdateRef.current >= LOCATION_UPDATE_INTERVAL) {
            lastFirestoreUpdateRef.current = now;
            try {
              if (auth.currentUser) {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                await setDoc(userRef, { liveLocation: loc }, { merge: true });
              }
            } catch (err) {
              console.error('Error syncing live location:', err);
            }
          }
        },
        (err) => {
          console.error('GPS watchPosition error:', err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        }
      );

      watchIdRef.current = id;
    };

    // --- Median JS Bridge Native App Geolocation Integration ---
    if (typeof window !== 'undefined') {
      // Register the execution trigger for the early hook
      window.triggerStartTracking = runWatchPosition;

      // 1. Android: prompt native permission dialog
      if (window.median?.android?.geoLocation?.promptLocationServices) {
        try {
          window.median.android.geoLocation.promptLocationServices();
        } catch (e) {
          console.warn('Median Android native geolocation permission prompt failed:', e);
        }
      }

      // If the native iOS layer already fired the ready event before React mounted, consume it
      if (window.startTrackingPending) {
        runWatchPosition();
        window.startTrackingPending = false;
        return;
      }

      // Fallback: If running in web browser (not Median iOS wrapper), trigger immediately
      if (!navigator.userAgent.includes('MedianIOS')) {
        runWatchPosition();
      }
    } else {
      runWatchPosition();
    }
  }, []);

  // Stop GPS tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Auto-start tracking immediately when the app loads
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

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

  // Force an immediate location update to Firestore (used before placing an order)
  const forceLocationSync = useCallback(async () => {
    if (!auth.currentUser || !liveLocation) return liveLocation;

    try {
      const freshLoc = { ...liveLocation, updatedAt: new Date().toISOString() };
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { liveLocation: freshLoc }, { merge: true });
      return freshLoc;
    } catch (err) {
      console.error('Force location sync error:', err);
      return liveLocation;
    }
  }, [liveLocation]);

  const signOut = async () => {
    stopTracking();
    return firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      dbUser,
      loading,
      liveLocation,
      sendOTP,
      verifyOTP,
      signOut,
      updateUserName,
      updateUserAddress,
      startTracking,
      stopTracking,
      forceLocationSync
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
