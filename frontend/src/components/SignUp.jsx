import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, SignUp as ClerkSignUp, useAuth, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import { IconSparkles, IconBrandGoogle, IconBrandGithub } from '@tabler/icons-react';

const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Redirect based on user role
  useEffect(() => {
    if (isSignedIn && user) {
      console.log('👤 [AUTH] User authenticated, redirecting...');
      const userEmail = user.emailAddresses?.[0]?.emailAddress;
      const userRole = allowedAdminEmails.includes(userEmail) ? 'admin' : 'client';
      if (userRole === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/chat');
      }
    }
  }, [isSignedIn, user, navigate]);

  const toggleMode = () => {
    setIsSignUp((prev) => !prev);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Mode Toggle */}
      <div className={`flex rounded-xl p-1 mb-6 transition-all duration-300 ${
        isDark 
          ? 'bg-gray-700/30 border border-gray-600/30' 
          : 'bg-gray-100/50 border border-gray-200/30'
      }`}>
        <button
          type="button"
          onClick={() => setIsSignUp(true)}
          className={`flex-1 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-300 transform ${
            isSignUp
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
              : isDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600/20'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/30'
          }`}
        >
          <IconSparkles className="inline mr-2 h-5 w-5" />
          Create Account
        </button>
        <button
          type="button"
          onClick={() => setIsSignUp(false)}
          className={`flex-1 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-300 transform ${
            !isSignUp
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
              : isDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600/20'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/30'
          }`}
        >
          Sign In
        </button>
      </div>

      {/* Social Login Highlights */}
      <div className={`text-center mb-6 p-4 rounded-lg ${
        isDark 
          ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20' 
          : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
      }`}>
        <div className="flex justify-center items-center space-x-4 mb-2">
          <IconBrandGoogle className="h-6 w-6 text-red-500" />
          <IconBrandGithub className={`h-6 w-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Quick sign-in with Google or GitHub
        </p>
      </div>

      {/* Clerk Components */}
      <div className="clerk-auth-container">
        {isSignUp ? (
          <ClerkSignUp 
            appearance={{
              baseTheme: isDark ? 'dark' : 'light',
              variables: {
                colorPrimary: '#4F46E5',
                colorBackground: isDark ? '#1F2937' : '#FFFFFF',
                colorText: isDark ? '#F9FAFB' : '#111827',
                borderRadius: '0.5rem'
              },
              elements: {
                formButtonPrimary: {
                  background: 'linear-gradient(to right, #4F46E5, #9333EA)',
                  '&:hover': {
                    background: 'linear-gradient(to right, #4338CA, #7C3AED)'
                  }
                },
                card: {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '0.75rem'
                }
              }
            }}
            redirectUrl="/chat"
            afterSignUpUrl="/chat"
          />
        ) : (
          <SignIn 
            appearance={{
              baseTheme: isDark ? 'dark' : 'light',
              variables: {
                colorPrimary: '#4F46E5',
                colorBackground: isDark ? '#1F2937' : '#FFFFFF',
                colorText: isDark ? '#F9FAFB' : '#111827',
                borderRadius: '0.5rem'
              },
              elements: {
                formButtonPrimary: {
                  background: 'linear-gradient(to right, #4F46E5, #9333EA)',
                  '&:hover': {
                    background: 'linear-gradient(to right, #4338CA, #7C3AED)'
                  }
                },
                card: {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '0.75rem'
                }
              }
            }}
            redirectUrl="/chat"
            afterSignInUrl="/chat"
          />
        )}
      </div>

      {/* Toggle Link */}
      <div className="text-center mt-4">
        <button
          onClick={toggleMode}
          className={`text-sm font-medium transition-colors duration-300 ${
            isDark 
              ? 'text-blue-400 hover:text-blue-300' 
              : 'text-blue-600 hover:text-blue-500'
          }`}
        >
          {isSignUp 
            ? "Already have an account? Sign in" 
            : "Don't have an account? Create one"
          }
        </button>
      </div>
    </div>
  );
};

export default AuthPage;