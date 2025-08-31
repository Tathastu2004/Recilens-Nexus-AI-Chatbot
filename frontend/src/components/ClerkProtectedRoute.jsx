import React from 'react';
import { Navigate } from 'react-router-dom';
import { useClerkUser } from '../context/ClerkUserContext';
import { useAuth } from '@clerk/clerk-react';

const ClerkProtectedRoute = ({ children, requiredRole, adminOnly = false, clientOnly = false }) => {
  const { isSignedIn, isLoaded } = useAuth();
  const { dbUser, loading, isAuthenticated } = useClerkUser();

  console.log('🔐 [CLERK PROTECTED] Route check:', {
    isLoaded,
    isSignedIn,
    isAuthenticated,
    loading,
    hasDbUser: !!dbUser,
    userRole: dbUser?.role
  });

  // Show loading while Clerk is initializing
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If not signed in with Clerk, redirect to sign in
  if (!isSignedIn) {
    console.log('❌ [CLERK PROTECTED] Not signed in, redirecting to signin');
    return <Navigate to="/signin" replace />;
  }

  // If signed in but no authentication established yet, show loading
  if (isSignedIn && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Check role-based access if we have user data
  if (dbUser) {
    // Admin-only routes: allow admin and super-admin
    if (adminOnly && !(dbUser.role === 'admin' || dbUser.role === 'super-admin')) {
      console.log('❌ [CLERK PROTECTED] Admin access denied, redirecting to chat');
      return <Navigate to="/chat" replace />;
    }

    // Client-only routes
    if (clientOnly && dbUser.role !== 'client') {
      console.log('❌ [CLERK PROTECTED] Client access denied, redirecting to admin');
      return <Navigate to="/admin" replace />;
    }

    // Specific role requirement
    if (requiredRole && dbUser.role !== requiredRole) {
      console.log('❌ [CLERK PROTECTED] Role mismatch, redirecting based on role');
      // Redirect based on actual role
      if (dbUser.role === 'admin' || dbUser.role === 'super-admin') {
        return <Navigate to="/admin" replace />;
      } else {
        return <Navigate to="/chat" replace />;
      }
    }
  }

  console.log('✅ [CLERK PROTECTED] Access granted');
  return children;
};

export default ClerkProtectedRoute;