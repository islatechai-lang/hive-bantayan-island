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

  // Handle paste of full OTP code
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
      showToast('Successfully logged in! Welcome! 🎉', 'success');
      router.push('/');
    } else {
      showToast(result.message, 'error');
      setVerifyingOTP(false);
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
    console.log('Verifying OTP code:', fullOtp);
    
    const result = await verifyOTP(fullOtp);
    
    if (result.success) {
      showToast('Successfully logged in! Welcome! 🎉', 'success');
      router.push('/');
    } else {
      showToast(result.message, 'error');
    }
    
    setVerifyingOTP(false);
  };

  if (loading) {
    return <LoadingSpinner fullPage={true} text="Initializing..." />;
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
                  autoComplete="tel"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block mt-lg"
              disabled={sendingOTP || phoneNumber.length < 10}
            >
              {sendingOTP ? 'Sending Code...' : 'Send Verification Code'}
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
      
      {/* Invisible reCAPTCHA container — must exist in DOM, separate from submit button */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
