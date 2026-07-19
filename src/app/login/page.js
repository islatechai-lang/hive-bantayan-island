'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '../../contexts/ToastContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { PhoneIcon } from '../../components/Icons';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const { user, sendOTP, verifyOTP, updateUserName, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone'); // phone | otp | signup-name
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  const otpRefs = useRef([]);

  // Redirect only if authenticated AND has a customized name set
  useEffect(() => {
    if (user && step !== 'signup-name') {
      const checkUserDoc = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name && data.name !== 'Sweet Tooth Customer') {
              router.push('/');
            } else {
              setStep('signup-name');
            }
          } else {
            setStep('signup-name');
          }
        } catch (e) {
          router.push('/');
        }
      };
      checkUserDoc();
    }
  }, [user, step, router]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber || phoneNumber.length < 10) {
      showToast('Please enter a valid 10-digit phone number', 'error');
      return;
    }
    
    setSendingOTP(true);
    
    // Format to E.164: +63XXXXXXXXXX
    const cleanPhone = phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber;
    const formattedPhone = `+63${cleanPhone}`;

    console.log('Sending OTP to:', formattedPhone);

    const result = await sendOTP(formattedPhone);
    
    if (result.success) {
      showToast('OTP code sent successfully! Check your SMS.', 'success');
      setStep('otp');
      // Auto-focus first OTP input
      setTimeout(() => {
        if (otpRefs.current[0]) otpRefs.current[0].focus();
      }, 100);
    } else {
      showToast(result.message, 'error');
    }
    
    setSendingOTP(false);
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    // Auto-focus next field
    if (value !== '' && index < 5) {
      otpRefs.current[index + 1].focus();
    }

    // Auto-submit when all 6 digits entered
    if (index === 5 && value !== '') {
      const fullCode = [...newOtp].join('');
      if (fullCode.length === 6) {
        handleAutoVerify(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otpCode[index] === '' && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 6) {
      const newOtp = pasteData.split('');
      setOtpCode(newOtp);
      otpRefs.current[5].focus();
      handleAutoVerify(pasteData);
    }
  };

  const handleAutoVerify = async (code) => {
    setVerifyingOTP(true);
    console.log('Auto-verifying OTP code:', code);
    
    const result = await verifyOTP(code);
    
    if (result.success) {
      // Check if user already has a saved name
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().name && userSnap.data().name !== 'Sweet Tooth Customer') {
        showToast('Successfully logged in! 🎉', 'success');
        router.push('/');
      } else {
        showToast('Verification successful! Set your name to complete signup.', 'success');
        setStep('signup-name');
      }
    } else {
      showToast(result.message, 'error');
    }
    setVerifyingOTP(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const fullOtp = otpCode.join('');
    
    if (fullOtp.length < 6) {
      showToast('Please enter all 6 digits', 'error');
      return;
    }

    setVerifyingOTP(true);
    console.log('Verifying OTP code:', fullOtp);
    
    const result = await verifyOTP(fullOtp);
    
    if (result.success) {
      // Check if user already has a saved name
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().name && userSnap.data().name !== 'Sweet Tooth Customer') {
        showToast('Successfully logged in! 🎉', 'success');
        router.push('/');
      } else {
        showToast('Verification successful! Set your name to complete signup.', 'success');
        setStep('signup-name');
      }
    } else {
      showToast(result.message, 'error');
      setVerifyingOTP(false);
    }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    setSavingName(true);
    try {
      await updateUserName(fullName.trim());
      showToast('Profile created successfully! Welcome! 🎉', 'success');
      router.push('/');
    } catch (e) {
      showToast('Failed to save name. Please try again.', 'error');
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage={true} text="Initializing..." />;
  }

  return (
    <div className="auth-page">
      <div className="auth-logo" style={{ fontSize: '3rem', margin: '0 auto 1.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '5rem', height: '5rem', background: 'var(--card-bg-accent)', borderRadius: '50%' }}>🍰</div>
      <h1 className="auth-brand">Hive Bantayan</h1>
      <p className="auth-tagline">Sweet Tiramisu & Milkshakes Delivered to You</p>

      <div className="auth-card">
        {step === 'phone' && (
          <form onSubmit={handleSendOTP}>
            <h2>Customer Login</h2>
            <p className="text-secondary text-sm mb-lg text-center">
              Enter your mobile number to sign in or create an account via SMS verification code.
            </p>
            
            <div className="input-group">
              <label className="input-label">Phone Number</label>
              <div className="phone-input-group">
                <span className="phone-prefix" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <PhoneIcon className="w-4 h-4 text-secondary" style={{ width: '1rem', height: '1rem' }} /> +63
                </span>
                <input
                  type="tel"
                  className="input"
                  placeholder="912 345 6789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  disabled={sendingOTP}
                  required
                  maxLength="10"
                  autoComplete="tel"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block mt-lg btn-pill"
              disabled={sendingOTP || phoneNumber.length < 10}
            >
              {sendingOTP ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP}>
            <h2>Enter 6-Digit OTP</h2>
            <p className="text-secondary text-sm mb-lg text-center">
              We sent a verification code to your phone number.
            </p>

            <div className="otp-inputs">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  className="otp-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={idx === 0 ? handleOtpPaste : undefined}
                  disabled={verifyingOTP}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block mt-lg btn-pill"
              disabled={verifyingOTP || otpCode.join('').length < 6}
            >
              {verifyingOTP ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-block mt-sm"
              onClick={() => {
                setStep('phone');
                setOtpCode(['', '', '', '', '', '']);
              }}
              disabled={verifyingOTP}
            >
              Change Phone Number
            </button>
          </form>
        )}

        {step === 'signup-name' && (
          <form onSubmit={handleSaveName}>
            <h2>What is your name?</h2>
            <p className="text-secondary text-sm mb-lg text-center">
              Please enter your full name. This will help our riders find and contact you when delivering your order!
            </p>
            
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your name..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={savingName}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block mt-lg btn-pill"
              disabled={savingName || !fullName.trim()}
            >
              {savingName ? 'Completing signup...' : 'Complete Signup'}
            </button>
          </form>
        )}
      </div>
      
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
