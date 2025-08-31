// filepath: frontend/src/components/auth/ClerkAuth.jsx
import React from 'react';
import { SignIn, SignUp, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export const ClerkSignIn = () => {
  const { isDark } = useTheme();
  
  return (
    <div className={`flex justify-center items-center min-h-screen ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <SignIn 
        appearance={{
          baseTheme: isDark ? 'dark' : 'light',
          elements: {
            formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500',
            card: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
            socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            socialButtonsBlockButtonText: 'font-medium'
          }
        }}
        afterSignInUrl="/chat"
        afterSignUpUrl="/chat"
        signUpUrl="/signup"
      />
    </div>
  );
};

export const ClerkSignUp = () => {
  const { isDark } = useTheme();
  
  return (
    <div className={`flex justify-center items-center min-h-screen ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <SignUp 
        appearance={{
          baseTheme: isDark ? 'dark' : 'light',
          elements: {
            formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500',
            card: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
            socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            socialButtonsBlockButtonText: 'font-medium'
          }
        }}
        afterSignInUrl="/chat"
        afterSignUpUrl="/chat"
        signInUrl="/signin"
      />
    </div>
  );
};

export const ClerkUserButton = () => {
  const { isDark } = useTheme();
  
  return (
    <UserButton 
      appearance={{
        baseTheme: isDark ? 'dark' : 'light',
        elements: {
          avatarBox: 'w-10 h-10',
          userButtonPopoverCard: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }
      }}
      afterSignOutUrl="/signin"
      showName={true}
    />
  );
};

export const ClerkProtectedRoute = ({ children }) => {
  const { isSignedIn, isLoaded } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!isSignedIn) {
    return <Navigate to="/signin" replace />;
  }
  
  return children;
};