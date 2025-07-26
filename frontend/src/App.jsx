import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { ChatProvider } from './context/ChatContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages & Components
import SignUpPage from './pages/SignUpPage';
import ResetPassword from './components/ResetPassword';
import ChatInterface from './pages/ChatInterface';
import Profile from './pages/Profile';
import Footer from './components/footer.jsx';

function App() {
  return (
    <>
      <Router>
        <UserProvider>
          <ChatProvider>
            <div className="App">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Navigate to="/signup" replace />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Client-Protected Chat Interface */}
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute clientOnly={true}>
                      <ChatInterface />
                    </ProtectedRoute>
                  }
                />

                {/* Profile Page (for both admin and client) */}
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
          </ChatProvider>
        </UserProvider>
      </Router>

      {/* Footer shown outside Router */}
      {/* <div>
        <Footer />
      </div> */}
    </>
  );
}

export default App;
