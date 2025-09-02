import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { UserProvider } from './context/UserContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminProvider } from './context/AdminContext';
import { FeedbackProvider } from './context/feedbackContext';
import { ModelManagementProvider } from './context/ModelContext';
import { ClerkUserProvider } from './context/ClerkUserContext';

// Authentication Components
import ProtectedRoute from './components/ProtectedRoute';
import ClerkProtectedRoute from './components/ClerkProtectedRoute';
import { ClerkSignIn, ClerkSignUp } from './components/ClerkAuth';

// Pages & Components
import SignUpPage from './pages/SignUpPage';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ChatInterface from './pages/ChatInterface';
import Profile from './pages/Profile';
import FeedBack from './pages/FeedBack';

// Admin imports
import AdminRoutes from './routes/AdminRoutes';

// ✅ Enhanced ErrorBoundary
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
        <Router>
        <ClerkUserProvider>
          <UserProvider>
            <ChatProvider>
              <FeedbackProvider>
                
                  <div className="App min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
                    <Routes>
                      {/* ✅ PRIMARY CLERK AUTHENTICATION ROUTES */}
                      <Route path="/signin" element={<ClerkSignIn />} />
                      <Route path="/signup" element={<ClerkSignUp />} />
                      
                      {/* OAuth callback routes */}
                      <Route path="/signin/*" element={<ClerkSignIn />} />
                      <Route path="/signup/*" element={<ClerkSignIn />} />
                      <Route path="/sso-callback" element={<ClerkSignIn />} />

                      {/* ✅ MAIN APPLICATION ROUTES (CLERK PROTECTED) */}
                      <Route
                        path="/chat"
                        element={
                          <ClerkProtectedRoute>
                            <ChatInterface />
                          </ClerkProtectedRoute>
                        }
                      />

                      <Route
                        path="/dashboard"
                        element={
                          <ClerkProtectedRoute>
                            <ChatInterface />
                          </ClerkProtectedRoute>
                        }
                      />

                      <Route
                        path="/profile"
                        element={
                          <ClerkProtectedRoute>
                            <Profile />
                          </ClerkProtectedRoute>
                        }
                      />

                      <Route
                        path="/feedback"
                        element={
                          <ClerkProtectedRoute>
                            <FeedBack />
                          </ClerkProtectedRoute>
                        }
                      />

                      {/* ✅ ADMIN ROUTES */}
                      <Route
                        path="/admin/*"
                        element={
                          <ClerkProtectedRoute adminOnly={true}>
                            <AdminProvider>
                              <ModelManagementProvider>
                                <AdminRoutes />
                              </ModelManagementProvider>
                            </AdminProvider>
                          </ClerkProtectedRoute>
                        }
                      />

                      {/* ✅ LEGACY AUTHENTICATION ROUTES (FALLBACK) */}
                      <Route path="/legacy-signup" element={<SignUpPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/verify-email" element={<VerifyEmailPage />} />

                      {/* Legacy protected routes */}
                      <Route
                        path="/legacy-chat"
                        element={
                          <ProtectedRoute clientOnly={true}>
                            <ChatInterface />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/legacy-profile"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/legacy-admin/*"
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

                      {/* ✅ ROOT REDIRECT - Go to chat if we have any auth */}
                      <Route 
                        path="/" 
                        element={
                          <Navigate 
                            to="/chat" 
                            replace 
                          />
                        } 
                      />
                      
                      {/* Fallback route */}
                      <Route path="*" element={<Navigate to="/signin" replace />} />
                    </Routes>
                  </div>
                
              </FeedbackProvider>
            </ChatProvider>
          </UserProvider>
        </ClerkUserProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;