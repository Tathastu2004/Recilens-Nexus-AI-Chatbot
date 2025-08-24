import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // ✅ UTILITY FUNCTION TO CLEAR USER-SPECIFIC SESSION DATA
  const clearUserSessionData = (userId) => {
    if (userId) {
      const userSessionKey = `lastSelectedSession_${userId}`;
      localStorage.removeItem(userSessionKey);
      console.log('🧹 [USER CONTEXT] Cleared session data for user:', userId);
    }
    
    // Also clear old non-user-specific data
    localStorage.removeItem('lastSelectedSession');
  };

  // ✅ UTILITY FUNCTION TO CLEAR ALL SESSION DATA
  const clearAllSessionData = () => {
    // Get current user before clearing
    const currentUser = localStorage.getItem("user");
    if (currentUser) {
      try {
        const parsedUser = JSON.parse(currentUser);
        clearUserSessionData(parsedUser._id);
      } catch (e) {
        console.warn('Failed to parse user data for session cleanup');
      }
    }
    
    // Clear any remaining session data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lastSelectedSession')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('🧹 [USER CONTEXT] Cleared all session data');
  };

  // ✅ ENHANCED LOGIN FUNCTION WITH BETTER TOKEN HANDLING
  const loginUser = async (credentials) => {
    try {
      setLoading(true);
      
      // ✅ CLEAR PREVIOUS USER'S SESSION DATA BEFORE LOGIN
      clearAllSessionData();

      console.log('🔐 [USER CONTEXT] Attempting login for:', credentials.email);

      const response = await axios.post(`${backendUrl}/api/auth/login`, credentials, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 [USER CONTEXT] Login response:', {
        success: response.data.success,
        hasToken: !!response.data.token,
        hasUser: !!response.data.user,
        tokenStart: response.data.token ? response.data.token.substring(0, 20) + '...' : 'No token'
      });
      
      if (response.data.success && response.data.token && response.data.user) {
        const { token, user: userData } = response.data;
        
        // ✅ VALIDATE TOKEN FORMAT
        if (!token || token === 'undefined' || token === 'null') {
          throw new Error('Invalid token received from server');
        }

        if (!userData || !userData._id) {
          throw new Error('Invalid user data received from server');
        }
        
        // ✅ STORE AUTH DATA
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));
        
        setUser(userData);
        setIsAuthenticated(true);
        
        console.log('✅ [USER CONTEXT] User logged in successfully:', {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          id: userData._id,
          tokenStored: !!localStorage.getItem("token")
        });
        
        // ✅ RETURN CONSISTENT STRUCTURE
        return { 
          success: true, 
          user: userData,
          role: userData.role,
          message: 'Login successful'
        };
      } else {
        throw new Error(response.data.message || 'Login failed - invalid response format');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // ✅ CLEAR DATA ON ERROR
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
      
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Login failed' 
      };
    } finally {
      setLoading(false);
    }
  };

  // ✅ ENHANCED LOGOUT FUNCTION WITH SESSION CLEANUP
  const logoutUser = async () => {
    try {
      // ✅ CLEAR CURRENT USER'S SESSION DATA BEFORE LOGOUT
      if (user?._id) {
        clearUserSessionData(user._id);
      } else {
        // Fallback - clear all session data
        clearAllSessionData();
      }

      // Call backend logout if needed
      const token = localStorage.getItem("token");
      if (token) {
        try {
          await axios.post(`${backendUrl}/api/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.warn('Backend logout failed, but continuing with local logout');
        }
      }

      // Clear auth data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('✅ [USER CONTEXT] User logged out successfully');
      
      return { success: true };
    } catch (error) {
      console.error('❌ [USER CONTEXT] Logout error:', error);
      
      // Force clear even on error
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      clearAllSessionData();
      
      setUser(null);
      setIsAuthenticated(false);
      
      return { success: false, error: error.message };
    }
  };

  // ✅ FIXED REGISTER FUNCTION - NO AUTO LOGIN
  const registerUser = async (userData) => {
    try {
      setLoading(true);
      
      // ✅ CLEAR ANY EXISTING SESSION DATA
      clearAllSessionData();

      console.log('📝 [USER CONTEXT] Attempting registration for:', userData.email);

      const response = await axios.post(`${backendUrl}/api/auth/register`, userData);
      
      console.log('📡 [USER CONTEXT] Registration response:', {
        success: response.data.success,
        message: response.data.message
      });
      
      if (response.data.success) {
        console.log('✅ [USER CONTEXT] Registration successful - user needs to verify email');
        
        // ✅ DON'T AUTO-LOGIN AFTER REGISTRATION
        // Just return success - user should verify email first
        return { 
          success: true, 
          message: response.data.message || 'Registration successful. Please check your email for verification.',
          email: userData.email
        };
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Registration error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Registration failed' 
      };
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATE USER FUNCTION
  const updateUser = (updatedUserData) => {
    try {
      localStorage.setItem("user", JSON.stringify(updatedUserData));
      setUser(updatedUserData);
      console.log('✅ [USER CONTEXT] User data updated');
    } catch (error) {
      console.error('❌ [USER CONTEXT] Failed to update user:', error);
    }
  };

  // ✅ ADD MISSING PROFILE UPDATE FUNCTION
  const updateUserProfile = async (updateData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('📝 [USER CONTEXT] Updating user profile:', updateData);

      const response = await axios.put(`${backendUrl}/api/auth/updateprofile`, updateData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        console.log('✅ [USER CONTEXT] Profile updated successfully');
        return { success: true, user: updatedUser };
      } else {
        throw new Error(response.data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Profile update error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to update profile' 
      };
    }
  };

  // ✅ ADD MISSING PHOTO UPLOAD FUNCTION
  const uploadProfilePhoto = async (file) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('📸 [USER CONTEXT] Uploading profile photo');

      const formData = new FormData();
      formData.append('photo', file);

      const response = await axios.put(`${backendUrl}/api/auth/updateprofile`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        console.log('✅ [USER CONTEXT] Photo uploaded successfully');
        return { success: true, user: updatedUser };
      } else {
        throw new Error(response.data.message || 'Failed to upload photo');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Photo upload error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to upload photo' 
      };
    }
  };

  // ✅ ADD MISSING PHOTO DELETE FUNCTION
  const deleteProfilePhoto = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('🗑️ [USER CONTEXT] Deleting profile photo');

      // Send empty photo to delete
      const response = await axios.put(`${backendUrl}/api/auth/updateprofile`, 
        { removePhoto: true }, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        console.log('✅ [USER CONTEXT] Photo deleted successfully');
        return { success: true, user: updatedUser };
      } else {
        throw new Error(response.data.message || 'Failed to delete photo');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Photo delete error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to delete photo' 
      };
    }
  };

  // ✅ ADD MISSING VERIFY OTP FUNCTION
  const verifyOtp = async (email, otp) => {
    try {
      console.log('🔐 [USER CONTEXT] Verifying OTP for:', email);

      const response = await axios.post(`${backendUrl}/api/auth/verify-otp`, {
        email,
        otp
      });

      console.log('📡 [USER CONTEXT] OTP verification response:', response.data);

      if (response.data.success) {
        console.log('✅ [USER CONTEXT] Email verified successfully');
        return { 
          success: true, 
          message: response.data.message || 'Email verified successfully!' 
        };
      } else {
        throw new Error(response.data.message || 'OTP verification failed');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] OTP verification error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'OTP verification failed' 
      };
    }
  };

  // ✅ ADD MISSING RESEND OTP FUNCTION
  const resendOtp = async (email) => {
    try {
      console.log('🔄 [USER CONTEXT] Resending OTP for:', email);

      const response = await axios.post(`${backendUrl}/api/auth/resend-otp`, {
        email
      });

      console.log('📡 [USER CONTEXT] Resend OTP response:', response.data);

      if (response.data.success) {
        console.log('✅ [USER CONTEXT] OTP resent successfully');
        return { 
          success: true, 
          message: response.data.message || 'OTP sent successfully!' 
        };
      } else {
        throw new Error(response.data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Resend OTP error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to resend OTP' 
      };
    }
  };

  // ✅ ADD MISSING SEND PASSWORD RESET OTP FUNCTION
  const sendPasswordResetOtp = async (email) => {
    try {
      console.log('📧 [USER CONTEXT] Sending password reset OTP to:', email);

      const response = await axios.post(`${backendUrl}/api/auth/forgot-password`, {
        email
      });

      console.log('📡 [USER CONTEXT] Password reset OTP response:', response.data);

      if (response.data.success) {
        console.log('✅ [USER CONTEXT] Password reset OTP sent successfully');
        return { 
          success: true, 
          message: response.data.message || 'Password reset OTP sent to your email successfully!' 
        };
      } else {
        throw new Error(response.data.message || 'Failed to send password reset OTP');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Send password reset OTP error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to send password reset OTP' 
      };
    }
  };

  // ✅ ADD MISSING RESET PASSWORD WITH OTP FUNCTION
  const resetPasswordWithOtp = async (email, otp, newPassword) => {
    try {
      console.log('🔐 [USER CONTEXT] Resetting password with OTP for:', email);

      const response = await axios.post(`${backendUrl}/api/auth/reset-password`, {
        email,
        otp,
        newPassword
      });

      console.log('📡 [USER CONTEXT] Reset password response:', response.data);

      if (response.data.success) {
        console.log('✅ [USER CONTEXT] Password reset successfully');
        return { 
          success: true, 
          message: response.data.message || 'Password reset successfully!' 
        };
      } else {
        throw new Error(response.data.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('❌ [USER CONTEXT] Reset password error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to reset password' 
      };
    }
  };

  // ✅ CHECK AUTH STATUS ON MOUNT (FIXED)
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("user");

        console.log('🔍 [USER CONTEXT] Checking auth status:', {
          hasToken: !!token,
          hasUserData: !!userData,
          tokenStart: token ? token.substring(0, 20) + '...' : 'No token'
        });

        if (!token || !userData) {
          console.log('⚠️ [USER CONTEXT] Missing auth data');
          setLoading(false);
          return;
        }

        let parsedUser;
        try {
          parsedUser = JSON.parse(userData);
          if (!parsedUser || !parsedUser._id) {
            throw new Error('Invalid user data structure');
          }
        } catch (parseError) {
          console.error('❌ [USER CONTEXT] Failed to parse user data:', parseError);
          await logoutUser();
          setLoading(false);
          return;
        }

        // ✅ VERIFY TOKEN WITH PROFILE ENDPOINT
        try {
          const response = await axios.get(`${backendUrl}/api/auth/getprofile`, {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.data.success && response.data.user) {
            // Update user data from backend
            const updatedUser = response.data.user;
            setUser(updatedUser);
            setIsAuthenticated(true);
            
            // Update localStorage with fresh user data
            localStorage.setItem("user", JSON.stringify(updatedUser));
            
            console.log('✅ [USER CONTEXT] User authenticated:', updatedUser.name);
          } else {
            console.log('❌ [USER CONTEXT] Invalid response from profile endpoint');
            await logoutUser();
          }
        } catch (error) {
          console.error('❌ [USER CONTEXT] Auth check failed:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          
          // Only logout if it's an auth error (401/403)
          if (error.response && [401, 403].includes(error.response.status)) {
            console.log('🔒 [USER CONTEXT] Authentication failed, logging out');
            await logoutUser();
          } else {
            // For network errors, use cached user data but show warning
            console.log('⚠️ [USER CONTEXT] Using cached user data due to network error');
            setUser(parsedUser);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('❌ [USER CONTEXT] Auth check failed:', error);
        await logoutUser();
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, [backendUrl]);

  // ✅ UPDATE THE CONTEXT VALUE TO INCLUDE NEW FUNCTIONS
  const value = {
    user,
    loading,
    isAuthenticated,
    loginUser,
    logoutUser,
    registerUser,
    verifyOtp,
    resendOtp,
    sendPasswordResetOtp,     // ✅ ADD THIS
    resetPasswordWithOtp,     // ✅ ADD THIS
    updateUser,
    updateUserProfile,
    uploadProfilePhoto,
    deleteProfilePhoto,
    clearUserSessionData,
    clearAllSessionData
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;


