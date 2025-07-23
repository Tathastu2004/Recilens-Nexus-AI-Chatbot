import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const ProtectedRoute = ({ children, requiredRole, adminOnly = false, clientOnly = false }) => {
  const { isAuthenticated, user, loading } = useUser();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if we have a token in localStorage as backup
  const token = localStorage.getItem('token');
  
  // If not authenticated and no token, redirect to signup
  if (!isAuthenticated && !token) {
    return <Navigate to="/signup" replace />;
  }

  // If we have a token but not authenticated yet (still loading user data), show loading
  if (!isAuthenticated && token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Check role-based access only if we have user data
  if (user) {
    // Admin-only routes
    if (adminOnly && user.role !== 'admin') {
      return <Navigate to="/chat" replace />;
    }

    // Client-only routes
    if (clientOnly && user.role !== 'client') {
      return <Navigate to="/admin-dashboard" replace />;
    }

    // Specific role requirement
    if (requiredRole && user.role !== requiredRole) {
      // Redirect based on actual role
      if (user.role === 'admin') {
        return <Navigate to="/admin-dashboard" replace />;
      } else {
        return <Navigate to="/chat" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;