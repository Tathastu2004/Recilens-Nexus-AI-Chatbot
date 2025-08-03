import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { 
  IconMail, 
  IconRefresh, 
  IconCheck, 
  IconArrowLeft,
  IconX,
  IconShield,
  IconClock,
  IconMailOpened,
  IconSparkles
} from '@tabler/icons-react';

const VerifyMail = ({ email, onVerificationSuccess, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { verifyOtp, resendOtp } = useUser();
  const { isDark } = useTheme();
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

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      setError('');
      handleVerifyOtp(pastedData);
    }
  };

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
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

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
    <div className="w-full space-y-4">
      {/* ✅ COMPACT HEADER */}
      <div className="text-center mb-4">
        <div className="relative inline-block mb-3">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-br from-emerald-600 via-cyan-600 to-blue-600 shadow-xl' 
              : 'bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 shadow-lg'
          }`}>
            <IconMailOpened size={28} className="text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
            <IconCheck size={10} className="text-white" />
          </div>
        </div>
        
        <p className={`text-xs transition-colors duration-300 ${
          isDark ? 'text-gray-300' : 'text-gray-600'
        }`}>
          Code sent to
        </p>
        <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium ${
          isDark 
            ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-300' 
            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          <IconMail className="h-3 w-3" />
          <span>{email}</span>
        </div>
      </div>

      {/* ✅ COMPACT OTP INPUT */}
      <div className="space-y-3">
        <label className={`flex items-center justify-center text-xs font-semibold ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}>
          <IconShield className="mr-1 h-3 w-3" />
          Enter 6-digit code
        </label>
        
        <div className="flex justify-center space-x-2">
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
              className={`w-10 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                error 
                  ? isDark
                    ? 'border-red-500/50 bg-red-900/10 focus:border-red-400 focus:ring-red-500/25 text-red-200'
                    : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/25 text-red-900'
                  : digit 
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-900/20 focus:border-emerald-400 focus:ring-emerald-500/25 text-emerald-300'
                      : 'border-emerald-500 bg-emerald-50 focus:border-emerald-600 focus:ring-emerald-500/25 text-emerald-900'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-emerald-400 focus:ring-emerald-500/25 text-gray-100'
                      : 'border-gray-300 bg-gray-50/50 focus:border-emerald-500 focus:ring-emerald-500/25 text-gray-900'
              }`}
              disabled={loading}
            />
          ))}
        </div>
      </div>

      {/* ✅ COMPACT MESSAGES */}
      {error && (
        <div className={`p-3 rounded-lg border text-xs ${
          isDark 
            ? 'bg-red-900/20 border-red-500/30 text-red-400' 
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <div className="flex items-center justify-center">
            <IconX className="mr-1 h-3 w-3" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className={`p-3 rounded-lg border text-xs ${
          isDark 
            ? 'bg-green-900/20 border-green-500/30 text-green-400' 
            : 'bg-green-50 border-green-200 text-green-600'
        }`}>
          <div className="flex items-center justify-center">
            <IconCheck className="mr-1 h-3 w-3" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* ✅ COMPACT VERIFY BUTTON */}
      <button
        onClick={() => handleVerifyOtp()}
        disabled={loading || otp.some(digit => !digit)}
        className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
          isDark 
            ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg' 
            : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-md'
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Verifying...
          </>
        ) : (
          <>
            <IconCheck className="mr-2 h-4 w-4" />
            Verify Email
          </>
        )}
      </button>

      {/* ✅ COMPACT RESEND */}
      <div className="text-center">
        <p className={`text-xs mb-2 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Didn't receive code?
        </p>
        
        {canResend ? (
          <button
            onClick={handleResendOtp}
            disabled={resendLoading}
            className={`inline-flex items-center space-x-1 text-xs font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 ${
              isDark 
                ? 'text-emerald-400 hover:text-emerald-300' 
                : 'text-emerald-600 hover:text-emerald-500'
            }`}
          >
            {resendLoading ? (
              <>
                <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${
                  isDark ? 'border-emerald-400' : 'border-emerald-600'
                }`}></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <IconRefresh className="h-3 w-3" />
                <span>Resend</span>
              </>
            )}
          </button>
        ) : (
          <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs ${
            isDark 
              ? 'bg-gray-700/50 border border-gray-600/30 text-gray-400' 
              : 'bg-gray-100/80 border border-gray-200/50 text-gray-500'
          }`}>
            <IconClock className="h-3 w-3" />
            <span>Resend in {formatTime(timer)}</span>
          </div>
        )}
      </div>

      {/* ✅ COMPACT BACK BUTTON */}
      {onBack && (
        <div className="text-center">
          <button
            onClick={onBack}
            className={`inline-flex items-center space-x-1 text-xs font-medium transition-all duration-300 hover:scale-105 ${
              isDark 
                ? 'text-gray-400 hover:text-gray-200' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <IconArrowLeft className="h-3 w-3" />
            <span>Back</span>
          </button>
        </div>
      )}

      {/* ✅ COMPACT TIPS */}
      <div className={`p-3 rounded-lg text-center ${
        isDark 
          ? 'bg-gray-700/30 border border-gray-600/30' 
          : 'bg-gray-50/80 border border-gray-200/50'
      }`}>
        <h4 className={`text-xs font-semibold mb-1 ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}>
          💡 Tips
        </h4>
        <p className={`text-xs ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Check spam • Paste full code • 10min expiry
        </p>
      </div>
    </div>
  );
};

export default VerifyMail;
