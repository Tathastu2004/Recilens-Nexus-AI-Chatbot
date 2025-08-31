import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminProvider } from './context/AdminContext';
import { FeedbackProvider } from './context/feedbackContext'; // <-- Import FeedbackProvider
import { ModelManagementProvider } from './context/ModelContext';

import ProtectedRoute from './components/ProtectedRoute';

// Pages & Components
import SignUpPage from './pages/SignUpPage';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ChatInterface from './pages/chatInterface';
import Profile from './pages/Profile';
import FeedBack from './pages/FeedBack';


//admin imports
import AdminRoutes from './routes/AdminRoutes';


// ✅ Keep your existing ErrorBoundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 [ERROR BOUNDARY] Error caught:', error);
    console.error('🚨 [ERROR BOUNDARY] Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <ChatProvider>
            <FeedbackProvider> {/* <-- Wrap your app with FeedbackProvider */}
              <Router>
                <div className="App min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Navigate to="/signup" replace />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />

                    {/* ✅ Chat Route */}
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute clientOnly={true}>
                          <ChatInterface />
                        </ProtectedRoute>
                      }
                    />

                    {/* ✅ Dashboard route */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute clientOnly={true}>
                          <ChatInterface />
                        </ProtectedRoute>
                      }
                    />

                    {/* Profile & Feedback */}
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/feedback"
                      element={
                        <ProtectedRoute>
                          <FeedBack />
                        </ProtectedRoute>
                      }
                    />

                    {/* ✅ FIXED: Specific admin routes instead of catch-all */}
                    <Route
                      path="/admin/*"
                      element={
                        <ProtectedRoute adminOnly={true}>
                          <AdminProvider>
                            <ModelManagementProvider>
                              <AdminRoutes />
                            </ModelManagementProvider>
                          </AdminProvider>
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Fallback route - MUST be last */}
                    <Route path="*" element={<Navigate to="/signup" replace />} />
                  </Routes>
                </div>
              </Router>
            </FeedbackProvider>
          </ChatProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
