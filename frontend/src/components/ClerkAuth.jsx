// filepath: frontend/src/components/auth/ClerkAuth.jsx
import React from 'react';
import { SignIn, SignUp, UserButton, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { IconRobot, IconSun, IconMoon } from '@tabler/icons-react';

export const ClerkSignIn = () => {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ 
           backgroundColor: isDark ? '#0a0a0a' : '#fafafa'
         }}>
      
      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-xl transition-all duration-200 hover:scale-105 z-10"
        style={{ 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          color: isDark ? '#ffffff' : '#000000'
        }}
      >
        {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
      </button>

      {/* Basic Clerk SignIn */}
      <SignIn 
        appearance={{
          baseTheme: isDark ? 'dark' : 'light',
          variables: {
            colorPrimary: '#000000',
            colorBackground: isDark ? '#1a1a1a' : '#ffffff',
            colorText: isDark ? '#ffffff' : '#000000',
            colorTextSecondary: isDark ? '#a3a3a3' : '#6b7280',
            colorInputBackground: isDark ? '#2d2d2d' : '#f9fafb',
            colorInputText: isDark ? '#ffffff' : '#000000',
            borderRadius: '0.75rem'
          },
          elements: {
            card: {
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
              border: isDark ? '1px solid #2d2d2d' : '1px solid #e5e7eb'
            },
            headerTitle: {
              color: isDark ? '#ffffff' : '#000000'
            },
            headerSubtitle: {
              color: isDark ? '#a3a3a3' : '#6b7280'
            },
            formFieldLabel: {
              color: isDark ? '#ffffff' : '#374151'
            },
            formFieldInput: {
              backgroundColor: isDark ? '#2d2d2d' : '#f9fafb',
              border: isDark ? '1px solid #404040' : '1px solid #d1d5db',
              color: isDark ? '#ffffff' : '#000000',
              '&:focus': {
                borderColor: '#000000'
              }
            },
            dividerLine: {
              backgroundColor: isDark ? '#404040' : '#e5e7eb'
            },
            dividerText: {
              color: isDark ? '#a3a3a3' : '#6b7280',
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff'
            },
            socialButtonsBlockButton: {
              backgroundColor: 'transparent',
              border: isDark ? '1px solid #404040' : '1px solid #e5e7eb',
              color: isDark ? '#ffffff' : '#374151',
              '&:hover': {
                backgroundColor: isDark ? '#2d2d2d' : '#f9fafb'
              }
            },
            formButtonPrimary: {
              backgroundColor: '#000000',
              '&:hover': {
                backgroundColor: '#1a1a1a'
              }
            },
            footerActionLink: {
              color: '#000000'
            }
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
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ 
           backgroundColor: isDark ? '#0a0a0a' : '#fafafa'
         }}>
      
      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-xl transition-all duration-200 hover:scale-105 z-10"
        style={{ 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          color: isDark ? '#ffffff' : '#000000'
        }}
      >
        {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
      </button>

      {/* Basic Clerk SignUp */}
      <SignUp 
        appearance={{
          baseTheme: isDark ? 'dark' : 'light',
          variables: {
            colorPrimary: '#000000',
            colorBackground: isDark ? '#1a1a1a' : '#ffffff',
            colorText: isDark ? '#ffffff' : '#000000',
            colorTextSecondary: isDark ? '#a3a3a3' : '#6b7280',
            colorInputBackground: isDark ? '#2d2d2d' : '#f9fafb',
            colorInputText: isDark ? '#ffffff' : '#000000',
            borderRadius: '0.75rem'
          },
          elements: {
            card: {
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
              border: isDark ? '1px solid #2d2d2d' : '1px solid #e5e7eb'
            },
            headerTitle: {
              color: isDark ? '#ffffff' : '#000000'
            },
            headerSubtitle: {
              color: isDark ? '#a3a3a3' : '#6b7280'
            },
            formFieldLabel: {
              color: isDark ? '#ffffff' : '#374151'
            },
            formFieldInput: {
              backgroundColor: isDark ? '#2d2d2d' : '#f9fafb',
              border: isDark ? '1px solid #404040' : '1px solid #d1d5db',
              color: isDark ? '#ffffff' : '#000000',
              '&:focus': {
                borderColor: '#000000'
              }
            },
            dividerLine: {
              backgroundColor: isDark ? '#404040' : '#e5e7eb'
            },
            dividerText: {
              color: isDark ? '#a3a3a3' : '#6b7280',
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff'
            },
            socialButtonsBlockButton: {
              backgroundColor: 'transparent',
              border: isDark ? '1px solid #404040' : '1px solid #e5e7eb',
              color: isDark ? '#ffffff' : '#374151',
              '&:hover': {
                backgroundColor: isDark ? '#2d2d2d' : '#f9fafb'
              }
            },
            formButtonPrimary: {
              backgroundColor: '#000000',
              '&:hover': {
                backgroundColor: '#1a1a1a'
              }
            },
            footerActionLink: {
              color: '#000000'
            }
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
        variables: {
          colorPrimary: '#000000',
          colorBackground: isDark ? '#1a1a1a' : '#ffffff',
          colorText: isDark ? '#ffffff' : '#000000'
        },
        elements: {
          userButtonPopoverCard: {
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            border: isDark ? '1px solid #2d2d2d' : '1px solid #e5e7eb'
          },
          userButtonPopoverActionButton: {
            color: isDark ? '#ffffff' : '#374151',
            '&:hover': {
              backgroundColor: isDark ? '#2d2d2d' : '#f9fafb'
            }
          }
        }
      }}
      afterSignOutUrl="/signin"
      showName={false}
    />
  );
};

export const ClerkProtectedRoute = ({ children }) => {
  const { isSignedIn, isLoaded } = useAuth();
  const { isDark } = useTheme();
  
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen"
           style={{ 
             backgroundColor: isDark ? '#0a0a0a' : '#fafafa'
           }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
               style={{ 
                 backgroundColor: '#000000'
               }}>
            <IconRobot size={32} className="text-white" />
          </div>
          <div className="w-8 h-8 rounded-full mx-auto border-2 animate-spin mb-4"
               style={{ 
                 borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                 borderTopColor: '#000000'
               }}></div>
          <p className="text-lg font-medium"
             style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }
  
  if (!isSignedIn) {
    return <Navigate to="/signin" replace />;
  }
  
  return children;
};