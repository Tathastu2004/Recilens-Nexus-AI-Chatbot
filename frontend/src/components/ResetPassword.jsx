import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { IconMail, IconLock, IconEye, IconEyeOff, IconRefresh, IconCheck, IconArrowLeft } from '@tabler/icons-react';
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

  // CHECK IF FUNCTIONS ARE AVAILABLE
  useEffect(() => {
    if (!sendPasswordResetOtp || !resetPasswordWithOtp) {
      console.error('❌ [RESET PASSWORD] Required functions not available from UserContext');
      setError('Password reset functionality is not available. Please try again later.');
    }
  }, [sendPasswordResetOtp, resetPasswordWithOtp]);

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
      console.log('📧 [RESET PASSWORD] Sending OTP to:', email);
      const result = await sendPasswordResetOtp(email);
      
      console.log('📡 [RESET PASSWORD] Send OTP result:', result);
      
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
      console.error('❌ [RESET PASSWORD] Send OTP error:', error);
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
      console.log('Calling resetPasswordWithOtp...');
      const result = await resetPasswordWithOtp(email, otpCode, newPassword);
      console.log('Result received:', result);
      
      if (result.success) {
        console.log('Password reset successful, navigating...');
        setSuccess('Password reset successfully! Redirecting to sign in...');
        
        setTimeout(() => {
          console.log('Navigating to signup...');
          navigate('/signup', { state: { mode: 'signin' } });
        }, 2000);
      } else {
        console.log('Password reset failed:', result.message);
        setError(result.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error in handleResetPassword:', error);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full">
            {step === 1 ? (
              <IconMail className="h-8 w-8 text-blue-600" />
            ) : (
              <IconLock className="h-8 w-8 text-blue-600" />
            )}
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900">
          {step === 1 ? 'Reset Password' : 'Verify & Reset'}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {step === 1 
            ? 'Enter your email to receive a reset code'
            : `Enter the OTP sent to ${email} and your new password`
          }
        </p>
      </div>

      {/* Step 1: Email Input */}
      {step === 1 && (
        <form className="space-y-4" onSubmit={handleSendOtp}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className={`mt-1 block w-full px-3 py-2 border ${
                error ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending OTP...</span>
              </div>
            ) : (
              'Send Reset Code'
            )}
          </button>
        </form>
      )}

      {/* Step 2: OTP + New Password */}
      {step === 2 && (
        <form className="space-y-4" onSubmit={handleResetPassword}>
          {/* OTP Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Enter 6-digit OTP
            </label>
            <div className="flex justify-center space-x-3 mb-4">
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
            
            {/* Resend OTP */}
            <div className="text-center">
              {canResend ? (
                <button
                  type="button"
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
          </div>

          {/* New Password Section */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="mt-1 relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                className={`block w-full px-3 py-2 pr-10 border ${
                  error ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                placeholder="Enter new password"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <IconEyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <IconEye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="mt-1 relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className={`block w-full px-3 py-2 pr-10 border ${
                  error ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                placeholder="Confirm new password"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <IconEyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <IconEye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

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

          <button
            type="submit"
            disabled={loading || otp.some(digit => !digit) || !newPassword || !confirmPassword}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Resetting Password...</span>
              </div>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      )}

      {/* Back Button */}
      <div className="text-center">
        <button
          onClick={handleBack}
          className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <IconArrowLeft className="h-4 w-4" />
          <span>
            {step === 1 ? 'Back to Sign In' : 'Back'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;