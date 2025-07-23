import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconEye, IconEyeOff, IconUser, IconLogin } from '@tabler/icons-react';
import VerifyMail from './verfiyMail';
import { useUser } from '../context/UserContext';

const SignUp = () => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showVerification, setShowVerification] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');

  const { registerUser, loginUser } = useUser();
  const navigate = useNavigate();

  // SignUp form data
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client'
  });

  // SignIn form data
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

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
      
      if (result.success) {
        setRegistrationEmail(signUpData.email);
        setShowVerification(true);
      } else {
        alert(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred during registration');
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
        console.log('Login successful, user role:', result.data?.role || result.role);
        
        // Redirect based on user role
        const userRole = result.data?.role || result.role;
        
        if (userRole === 'admin') {
          console.log('Redirecting to admin dashboard...');
          navigate('/admin-dashboard');
        } else if (userRole === 'client') {
          console.log('Redirecting to chat...');
          navigate('/chat');
        } else {
          console.log('Unknown role, redirecting to chat...');
          navigate('/chat'); // Default to chat for unknown roles
        }
        
        // Optional: Show success message briefly
        // alert('Login successful!');
      } else {
        setErrors({ general: result.message || 'Login failed' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: 'An error occurred during login' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setErrors({});
    setShowPassword(false);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
  };

  const handleVerificationSuccess = () => {
    setShowVerification(false);
    setIsSignUp(false); // Switch to sign in
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isSignUp ? 'Join Nexus AI today' : 'Welcome back to Nexus AI'}
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => !isSignUp && toggleMode()}
            className={`flex-1 rounded-md py-2 px-4 text-sm font-medium transition-colors ${
              isSignUp
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <IconUser className="inline mr-2 h-4 w-4" />
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => isSignUp && toggleMode()}
            className={`flex-1 rounded-md py-2 px-4 text-sm font-medium transition-colors ${
              !isSignUp
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <IconLogin className="inline mr-2 h-4 w-4" />
            Sign In
          </button>
        </div>

        {/* Sign Up Form */}
        {isSignUp ? (
          <form className="mt-8 space-y-6" onSubmit={handleSignUpSubmit}>
            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={signUpData.name}
                  onChange={handleSignUpChange}
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={signUpData.email}
                  onChange={handleSignUpChange}
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={signUpData.password}
                    onChange={handleSignUpChange}
                    className={`block w-full px-3 py-2 pr-10 border ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    placeholder="Enter your password"
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
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              {/* Role Field */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={signUpData.role}
                  onChange={handleSignUpChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        ) : (
          /* Sign In Form */
          <form className="mt-8 space-y-6" onSubmit={handleSignInSubmit}>
            <div className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="signin-email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  value={signInData.email}
                  onChange={handleSignInChange}
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="signin-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={signInData.password}
                    onChange={handleSignInChange}
                    className={`block w-full px-3 py-2 pr-10 border ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    placeholder="Enter your password"
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
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>
            </div>

            {/* General Error Message */}
            {errors.general && (
              <div className="text-center">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {/* Forgot Password Link */}
            <div className="flex items-center justify-end">
              <Link
                to="/reset-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignUp;