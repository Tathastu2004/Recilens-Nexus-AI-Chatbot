import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { ChatProvider } from './context/ChatContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages & Components
import SignUpPage from './pages/SignUpPage';
import ResetPassword from './components/ResetPassword';
import ChatInterface from './pages/chatInterface';
import Profile from './pages/Profile';

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
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
      <UserProvider>
        <ChatProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* Public Routes (No ChatProvider needed) */}
                <Route path="/" element={<Navigate to="/signup" replace />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* ✅ Chat Route with ChatProvider - This is your main chat interface */}
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute clientOnly={true}>
                      <ChatInterface />
                    </ProtectedRoute>
                  }
                />

                {/* ✅ Optional: Dashboard route (if you want a separate dashboard) */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute clientOnly={true}>
                      <ChatInterface />
                    </ProtectedRoute>
                  }
                />

                {/* Profile Page (No ChatProvider needed) */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/signup" replace />} />
              </Routes>
            </div>
          </Router>
        </ChatProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
