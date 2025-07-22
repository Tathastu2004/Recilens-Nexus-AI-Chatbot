import React from 'react'
import { BrowserRouter , Routes ,  Route} from 'react-router-dom'
import SideBar from './components/SideBar.jsx'
import ChatInterface from './pages/chatInterface.jsx'
import ChatDashBoard from './components/ChatDashBoard.jsx'
import Footer from './components/footer.jsx'
import Profile from './pages/Profile.jsx'

function App() {
  

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* <Route path="/" element={<div>Home Page</div>} /> */}
          <Route path="/sidebar" element={<SideBar />} />
          <Route path="/chat-dashboard" element={<ChatDashBoard />} />
          {/* Main chat interface */}
          <Route path="/chat" element={<ChatInterface />} />
          {/* Add more routes as needed */}
          <Route path="/profile" element={<Profile />} />
          {/* Add more routes as needed */}

        </Routes>
      </BrowserRouter>
      <div>
        <Footer />
      </div>
    </>
  )
}

export default App
