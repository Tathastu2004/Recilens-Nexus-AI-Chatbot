import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { IconMail, IconRefresh, IconCheck } from '@tabler/icons-react';

const VerifyMail = ({ email, onVerificationSuccess, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { verifyOtp, resendOtp } = useUser();
  const inputRefs = useRef([]);

  // Timer countdown
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(timer => timer - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      setError('');
      // Auto-submit
      handleVerifyOtp(pastedData);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (otpCode = null) => {
    const otpToVerify = otpCode || otp.join('');
    
    if (otpToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await verifyOtp(email, otpToVerify);
      
      if (result.success) {
        setSuccess('Email verified successfully!');
        setTimeout(() => {
          onVerificationSuccess?.();
        }, 1500);
      } else {
        setError(result.message || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await resendOtp(email);
      
      if (result.success) {
        setSuccess('OTP sent successfully!');
        setTimer(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Failed to resend OTP');
      }
    } catch (error) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <IconMail className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900">
          Verify Your Email
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          We've sent a 6-digit verification code to
        </p>
        <p className="text-sm font-medium text-blue-600">
          {email}
        </p>
      </div>

      {/* OTP Input */}
      <div>
        <div className="flex justify-center space-x-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`w-12 h-12 text-center text-xl font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                error ? 'border-red-300' : 'border-gray-300'
              } ${digit ? 'border-blue-500 bg-blue-50' : ''}`}
              disabled={loading}
            />
          ))}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2">
            <IconCheck className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        </div>
      )}

      {/* Verify Button */}
      <div>
        <button
          onClick={() => handleVerifyOtp()}
          disabled={loading || otp.some(digit => !digit)}
          className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Verifying...</span>
            </div>
          ) : (
            'Verify Email'
          )}
        </button>
      </div>

      {/* Resend Section */}
      <div className="text-center space-y-4">
        <p className="text-sm text-gray-600">
          Didn't receive the code?
        </p>
        
        {canResend ? (
          <button
            onClick={handleResendOtp}
            disabled={resendLoading}
            className="inline-flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50"
          >
            {resendLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <IconRefresh className="h-4 w-4" />
                <span>Resend Code</span>
              </>
            )}
          </button>
        ) : (
          <p className="text-sm text-gray-500">
            Resend available in {formatTime(timer)}
          </p>
        )}
      </div>

      {/* Back Button */}
      {onBack && (
        <div className="text-center">
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to registration
          </button>
        </div>
      )}
    </div>
  );
};

export default VerifyMail;
