import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useClerkUser } from '../context/ClerkUserContext';

export const TokenDebug = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { dbUser, loading, isAuthenticated } = useClerkUser();
  const [currentToken, setCurrentToken] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);

  useEffect(() => {
    const fetchToken = async () => {
      if (isSignedIn && getToken) {
        try {
          const token = await getToken();
          setCurrentToken(token);
          
          // Decode JWT payload (basic decode - don't use in production)
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setTokenInfo(payload);
          }
        } catch (error) {
          console.error('Error getting token:', error);
        }
      }
    };

    fetchToken();
  }, [isSignedIn, getToken]);

  const handleTestBackend = async () => {
    try {
      const token = await getToken();
      console.log('🔑 Using token:', token?.substring(0, 20) + '...');
      
      const response = await fetch('http://localhost:3000/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('📡 Backend response:', data);
      
      if (!response.ok) {
        console.error('❌ Backend error:', response.status, data);
      }
    } catch (error) {
      console.error('❌ Backend test failed:', error);
    }
  };

  const handleClearStorage = () => {
    localStorage.clear();
    window.location.reload();
  };

  if (!isLoaded) return null;

  return (
    <div className="fixed top-4 right-4 z-50 p-4 bg-gray-800 text-white rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">🔐 Auth Debug</h3>
      
      {/* Auth Status */}
      <div className="space-y-1 mb-3">
        <div>Signed In: {isSignedIn ? '✅' : '❌'}</div>
        <div>Clerk User: {clerkUser ? '✅' : '❌'}</div>
        <div>DB User: {dbUser ? '✅' : '❌'}</div>
        <div>Authenticated: {isAuthenticated ? '✅' : '❌'}</div>
        <div>Token: {currentToken ? '✅' : '❌'}</div>
        <div>LocalStorage User: {localStorage.getItem('user') ? '✅' : '❌'}</div>
      </div>

      {/* User Info */}
      {(clerkUser || dbUser) && (
        <div className="border-t pt-2 mb-3 text-xs">
          <div><strong>Name:</strong> {dbUser?.name || `${clerkUser?.firstName} ${clerkUser?.lastName}`}</div>
          <div><strong>Email:</strong> {dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress}</div>
          <div><strong>Role:</strong> {dbUser?.role || 'client'}</div>
        </div>
      )}

      {/* Token Info */}
      {tokenInfo && (
        <div className="border-t pt-2 mb-3 text-xs">
          <div><strong>Token Sub:</strong> {tokenInfo.sub}</div>
          <div><strong>Expires:</strong> {new Date(tokenInfo.exp * 1000).toLocaleTimeString()}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        <button 
          onClick={handleTestBackend}
          className="w-full px-2 py-1 bg-green-600 rounded text-xs hover:bg-green-700"
          disabled={!isSignedIn}
        >
          Test Backend
        </button>
        <button 
          onClick={handleClearStorage}
          className="w-full px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-700"
        >
          Clear & Reload
        </button>
        <button 
          onClick={() => {
            console.log('🔍 Current State:', {
              isSignedIn,
              clerkUser,
              dbUser,
              currentToken: currentToken?.substring(0, 20) + '...',
              localStorage: {
                token: localStorage.getItem('token')?.substring(0, 20) + '...',
                user: JSON.parse(localStorage.getItem('user') || 'null')
              }
            });
          }}
          className="w-full px-2 py-1 bg-purple-600 rounded text-xs hover:bg-purple-700"
        >
          Log State
        </button>
      </div>
    </div>
  );
};