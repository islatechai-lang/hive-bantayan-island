'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && auth) {
      const urlParams = new URLSearchParams(window.location.search);
      const isTestMode = urlParams.get('test') === 'true';

      if (
        process.env.NODE_ENV === 'development' || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        isTestMode
      ) {
        auth.settings.appVerificationDisabledForTesting = true;
        console.log('Firebase App Verification (reCAPTCHA) bypassed for testing');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create user doc in Firestore
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
      } else {
        setUser(null);
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Initialize invisible recaptcha verifier
  const initRecaptcha = (buttonId) => {
    if (recaptchaVerifier) return recaptchaVerifier;
    try {
      const verifier = new RecaptchaVerifier(auth, buttonId, {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
        }
      });
      setRecaptchaVerifier(verifier);
      return verifier;
    } catch (error) {
      console.error('Error initializing RecaptchaVerifier:', error);
      return null;
    }
  };

  const sendOTP = async (phoneNumber, buttonId) => {
    try {
      const verifier = initRecaptcha(buttonId);
      if (!verifier) throw new Error('reCAPTCHA verifier not initialized');
      
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
      return true;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  };

  const verifyOTP = async (otpCode) => {
    if (!confirmationResult) throw new Error('No verification code sent yet');
    try {
      const result = await confirmationResult.confirm(otpCode);
      return result.user;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
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
