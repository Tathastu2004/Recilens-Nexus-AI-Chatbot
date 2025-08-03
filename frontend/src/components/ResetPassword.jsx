import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { 
  IconMail, 
  IconLock, 
  IconEye, 
  IconEyeOff, 
  IconRefresh, 
  IconCheck, 
  IconArrowLeft,
  IconX,
  IconShield,
  IconKey
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

const ResetPassword = ({ onBack }) => {
  const [step, setStep] = useState(1); // 1: Email input, 2: OTP + New password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { sendPasswordResetOtp, resetPasswordWithOtp } = useUser();
  const { isDark } = useTheme();
  const inputRefs = useRef([]);
  const navigate = useNavigate();

  // Timer countdown for OTP resend
  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer(timer => timer - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer, step]);

  // Step 1: Send OTP to email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!sendPasswordResetOtp) {
      setError('Password reset service is not available. Please try again later.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sendPasswordResetOtp(email);
      
      if (result && result.success) {
        setSuccess('OTP sent to your email successfully!');
        setStep(2);
        setTimer(60);
        setCanResend(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result?.message || 'Failed to send OTP');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace in OTP
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste in OTP
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      setError('');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setResendLoading(true);
    setError('');

    try {
      const result = await sendPasswordResetOtp(email);
      
      if (result.success) {
        setSuccess('OTP resent successfully!');
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

  // Combined Step 2: Reset password with OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    const otpCode = otp.join('');
    
    // Validate OTP
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the OTP');
      return;
    }
    
    // Validate new password
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await resetPasswordWithOtp(email, otpCode, newPassword);
      
      if (result.success) {
        setSuccess('Password reset successfully! Redirecting to sign in...');
        
        setTimeout(() => {
          navigate('/signup', { state: { mode: 'signin' } });
        }, 2000);
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
      setSuccess('');
      setOtp(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      navigate('/signup');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* ✅ COMPACT STEP INDICATOR */}
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center space-x-3">
          {/* Step 1 */}
          <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
            step >= 1 
              ? isDark
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
              : isDark
                ? 'bg-gray-700 text-gray-400 border border-gray-600'
                : 'bg-gray-200 text-gray-400 border border-gray-300'
          }`}>
            {step > 1 ? <IconCheck size={16} /> : <IconMail size={16} />}
          </div>
          
          {/* Connector */}
          <div className={`w-8 h-1 rounded-full transition-colors duration-300 ${
            step >= 2 
              ? isDark
                ? 'bg-gradient-to-r from-orange-600 to-red-600'
                : 'bg-gradient-to-r from-orange-500 to-red-500'
              : isDark
                ? 'bg-gray-700'
                : 'bg-gray-200'
          }`} />
          
          {/* Step 2 */}
          <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
            step >= 2 
              ? isDark
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
              : isDark
                ? 'bg-gray-700 text-gray-400 border border-gray-600'
                : 'bg-gray-200 text-gray-400 border border-gray-300'
          }`}>
            <IconKey size={16} />
          </div>
        </div>
      </div>

      {/* ✅ STEP 1: EMAIL INPUT */}
      {step === 1 && (
        <form className="space-y-4" onSubmit={handleSendOtp}>
          <div className="space-y-2">
            <label htmlFor="email" className={`flex items-center text-xs font-semibold transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconMail className="mr-1 h-3 w-3" />
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className={`block w-full px-3 py-2.5 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 text-sm ${
                  error 
                    ? isDark
                      ? 'border-red-500/50 bg-red-900/10 focus:border-red-400 focus:ring-red-500/25 text-red-200'
                      : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/25 text-red-900'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-orange-400 focus:ring-orange-500/25 text-gray-100 placeholder-gray-400'
                      : 'border-gray-300 bg-gray-50/50 focus:border-orange-500 focus:ring-orange-500/25 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your email address"
                disabled={loading}
              />
              {email && /\S+@\S+\.\S+/.test(email) && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <IconCheck className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
          </div>

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

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
              isDark 
                ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-lg' 
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending OTP...
              </>
            ) : (
              <>
                <IconMail className="mr-2 h-4 w-4" />
                Send Reset Code
              </>
            )}
          </button>
        </form>
      )}

      {/* ✅ STEP 2: OTP + NEW PASSWORD */}
      {step === 2 && (
        <form className="space-y-4" onSubmit={handleResetPassword}>
          {/* Compact OTP Section */}
          <div className="space-y-3">
            <label className={`flex items-center justify-center text-xs font-semibold transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconShield className="mr-1 h-3 w-3" />
              Enter 6-digit OTP
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
                          ? 'border-orange-500 bg-orange-900/20 focus:border-orange-400 focus:ring-orange-500/25 text-orange-300'
                          : 'border-orange-500 bg-orange-50 focus:border-orange-600 focus:ring-orange-500/25 text-orange-900'
                        : isDark
                          ? 'border-gray-600/50 bg-gray-700/30 focus:border-orange-400 focus:ring-orange-500/25 text-gray-100'
                          : 'border-gray-300 bg-gray-50/50 focus:border-orange-500 focus:ring-orange-500/25 text-gray-900'
                  }`}
                  disabled={loading}
                />
              ))}
            </div>
            
            {/* Compact Resend OTP */}
            <div className="text-center">
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  className={`inline-flex items-center space-x-1 text-xs font-medium transition-colors duration-300 disabled:opacity-50 ${
                    isDark 
                      ? 'text-orange-400 hover:text-orange-300' 
                      : 'text-orange-600 hover:text-orange-500'
                  }`}
                >
                  {resendLoading ? (
                    <>
                      <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${
                        isDark ? 'border-orange-400' : 'border-orange-600'
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
                <p className={`text-xs transition-colors duration-300 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Resend in {formatTime(timer)}
                </p>
              )}
            </div>
          </div>

          {/* Compact Password Fields */}
          <div className="space-y-3">
            {/* New Password */}
            <div className="space-y-1">
              <label htmlFor="newPassword" className={`flex items-center text-xs font-semibold transition-colors duration-300 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                <IconLock className="mr-1 h-3 w-3" />
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  className={`block w-full px-3 py-2.5 pr-10 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 text-sm ${
                    error 
                      ? isDark
                        ? 'border-red-500/50 bg-red-900/10 focus:border-red-400 focus:ring-red-500/25 text-red-200'
                        : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/25 text-red-900'
                      : isDark
                        ? 'border-gray-600/50 bg-gray-700/30 focus:border-orange-400 focus:ring-orange-500/25 text-gray-100 placeholder-gray-400'
                        : 'border-gray-300 bg-gray-50/50 focus:border-orange-500 focus:ring-orange-500/25 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Enter new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${
                    isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className={`flex items-center text-xs font-semibold transition-colors duration-300 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                <IconShield className="mr-1 h-3 w-3" />
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  className={`block w-full px-3 py-2.5 pr-10 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 text-sm ${
                    error 
                      ? isDark
                        ? 'border-red-500/50 bg-red-900/10 focus:border-red-400 focus:ring-red-500/25 text-red-200'
                        : 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-500/25 text-red-900'
                      : confirmPassword && newPassword === confirmPassword
                        ? isDark
                          ? 'border-green-500/50 bg-green-900/10 focus:border-green-400 focus:ring-green-500/25 text-gray-100'
                          : 'border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-500/25 text-gray-900'
                        : isDark
                          ? 'border-gray-600/50 bg-gray-700/30 focus:border-orange-400 focus:ring-orange-500/25 text-gray-100 placeholder-gray-400'
                          : 'border-gray-300 bg-gray-50/50 focus:border-orange-500 focus:ring-orange-500/25 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Confirm new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${
                    isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword && (
                <div className="flex items-center text-xs">
                  {newPassword === confirmPassword ? (
                    <div className="flex items-center text-green-500">
                      <IconCheck className="w-3 h-3 mr-1" />
                      Match
                    </div>
                  ) : (
                    <div className={`flex items-center ${
                      isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      <IconX className="w-3 h-3 mr-1" />
                      No match
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otp.some(digit => !digit) || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
              isDark 
                ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-lg' 
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Resetting...
              </>
            ) : (
              <>
                <IconKey className="mr-2 h-4 w-4" />
                Reset Password
              </>
            )}
          </button>
        </form>
      )}

      {/* ✅ COMPACT ERROR/SUCCESS */}
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

      {/* ✅ COMPACT BACK BUTTON */}
      <div className="text-center">
        <button
          onClick={handleBack}
          className={`inline-flex items-center space-x-1 text-xs font-medium transition-all duration-300 hover:scale-105 ${
            isDark 
              ? 'text-gray-400 hover:text-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <IconArrowLeft className="h-3 w-3" />
          <span>
            {step === 1 ? 'Back to Sign In' : 'Back to Email'}
          </span>
        </button>
      </div>

      {/* ✅ COMPACT SECURITY FEATURES */}
      <div className={`p-3 rounded-lg text-center ${
        isDark 
          ? 'bg-gray-700/30 border border-gray-600/30' 
          : 'bg-gray-50/80 border border-gray-200/50'
      }`}>
        <div className="flex justify-center space-x-4">
          {[
            { icon: <IconShield size={12} />, text: 'Secure' },
            { icon: <IconKey size={12} />, text: 'Verified' },
            { icon: <IconLock size={12} />, text: 'Encrypted' }
          ].map((feature, index) => (
            <div key={index} className={`flex items-center space-x-1 transition-colors duration-300 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {feature.icon}
              <span className="text-xs font-medium">{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;