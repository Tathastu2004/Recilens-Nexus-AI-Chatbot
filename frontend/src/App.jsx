import React from 'react'
import { BrowserRouter , Routes ,  Route , Navigate} from 'react-router-dom'
import SideBar from './components/SideBar.jsx'
import ChatInterface from './pages/chatInterface.jsx'
import ChatDashBoard from './components/ChatDashBoard.jsx'
import Footer from './components/footer.jsx'
import Profile from './pages/Profile.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import { UserProvider } from './context/UserContext.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
function App() {
  

  return (
    <>

      <BrowserRouter>
      <UserProvider>
        {/* Main Application */}
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
          
          <Route 
            path="/chat-dashboard" 
            element={
              <ProtectedRoute clientOnly={true}>
                <ChatDashBoard />
              </ProtectedRoute>
            } 
          />

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
      </UserProvider>
        {/* Footer */}
      </BrowserRouter>
      <div>
        <Footer />
      </div>
    </>
  )
}

export default App
