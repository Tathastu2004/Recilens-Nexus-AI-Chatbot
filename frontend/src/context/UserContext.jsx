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
    console.log('🔄 UserProvider mounted, checking auth status...');
    checkAuthStatus();
  }, []);

  // Add useEffect to debug user state changes
  useEffect(() => {
    console.log('👤 User state changed:', {
      user,
      isAuthenticated,
      loading,
      hasToken: !!localStorage.getItem('token')
    });
  }, [user, isAuthenticated, loading]);

  // Update the checkAuthStatus function
  const checkAuthStatus = async () => {
    console.log('🔍 Checking auth status...');
    try {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔑 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'None');
      console.log('👤 User from localStorage:', storedUser ? 'Found' : 'None');
      
      if (!token) {
        console.log('❌ No token found, setting unauthenticated');
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }

      // ✅ If we have stored user data, use it immediately
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('👤 Setting user from localStorage:', parsedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } catch (parseError) {
          console.error('❌ Error parsing stored user data:', parseError);
          localStorage.removeItem('user');
        }
      }

      // If we have a token, assume user is authenticated until proven otherwise
      setIsAuthenticated(true);
      console.log('✅ Token found, setting authenticated to true');
      
      try {
        console.log('📡 Fetching fresh user profile...');
        const response = await axios.get(`${API_BASE_URL}/api/auth/getprofile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          timeout: 10000,
        });

        console.log('📊 Profile response:', {
          status: response.status,
          data: response.data,
          success: response.data?.success
        });

        if (response.data.success || response.status === 200) {
          const userData = response.data.user || response.data;
          console.log('👤 Fresh user data from server:', userData);
          
          // ✅ Update localStorage with fresh data
          const completeUserData = {
            ...userData,
            token
          };
          localStorage.setItem('user', JSON.stringify(completeUserData));
          
          setUser(completeUserData);
          setIsAuthenticated(true);
        } else {
          console.log('❌ Profile fetch unsuccessful:', response.data);
          throw new Error('Profile fetch failed');
        }
      } catch (profileError) {
        console.error('❌ Profile fetch error:', profileError);
        
        // Only clear auth on authentication errors (401, 403)
        if (profileError.response?.status === 401 || 
            profileError.response?.status === 403) {
          console.log('🔐 Authentication error, clearing session');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        } else {
          console.log('🌐 Network/server error, keeping user logged in with stored data');
          // Keep the user data from localStorage if it exists
        }
      }
      
    } catch (error) {
      console.error('💥 Auth check failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      console.log('✅ Auth check complete, setting loading to false');
      setLoading(false);
    }
  };

  // Register User - POST /api/auth/register
  const registerUser = async (userData) => {
    console.log('📝 Registering user:', userData);
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      console.log('📝 Registration response:', response.data);
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Registration error:', error);
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
    console.log('🔐 Verifying OTP for:', email);
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, {
        email,
        otp
      });
      console.log('🔐 OTP verification response:', response.data);
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('❌ OTP verification error:', error);
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
    console.log('🔄 Resending OTP for:', email);
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/resend-otp`, {
        email
      });
      console.log('🔄 Resend OTP response:', response.data);
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Resend OTP error:', error);
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
    console.log('🔑 Logging in user:', credentials);
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, credentials, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('🔑 Login response:', response.data);

      const { token, role, user: userData } = response.data;
      
      if (token) {
        localStorage.setItem('token', token);
        console.log('💾 Token saved to localStorage');
      }

      // ✅ FIX: Store complete user data in localStorage
      const completeUserData = {
        ...userData,
        token,
        role
      };
      
      console.log('👤 Complete user data to store:', completeUserData);
      
      // ✅ Store user data in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(completeUserData));
      console.log('💾 User data saved to localStorage');
      
      setUser(completeUserData);
      setIsAuthenticated(true);
      
      return {
        success: true,
        message: response.data.message || 'Login successful',
        role: role,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Login error:', error);
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
    console.log('🚪 Logging out user...');
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        console.log('✅ Logout API call successful');
      }
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return {
        success: false,
        message: 'Logout failed but local session cleared'
      };
    } finally {
      console.log('🧹 Clearing local session data');
      localStorage.removeItem('token');
      localStorage.removeItem('user'); // ✅ Clear user data
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Get User Profile - GET /api/auth/getprofile
  const getUserProfile = async () => {
    console.log('👤 Getting user profile...');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/auth/getprofile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('👤 Get profile response:', response.data);

      if (response.data.success) {
        const userData = response.data.user;
        console.log('👤 Setting user data from profile:', userData);
        setUser(userData);
        setIsAuthenticated(true);
        return {
          success: true,
          user: userData
        };
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      
      if (error.response?.status === 401) {
        console.log('🔐 Unauthorized, clearing session');
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
    console.log('✏️ Updating user profile:', profileData);
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // For simple updates (name, email), use JSON
      if (!photoFile) {
        const response = await axios.put(`${API_BASE_URL}/api/auth/updateprofile`, profileData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('✏️ Update profile response:', response.data);

        if (response.data.success && response.data.user) {
          console.log('👤 Updating user data in context:', response.data.user);
          setUser(response.data.user);
        }
        
        return {
          success: response.data.success,
          message: response.data.message,
          user: response.data.user
        };
      } else {
        // For file uploads, use FormData
        const formData = new FormData();
        Object.keys(profileData).forEach(key => {
          formData.append(key, profileData[key]);
        });
        if (photoFile) {
          formData.append('photo', photoFile);
        }

        const response = await axios.put(`${API_BASE_URL}/api/auth/updateprofile`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('✏️ Update profile with photo response:', response.data);

        if (response.data.success && response.data.user) {
          console.log('👤 Updating user data in context:', response.data.user);
          setUser(response.data.user);
        }
        
        return {
          success: response.data.success,
          message: response.data.message,
          user: response.data.user
        };
      }
    } catch (error) {
      console.error('❌ Update profile error:', error);
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
    console.log('🔄 Sending password reset OTP for:', email);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, {
        email
      });
      console.log('🔄 Password reset OTP response:', response.data);
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Password reset OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send reset OTP'
      };
    }
  };

  // Reset Password with OTP - POST /api/auth/reset-password
  const resetPasswordWithOtp = async (email, otp, newPassword) => {
    console.log('🔐 Resetting password for:', email);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email,
        otp,
        newPassword
      });
      console.log('🔐 Password reset response:', response.data);

      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Password reset error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Password reset failed'
      };
    }
  };

  // Upload Profile Photo - POST /api/user/profile/photo
  const uploadProfilePhoto = async (photoFile) => {
    console.log('📸 Uploading profile photo:', photoFile);
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!photoFile) {
        return {
          success: false,
          message: 'No photo file provided'
        };
      }

      const formData = new FormData();
      formData.append('photo', photoFile);

      const response = await axios.post(`${API_BASE_URL}/api/user/profile/photo`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('📸 Upload photo response:', response.data);

      // Update user profile picture in context
      if (response.data.success && (response.data.imageUrl || response.data.user)) {
        setUser(prevUser => {
          const updatedUser = {
            ...prevUser,
            profilePicture: response.data.imageUrl || response.data.user.profilePicture
          };
          console.log('👤 Updated user with new photo:', updatedUser);
          return updatedUser;
        });
        
        // Force re-authentication to get fresh user data
        setTimeout(() => {
          getUserProfile();
        }, 500);
      }

      return {
        success: true,
        message: response.data.message || 'Profile photo uploaded successfully',
        imageUrl: response.data.imageUrl,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Upload profile photo error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload profile photo'
      };
    } finally {
      setLoading(false);
    }
  };

  // Get Profile Photo - GET /api/user/profile/photo
  const getProfilePhoto = async () => {
    console.log('📸 Getting profile photo...');
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_BASE_URL}/api/user/profile/photo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📸 Get photo response:', response.data);

      return {
        success: true,
        message: 'Profile photo retrieved successfully',
        imageUrl: response.data.imageUrl,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Get profile photo error:', error);
      
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'No profile photo found',
          imageUrl: null
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get profile photo'
      };
    }
  };

  // Delete Profile Photo - DELETE /api/user/profile/photo
  const deleteProfilePhoto = async () => {
    console.log('🗑️ Deleting profile photo...');
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.delete(`${API_BASE_URL}/api/user/profile/photo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('🗑️ Delete photo response:', response.data);

      // Update user profile picture in context
      setUser(prevUser => {
        const updatedUser = {
          ...prevUser,
          profilePicture: null
        };
        console.log('👤 Updated user after photo deletion:', updatedUser);
        return updatedUser;
      });

      return {
        success: true,
        message: response.data.message || 'Profile photo deleted successfully',
        data: response.data
      };
    } catch (error) {
      console.error('❌ Delete profile photo error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete profile photo'
      };
    } finally {
      setLoading(false);
    }
  };

  // Helper functions with debug
  const isEmailVerified = () => {
    const verified = user?.isVerified || false;
    console.log('🔍 isEmailVerified:', verified, 'user.isVerified:', user?.isVerified);
    return verified;
  };

  const isAdmin = () => {
    const admin = user?.role === 'admin';
    console.log('🔍 isAdmin:', admin, 'user.role:', user?.role);
    return admin;
  };

  const isClient = () => {
    const client = user?.role === 'client';
    console.log('🔍 isClient:', client, 'user.role:', user?.role);
    return client;
  };

  const getUserName = () => {
    const name = user?.name || '';
    console.log('🔍 getUserName:', name, 'user.name:', user?.name);
    return name;
  };

  const getUserEmail = () => {
    const email = user?.email || '';
    console.log('🔍 getUserEmail:', email, 'user.email:', user?.email);
    return email;
  };

  const getUserRole = () => {
    const role = user?.role || '';
    console.log('🔍 getUserRole:', role, 'user.role:', user?.role);
    return role;
  };

  const getUserProfilePicture = () => {
    const picture = user?.profilePicture || '';
    console.log('🔍 getUserProfilePicture:', picture, 'user.profilePicture:', user?.profilePicture);
    return picture;
  };

  // Debug the complete user object
  useEffect(() => {
    if (user) {
      console.log('🐛 Complete user object:', {
        user,
        keys: Object.keys(user),
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      });
    }
  }, [user]);

  const value = {
    user,
    setUser,
    isAuthenticated,
    setIsAuthenticated,
    loading,
    registerUser,
    loginUser,
    logoutUser,
    verifyOtp,
    resendOtp,
    sendPasswordResetOtp,
    resetPasswordWithOtp,
    getUserProfile,
    updateUserProfile,
    
    // Profile photo functions
    uploadProfilePhoto,
    getProfilePhoto,
    deleteProfilePhoto,
    
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


