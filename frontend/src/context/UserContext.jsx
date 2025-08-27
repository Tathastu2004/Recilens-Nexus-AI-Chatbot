import React, { createContext, useContext } from 'react';
import { useAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import axios from 'axios';

const UserContext = createContext();

const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

export const UserProvider = ({ children }) => {
  const { isSignedIn, userId, sessionId, getToken, signOut } = useAuth();
  const { user: clerkUser, isLoaded } = useClerkUser();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // ✅ CLEAR SESSION DATA
  const clearUserSessionData = (userId) => {
    if (userId) {
      const userSessionKey = `lastSelectedSession_${userId}`;
      localStorage.removeItem(userSessionKey);
    }
    localStorage.removeItem('lastSelectedSession');
  };

  const clearAllSessionData = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lastSelectedSession')) {
        localStorage.removeItem(key);
      }
    });
  };

  // ✅ LOGOUT FUNCTION
  const logoutUser = async () => {
    try {
      clearAllSessionData();
      await signOut();
      console.log('✅ [USER CONTEXT] User logged out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [USER CONTEXT] Logout error:', error);
      clearAllSessionData();
      return { success: false, error: error.message };
    }
  };

  // ✅ GET USER ROLE (ADMIN/CLIENT)
  const getUserRole = () => {
    if (clerkUser && clerkUser.emailAddresses?.[0]?.emailAddress) {
      return allowedAdminEmails.includes(clerkUser.emailAddresses[0].emailAddress)
        ? 'admin'
        : 'client';
    }
    return 'client';
  };

  // ✅ IS ADMIN CHECK
  const isAdmin = () => getUserRole() === 'admin';

  // ✅ UPDATE PROFILE FUNCTION
  const updateUserProfile = async (updateData) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.put(`${backendUrl}/api/auth/updateprofile`, updateData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (response.data.success) {
        console.log('✅ [USER CONTEXT] Profile updated successfully');
        return { success: true, user: response.data.user };
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

  // ✅ UPLOAD PHOTO FUNCTION
  const uploadProfilePhoto = async (file) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const formData = new FormData();
      formData.append('photo', file);

      const response = await axios.put(`${backendUrl}/api/auth/updateprofile`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      if (response.data.success) {
        console.log('✅ [USER CONTEXT] Photo uploaded successfully');
        return { success: true, user: response.data.user };
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

  // ✅ DELETE PHOTO FUNCTION
  const deleteProfilePhoto = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

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
        console.log('✅ [USER CONTEXT] Photo deleted successfully');
        return { success: true, user: response.data.user };
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

  const value = {
    // ✅ CLERK AUTH STATE
    isAuthenticated: isSignedIn,
    loading: !isLoaded,
    user: clerkUser,

    // ✅ ROLE HELPERS
    getUserRole,
    isAdmin,
    
    // ✅ CUSTOM FUNCTIONS
    logoutUser,
    updateUserProfile,
    uploadProfilePhoto,
    deleteProfilePhoto,
    clearUserSessionData,
    clearAllSessionData,
    
    // ✅ CLERK UTILITIES
    getToken,
    userId,
    sessionId
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


