import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser as useClerkUserHook, useAuth } from '@clerk/clerk-react';
import axios from 'axios';

const ClerkUserContext = createContext();

export const ClerkUserProvider = ({ children }) => {
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUserHook();
  const { getToken, isSignedIn } = useAuth();
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncAttempted, setSyncAttempted] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // Sync user data with backend and update localStorage for compatibility
  const syncUserWithBackend = async () => {
    console.log('🔄 [CLERK] Syncing user with backend...', { 
      hasClerkUser: !!clerkUser, 
      isSignedIn, 
      clerkLoaded,
      syncAttempted
    });

    if (!clerkUser || !isSignedIn) {
      console.log('🚫 [CLERK] No user or not signed in, clearing data');
      setDbUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      setSyncAttempted(true);
      
      // Clear localStorage for compatibility with existing components
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      return;
    }

    try {
      const token = await getToken();
      console.log('🔑 [CLERK] Got token:', token ? `${token.substring(0, 20)}...` : 'null');
      
      if (!token) {
        throw new Error('No token received from Clerk');
      }

      // Store token in localStorage for compatibility with existing components
      localStorage.setItem('token', token);
      localStorage.setItem('authToken', token);

      // ✅ TRY CLERK ROUTE FIRST
      let response;
      try {
        console.log('📡 [CLERK] Trying Clerk auth route...');
        response = await axios.get(`${backendUrl}/api/clerk/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
      } catch (clerkError) {
        console.log('⚠️ [CLERK] Clerk route failed, trying legacy auth route...', clerkError.response?.status);
        
        // ✅ FALLBACK TO LEGACY AUTH ROUTE
        response = await axios.get(`${backendUrl}/api/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
      }

      console.log('📡 [CLERK] Backend response:', response.data);

      if (response.data.success) {
        const userData = response.data.user;
        setDbUser(userData);
        setIsAuthenticated(true);
        
        // Store user data in localStorage for compatibility with existing components
        const compatibleUserData = {
          _id: userData._id,
          id: userData._id,
          clerkId: userData.clerkId,
          email: userData.email,
          name: userData.name,
          role: userData.role || 'client',
          profilePicture: userData.profilePicture,
          isActive: userData.isActive,
          createdAt: userData.createdAt
        };
        
        localStorage.setItem('user', JSON.stringify(compatibleUserData));
        console.log('💾 [CLERK] User data stored in localStorage:', compatibleUserData);
      } else {
        throw new Error('Backend response indicates failure');
      }
    } catch (error) {
      console.error('❌ [CLERK] Failed to sync user with backend:', error.response?.status, error.message);
      
      // ✅ CREATE MINIMAL USER DATA FROM CLERK FOR OFFLINE FUNCTIONALITY
      if (clerkUser) {
        const minimalUserData = {
          _id: clerkUser.id,
          id: clerkUser.id,
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
          role: 'client',
          profilePicture: clerkUser.imageUrl,
          isActive: true,
          isOffline: true // Flag to indicate this is fallback data
        };
        
        localStorage.setItem('user', JSON.stringify(minimalUserData));
        setDbUser(minimalUserData);
        setIsAuthenticated(true);
        console.log('⚠️ [CLERK] Using minimal user data from Clerk (backend unavailable):', minimalUserData);
      }
    } finally {
      setLoading(false);
      setSyncAttempted(true);
    }
  };

  // ✅ EFFECT FOR AUTHENTICATION STATE MANAGEMENT
  useEffect(() => {
    if (clerkLoaded) {
      if (isSignedIn && clerkUser && !syncAttempted) {
        syncUserWithBackend();
      } else if (!isSignedIn) {
        // User signed out
        console.log('🚪 [CLERK] User signed out, clearing localStorage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        setDbUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        setSyncAttempted(false);
      }
    }
  }, [clerkUser, isSignedIn, clerkLoaded, syncAttempted]);

  // ✅ RESTORE FROM LOCALSTORAGE ON INITIAL LOAD
  useEffect(() => {
    if (clerkLoaded && isSignedIn && clerkUser) {
      // Check if we have stored user data
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      
      if (storedUser && storedToken && !dbUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('🔄 [CLERK] Restoring user from localStorage:', userData);
          setDbUser(userData);
          setIsAuthenticated(true);
          setLoading(false);
        } catch (error) {
          console.error('❌ [CLERK] Failed to parse stored user data:', error);
        }
      }
    }
  }, [clerkLoaded, isSignedIn, clerkUser, dbUser]);

  // ✅ ADD UPDATE DB USER FUNCTION
  const updateDbUser = (userData) => {
    console.log('🔄 [CLERK CONTEXT] Updating user data:', userData);
    setDbUser(userData);
    
    if (userData) {
      const compatibleUserData = {
        _id: userData._id,
        id: userData._id,
        clerkId: userData.clerkId,
        email: userData.email,
        name: userData.name,
        role: userData.role || 'client',
        profilePicture: userData.profilePicture,
        isActive: userData.isActive,
        createdAt: userData.createdAt
      };
      localStorage.setItem('user', JSON.stringify(compatibleUserData));
      console.log('💾 [CLERK CONTEXT] Updated localStorage with new user data');
    }
  };

  const value = {
    clerkUser,
    dbUser,
    loading: loading || !clerkLoaded,
    isAuthenticated,
    updateDbUser, // ✅ Add this
    syncUserWithBackend,
    getAuthToken: getToken
  };

  return (
    <ClerkUserContext.Provider value={value}>
      {children}
    </ClerkUserContext.Provider>
  );
};

export const useClerkUser = () => {
  const context = useContext(ClerkUserContext);
  if (!context) {
    throw new Error('useClerkUser must be used within a ClerkUserProvider');
  }
  return context;
};