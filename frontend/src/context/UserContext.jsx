import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export const UserContext = createContext();

// Custom hook to use the UserContext
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // Check if user is logged in on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Update the checkAuthStatus function
  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }

      // If we have a token, assume user is authenticated until proven otherwise
      setIsAuthenticated(true);
      
      try {
        const response = await axios.get(`${API_BASE_URL}/api/auth/getprofile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          timeout: 10000, // 10 second timeout
        });

        if (response.data.success || response.status === 200) {
          setUser(response.data.user || response.data);
          setIsAuthenticated(true);
        } else {
          throw new Error('Profile fetch failed');
        }
      } catch (profileError) {
        console.error('Profile fetch error:', profileError);
        
        // Only clear auth on authentication errors (401, 403)
        if (profileError.response?.status === 401 || 
            profileError.response?.status === 403) {
          console.log('Authentication error, clearing session');
          localStorage.removeItem('token');
          setUser(null);
          setIsAuthenticated(false);
        } else {
          // For network errors, timeout, etc., keep the user logged in
          console.log('Network/server error, keeping user logged in');
          // Keep isAuthenticated as true, just don't update user data
        }
      }
      
    } catch (error) {
      console.error('Auth check failed:', error);
      // Only clear on critical errors
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Register User - POST /api/auth/register
  const registerUser = async (userData) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
      };
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP - POST /api/auth/verify-otp
  const verifyOtp = async (email, otp) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, {
        email,
        otp
      });
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'OTP verification failed'
      };
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP - POST /api/auth/resend-otp
  const resendOtp = async (email) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/resend-otp`, {
        email
      });
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('Resend OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resend OTP'
      };
    } finally {
      setLoading(false);
    }
  };

  // Login User - POST /api/auth/login
  const loginUser = async (credentials) => {
  try {
    setLoading(true);
    console.log('Sending login request with:', credentials);
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, credentials, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const { token, role, user } = response.data;
    localStorage.setItem('token', token);
    setUser({ token, role, ...user });
    setIsAuthenticated(true);
    
    return {
      success: true,
      message: response.data.message || 'Login successful',
      role: role, // Make sure role is available in the response
      data: response.data
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Login failed'
    };
  } finally {
    setLoading(false);
  }
};

  // Logout User - POST /api/auth/logout
  const logoutUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Logout failed but local session cleared'
      };
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
      // Remove automatic navigation - let components handle it
      // navigate('/signup');
    }
  };

  // Get User Profile - GET /api/auth/getprofile
  const getUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/auth/getprofile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        return {
          success: true,
          user: response.data.user
        };
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      
      // Only clear auth state if it's a 401 (unauthorized) error
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch profile'
      };
    }
  };

  // Update User Profile - PUT /api/auth/updateprofile
  const updateUserProfile = async (profileData, photoFile = null) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Create FormData for multipart/form-data
      const formData = new FormData();
      
      // Add profile data
      Object.keys(profileData).forEach(key => {
        formData.append(key, profileData[key]);
      });
      
      // Add photo if provided
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await axios.put(`${API_BASE_URL}/api/auth/updateprofile`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setUser(response.data.user);
      }
      
      return {
        success: response.data.success,
        message: response.data.message,
        user: response.data.user
      };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update profile'
      };
    } finally {
      setLoading(false);
    }
  };

  // Send Password Reset OTP - POST /api/auth/forgot-password
  const sendPasswordResetOtp = async (email) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, {
        email
      });
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('Password reset OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send reset OTP'
      };
    }
  };

  // Reset Password with OTP - POST /api/auth/reset-password
  const resetPasswordWithOtp = async (email, otp, newPassword) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email,
        otp,
        newPassword
      });
      

      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Password reset failed'
      };
    }
  };

  // Helper functions
  const isEmailVerified = () => {
    return user?.isVerified || false;
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const isClient = () => {
    return user?.role === 'client';
  };

  const getUserName = () => {
    return user?.name || '';
  };

  const getUserEmail = () => {
    return user?.email || '';
  };

  const getUserRole = () => {
    return user?.role || '';
  };

  const getUserProfilePicture = () => {
    return user?.profilePicture || '';
  };

  // Make sure your context value includes loading
  const value = {
    user,
    setUser,
    isAuthenticated,
    setIsAuthenticated,
    loading,  // Make sure this is included
    registerUser,
    loginUser,
    logoutUser,
    verifyOtp,
    resendOtp,
    sendPasswordResetOtp,
    resetPasswordWithOtp,
    getUserProfile,
    updateUserProfile,
    
    // Helper functions
    isEmailVerified,
    isAdmin,
    isClient,
    getUserName,
    getUserEmail,
    getUserRole,
    getUserProfilePicture,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;


