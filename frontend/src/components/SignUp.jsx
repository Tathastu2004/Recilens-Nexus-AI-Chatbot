import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  IconEye, 
  IconEyeOff, 
  IconUser, 
  IconLogin, 
  IconMail, 
  IconLock,
  IconSparkles,
  IconCheck,
  IconX,
  IconShield
} from '@tabler/icons-react';
import VerifyMail from './verfiyMail';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const SignUp = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showVerification, setShowVerification] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');

  const { registerUser, loginUser, loading: userLoading, isAuthenticated } = useUser();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // SignUp form data
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client'
  });

  // SignIn form data
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  // Clear errors when switching modes
  useEffect(() => {
    setErrors({});
  }, [isSignUp]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !userLoading) {
      console.log('👤 [SignUp] User already authenticated, redirecting...');
      navigate('/chat');
    }
  }, [isAuthenticated, userLoading, navigate]);

  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSignInChange = (e) => {
    const { name, value } = e.target;
    setSignInData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateSignUp = () => {
    const newErrors = {};
    
    if (!signUpData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!signUpData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(signUpData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!signUpData.password) {
      newErrors.password = 'Password is required';
    } else if (signUpData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!signUpData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (signUpData.password !== signUpData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignIn = () => {
    const newErrors = {};
    
    if (!signInData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(signInData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!signInData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateSignUp()) return;
    
    setLoading(true);
    try {
      const result = await registerUser(signUpData);
      
      if (result && result.success) {
        setRegistrationEmail(signUpData.email);
        setShowVerification(true);
      } else {
        const errorMessage = result?.message || 'Registration failed';
        setErrors({ general: errorMessage });
      }
    } catch (error) {
      setErrors({ general: 'An error occurred during registration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateSignIn()) return;
    
    setLoading(true);
    try {
      const result = await loginUser(signInData);
      
      if (result.success) {
        const userData = result.user || result.data?.user || result.data;
        const userRole = userData?.role || result.role;
        
        if (userRole === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/chat');
        }
      } else {
        setErrors({ general: result.message || 'Login failed' });
      }
    } catch (error) {
      setErrors({ general: 'An error occurred during login' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
  };

  const handleVerificationSuccess = () => {
    setShowVerification(false);
    setIsSignUp(false);
    alert('Email verified successfully! You can now sign in.');
  };

  const handleBackToRegistration = () => {
    setShowVerification(false);
    setRegistrationEmail('');
  };

  // Show verification component if needed
  if (showVerification) {
    return (
      <VerifyMail
        email={registrationEmail}
        onVerificationSuccess={handleVerificationSuccess}
        onBack={handleBackToRegistration}
      />
    );
  }

  return (
    <div className="w-full">
      {/* ✅ MODE TOGGLE BUTTONS */}
      <div className={`flex rounded-xl p-1 mb-6 transition-all duration-300 ${
        isDark 
          ? 'bg-gray-700/30 border border-gray-600/30' 
          : 'bg-gray-100/50 border border-gray-200/30'
      }`}>
        <button
          type="button"
          onClick={() => !isSignUp && toggleMode()}
          className={`flex-1 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-300 transform ${
            isSignUp
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
              : isDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600/20'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/30'
          }`}
        >
          <IconUser className="inline mr-2 h-5 w-5" />
          Create Account
        </button>
        <button
          type="button"
          onClick={() => isSignUp && toggleMode()}
          className={`flex-1 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-300 transform ${
            !isSignUp
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
              : isDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600/20'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/30'
          }`}
        >
          <IconLogin className="inline mr-2 h-5 w-5" />
          Sign In
        </button>
      </div>

      {/* ✅ SIGN UP FORM */}
      {isSignUp ? (
        <form className="space-y-5" onSubmit={handleSignUpSubmit}>
          {/* Name Field */}
          <div className="space-y-2">
            <label htmlFor="name" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconUser className="mr-2 h-4 w-4" />
              Full Name
            </label>
            <div className="relative">
              <input
                id="name"
                name="name"
                type="text"
                value={signUpData.name}
                onChange={handleSignUpChange}
                className={`block w-full px-4 py-3 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                  errors.name 
                    ? 'border-red-500/50 bg-red-50/10 focus:border-red-400 focus:ring-red-500/20 text-red-200'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100 placeholder-gray-400'
                      : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your full name"
              />
              {signUpData.name && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <IconCheck className="h-5 w-5 text-green-500" />
                </div>
              )}
            </div>
            {errors.name && (
              <p className="text-sm flex items-center text-red-400">
                <IconX className="mr-1 h-4 w-4" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconMail className="mr-2 h-4 w-4" />
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                value={signUpData.email}
                onChange={handleSignUpChange}
                className={`block w-full px-4 py-3 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                  errors.email 
                    ? 'border-red-500/50 bg-red-50/10 focus:border-red-400 focus:ring-red-500/20 text-red-200'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100 placeholder-gray-400'
                      : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your email"
              />
              {signUpData.email && /\S+@\S+\.\S+/.test(signUpData.email) && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <IconCheck className="h-5 w-5 text-green-500" />
                </div>
              )}
            </div>
            {errors.email && (
              <p className="text-sm flex items-center text-red-400">
                <IconX className="mr-1 h-4 w-4" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconLock className="mr-2 h-4 w-4" />
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={signUpData.password}
                onChange={handleSignUpChange}
                className={`block w-full px-4 py-3 pr-12 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                  errors.password 
                    ? 'border-red-500/50 bg-red-50/10 focus:border-red-400 focus:ring-red-500/20 text-red-200'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100 placeholder-gray-400'
                      : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                }`}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm flex items-center text-red-400">
                <IconX className="mr-1 h-4 w-4" />
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconShield className="mr-2 h-4 w-4" />
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={signUpData.confirmPassword}
                onChange={handleSignUpChange}
                className={`block w-full px-4 py-3 pr-12 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                  errors.confirmPassword 
                    ? 'border-red-500/50 bg-red-50/10 focus:border-red-400 focus:ring-red-500/20 text-red-200'
                    : signUpData.confirmPassword && signUpData.password === signUpData.confirmPassword
                      ? 'border-green-500/50 bg-green-50/10 focus:border-green-400 focus:ring-green-500/20 text-gray-100'
                      : isDark
                        ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100 placeholder-gray-400'
                        : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                }`}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm flex items-center text-red-400">
                <IconX className="mr-1 h-4 w-4" />
                {errors.confirmPassword}
              </p>
            )}
            {signUpData.confirmPassword && (
              <div className="flex items-center text-sm">
                {signUpData.password === signUpData.confirmPassword ? (
                  <div className="flex items-center text-green-500">
                    <IconCheck className="w-4 h-4 mr-1" />
                    Passwords match
                  </div>
                ) : (
                  <div className="flex items-center text-red-400">
                    <IconX className="w-4 h-4 mr-1" />
                    Passwords do not match
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Role Field */}
          <div className="space-y-2">
            <label htmlFor="role" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconShield className="mr-2 h-4 w-4" />
              Account Type
            </label>
            <select
              id="role"
              name="role"
              value={signUpData.role}
              onChange={handleSignUpChange}
              className={`block w-full px-4 py-3 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                isDark
                  ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100'
                  : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900'
              }`}
            >
              <option value="client">Client - Regular User</option>
              <option value="admin">Admin - Administrator</option>
            </select>
          </div>

          {/* General Error */}
          {errors.general && (
            <div className={`p-4 rounded-lg border ${
              isDark 
                ? 'bg-red-900/20 border-red-500/30 text-red-400' 
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <div className="flex items-center">
                <IconX className="mr-2 h-5 w-5" />
                <p className="text-sm font-medium">{errors.general}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (signUpData.password && signUpData.confirmPassword && signUpData.password !== signUpData.confirmPassword)}
            className="w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Creating Account...
              </>
            ) : (
              <>
                <IconUser className="mr-2 h-5 w-5" />
                Create Account
              </>
            )}
          </button>
        </form>
      ) : (
        /* ✅ SIGN IN FORM */
        <form className="space-y-5" onSubmit={handleSignInSubmit}>
          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="signin-email" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconMail className="mr-2 h-4 w-4" />
              Email Address
            </label>
            <div className="relative">
              <input
                id="signin-email"
                name="email"
                type="email"
                value={signInData.email}
                onChange={handleSignInChange}
                className={`block w-full px-4 py-3 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                  errors.email 
                    ? 'border-red-500/50 bg-red-50/10 focus:border-red-400 focus:ring-red-500/20 text-red-200'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100 placeholder-gray-400'
                      : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your email"
              />
              {signInData.email && /\S+@\S+\.\S+/.test(signInData.email) && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <IconCheck className="h-5 w-5 text-green-500" />
                </div>
              )}
            </div>
            {errors.email && (
              <p className="text-sm flex items-center text-red-400">
                <IconX className="mr-1 h-4 w-4" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="signin-password" className={`flex items-center text-sm font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <IconLock className="mr-2 h-4 w-4" />
              Password
            </label>
            <div className="relative">
              <input
                id="signin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={signInData.password}
                onChange={handleSignInChange}
                className={`block w-full px-4 py-3 pr-12 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 ${
                  errors.password 
                    ? 'border-red-500/50 bg-red-50/10 focus:border-red-400 focus:ring-red-500/20 text-red-200'
                    : isDark
                      ? 'border-gray-600/50 bg-gray-700/30 focus:border-blue-400 focus:ring-blue-500/20 text-gray-100 placeholder-gray-400'
                      : 'border-gray-300/50 bg-gray-50/30 focus:border-blue-500 focus:ring-blue-500/20 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                }`}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm flex items-center text-red-400">
                <IconX className="mr-1 h-4 w-4" />
                {errors.password}
              </p>
            )}
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className={`p-4 rounded-lg border ${
              isDark 
                ? 'bg-red-900/20 border-red-500/30 text-red-400' 
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <div className="flex items-center">
                <IconX className="mr-2 h-5 w-5" />
                <p className="text-sm font-medium">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Forgot Password Link */}
          <div className="flex items-center justify-end">
            <Link
              to="/reset-password"
              className={`text-sm font-medium transition-colors duration-300 ${
                isDark 
                  ? 'text-blue-400 hover:text-blue-300' 
                  : 'text-blue-600 hover:text-blue-500'
              }`}
            >
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Signing In...
              </>
            ) : (
              <>
                <IconLogin className="mr-2 h-5 w-5" />
                Sign In
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default SignUp;