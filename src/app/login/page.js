'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '../../contexts/ToastContext';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function LoginPage() {
  const { user, sendOTP, verifyOTP, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone'); // phone | otp
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  
  const otpRefs = useRef([]);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }
    
    setSendingOTP(true);
    // Format to E.164: +63XXXXXXXXXX
    const cleanPhone = phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber;
    const formattedPhone = `+63${cleanPhone}`;

    try {
      await sendOTP(formattedPhone, 'recaptcha-container');
      showToast('OTP code sent successfully!', 'success');
      setStep('otp');
    } catch (error) {
      showToast(error.message || 'Failed to send OTP code. Try again.', 'error');
    } finally {
      setSendingOTP(false);
    }
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
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otpCode[index] === '' && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const fullOtp = otpCode.join('');
    if (fullOtp.length < 6) {
      showToast('Please enter all 6 digits', 'error');
      return;
    }

    setVerifyingOTP(true);
    try {
      await verifyOTP(fullOtp);
      showToast('Successfully logged in!', 'success');
      router.push('/');
    } catch (error) {
      showToast(error.message || 'Invalid verification code. Please check.', 'error');
    } finally {
      setVerifyingOTP(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage={true} text="Initializing login..." />;
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">🍰</div>
      <h1 className="auth-brand">Hive Bantayan</h1>
      <p className="auth-tagline">Sweet Tiramisu & Milkshakes Delivered to You</p>

      <div className="auth-card">
        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <h2>Customer Login</h2>
            <p className="text-secondary text-sm mb-lg text-center">
              Enter your mobile number to sign in or create an account via SMS verification code.
            </p>
            
            <div className="input-group">
              <label className="input-label">Phone Number</label>
              <div className="phone-input-group">
                <span className="phone-prefix">+63</span>
                <input
                  type="tel"
                  className="input"
                  placeholder="912 345 6789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  disabled={sendingOTP}
                  required
                  maxLength="10"
                />
              </div>
            </div>

            <button
              id="recaptcha-container"
              type="submit"
              className="btn btn-primary btn-block mt-lg"
              disabled={sendingOTP || phoneNumber.length < 10}
            >
              {sendingOTP ? 'Sending OTP...' : 'Send Verification Code'}
            </button>
          </form>
        ) : (
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
                  maxLength="1"
                  className="otp-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  disabled={verifyingOTP}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block mt-lg"
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
      </div>
      
      {/* Invisible Div Container for Firebase Recaptcha */}
      <div id="recaptcha-parent"></div>
    </div>
  );
}
