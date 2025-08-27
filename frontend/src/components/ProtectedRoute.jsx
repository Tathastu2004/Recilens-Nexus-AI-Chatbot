import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';

const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

const ProtectedRoute = ({ children, requiredRole, adminOnly = false, clientOnly = false }) => {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  // Show loading while checking authentication
  if (!isLoaded || !userLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/signup" replace />;
  }

  // Role-based access control
  if (user) {
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    const userRole = allowedAdminEmails.includes(userEmail) ? 'admin' : 'client';
    
    console.log('🔐 [PROTECTED ROUTE] Checking access:', {
      userEmail,
      userRole,
      requiredRole,
      adminOnly,
      clientOnly
    });

    // Admin-only routes
    if (adminOnly && userRole !== 'admin') {
      console.log('❌ [PROTECTED ROUTE] Access denied - Admin required');
      return <Navigate to="/chat" replace />;
    }

    // Client-only routes
    if (clientOnly && userRole !== 'client') {
      console.log('❌ [PROTECTED ROUTE] Access denied - Client required');
      return <Navigate to="/admin-dashboard" replace />;
    }

    // Specific role requirement
    if (requiredRole && userRole !== requiredRole) {
      console.log('❌ [PROTECTED ROUTE] Access denied - Specific role required');
      if (userRole === 'admin') {
        return <Navigate to="/admin-dashboard" replace />;
      } else {
        return <Navigate to="/chat" replace />;
      }
    }

    console.log('✅ [PROTECTED ROUTE] Access granted');
  }

  return children;
};

export default ProtectedRoute;
