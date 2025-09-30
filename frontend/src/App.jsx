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

// Debugging Component
// import DebugUser from './components/DebugUser';

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
        <div className="min-h-screen flex items-center justify-center"
             style={{ backgroundColor: '#1F1F1F' }}>
          <div className="text-center p-8 rounded-xl shadow-xl border max-w-md w-full mx-4"
               style={{ 
                 backgroundColor: '#2D2D2D',
                 borderColor: 'rgba(255, 255, 255, 0.1)',
                 color: '#ffffff'
               }}>
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 rounded-lg font-medium transition-colors"
              style={{ 
                backgroundColor: '#ffffff',
                color: '#000000'
              }}
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

// ✅ ROOT ROUTE COMPONENT WITH SMART REDIRECT
const RootRedirect = () => {
  const storedUser = localStorage.getItem('user');
  
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      console.log('🔄 [ROOT REDIRECT] User found in storage:', userData.role, userData.email);
      
      if (userData.role === 'admin' || userData.role === 'super-admin') {
        console.log('🔄 [ROOT REDIRECT] Redirecting admin/super-admin to /admin');
        return <Navigate to="/admin" replace />;
      } else {
        console.log('🔄 [ROOT REDIRECT] Redirecting client to /chat');
        return <Navigate to="/chat" replace />;
      }
    } catch (error) {
      console.error('❌ [ROOT REDIRECT] Error parsing stored user:', error);
    }
  }
  
  console.log('🔄 [ROOT REDIRECT] No user data, redirecting to /signin');
  return <Navigate to="/signin" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
        <ClerkUserProvider>
          <UserProvider>
            <ChatProvider>
              <FeedbackProvider>
                
                  <div className="App min-h-screen">
                    {/* <DebugUser /> Add this temporarily */}
                    <Routes>
                      {/* ✅ PRIMARY CLERK AUTHENTICATION ROUTES */}
                      <Route path="/signin" element={<ClerkSignIn />} />
                      <Route path="/signup" element={<ClerkSignUp />} />
                      
                      {/* OAuth callback routes */}
                      <Route path="/signin/*" element={<ClerkSignIn />} />
                      <Route path="/signup/*" element={<ClerkSignUp />} />
                      <Route path="/sso-callback" element={<ClerkSignIn />} />

                      {/* ✅ MAIN APPLICATION ROUTES (CLERK PROTECTED) */}
                      <Route
                        path="/chat"
                        element={
                          <ClerkProtectedRoute clientOnly={true}>
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

                      {/* ✅ ROOT REDIRECT WITH SMART LOGIC */}
                      <Route path="/" element={<RootRedirect />} />
                      
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