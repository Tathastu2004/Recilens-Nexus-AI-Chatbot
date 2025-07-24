import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import your components
import SignUpPage from './pages/SignUpPage';
import ResetPassword from './components/ResetPassword';
import ChatInterface from './pages/ChatInterface';
import SideBar from './components/SideBar';
// import ChatDashBoard from './pages/ChatDashBoard';
// import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Footer from './components/footer.jsx'

function App() {
  return (
    <>
    <Router>
      <UserProvider>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/signup" replace />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Client-only routes */}
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute clientOnly={true}>
                  <ChatInterface />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/sidebar" 
              element={
                <ProtectedRoute clientOnly={true}>
                  <SideBar />
                </ProtectedRoute>
              } 
            />
            
            {/* <Route 
              path="/chat-dashboard" 
              element={
                <ProtectedRoute clientOnly={true}>
                  <ChatDashBoard />
                </ProtectedRoute>
              } 
            /> */}

            {/* Admin-only routes */}
            {/* <Route 
              path="/admin-dashboard" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            /> */}

            {/* Routes accessible by both roles */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />

            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/signup" replace />} />
          </Routes>
        </div>
      </UserProvider>
    </Router>
    <div>
        <Footer />
      </div>
    </>
  );
}

export default App;
