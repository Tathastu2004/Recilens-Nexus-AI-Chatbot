// Create this component temporarily for debugging
// filepath: /Users/apurv79/F/NexusChatBot copy/Recilens-Nexus-AI-Chatbot/frontend/src/components/DebugUser.jsx
import React from 'react';
import { useClerkUser } from '../context/ClerkUserContext';
import { useAuth } from '@clerk/clerk-react';

const DebugUser = () => {
  const { clerkUser, dbUser, loading, isAuthenticated } = useClerkUser();
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="fixed top-4 right-4 p-4 bg-black/80 text-white text-xs rounded max-w-sm z-50">
      <div><strong>Debug Info:</strong></div>
      <div>Clerk Loaded: {isLoaded ? '✅' : '❌'}</div>
      <div>Signed In: {isSignedIn ? '✅' : '❌'}</div>
      <div>Authenticated: {isAuthenticated ? '✅' : '❌'}</div>
      <div>Loading: {loading ? '⏳' : '✅'}</div>
      <div>Clerk Email: {clerkUser?.primaryEmailAddress?.emailAddress || 'None'}</div>
      <div>DB User Role: {dbUser?.role || 'None'}</div>
      <div>DB User Email: {dbUser?.email || 'None'}</div>
      <div>Current Path: {window.location.pathname}</div>
      <div>LocalStorage User: {localStorage.getItem('user') ? '✅' : '❌'}</div>
    </div>
  );
};

export default DebugUser;