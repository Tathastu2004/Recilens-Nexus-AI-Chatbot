import React, { useState, useEffect } from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';

const ChatInterface = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // ✅ PERSIST SELECTED SESSION ON REFRESH WITH USER-SPECIFIC STORAGE
  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    
    if (!token || !user) {
      setAuthError('Please log in to access the chat interface.');
      setIsLoading(false);
      return;
    }

    let parsedUser;
    try {
      parsedUser = JSON.parse(user);
      if (!parsedUser._id) {
        setAuthError('Invalid user data. Please log in again.');
        setIsLoading(false);
        return;
      }
    } catch (error) {
      setAuthError('Invalid user data. Please log in again.');
      setIsLoading(false);
      return;
    }

    // ✅ USER-SPECIFIC SESSION STORAGE KEY
    const userSessionKey = `lastSelectedSession_${parsedUser._id}`;
    const lastSession = localStorage.getItem(userSessionKey);
    
    console.log('🔄 [CHAT INTERFACE] Restoring session for user:', {
      userId: parsedUser._id,
      lastSession
    });

    // ✅ CLEAR OLD NON-USER-SPECIFIC SESSION DATA
    const oldSessionKey = 'lastSelectedSession';
    if (localStorage.getItem(oldSessionKey)) {
      console.log('🧹 [CHAT INTERFACE] Clearing old non-user-specific session data');
      localStorage.removeItem(oldSessionKey);
    }
    
    if (lastSession && 
        lastSession !== 'null' && 
        lastSession !== 'undefined' && 
        lastSession.trim() !== '') {
      
      // ✅ VALIDATE SESSION ID FORMAT
      if (lastSession.match(/^[0-9a-fA-F]{24}$/)) {
        // ✅ VERIFY SESSION BELONGS TO CURRENT USER
        verifyAndRestoreSession(lastSession, parsedUser._id, userSessionKey);
      } else {
        console.log('⚠️ [CHAT INTERFACE] Invalid session format, clearing:', lastSession);
        localStorage.removeItem(userSessionKey);
      }
    }
    
    setIsLoading(false);
  }, []);

  // ✅ VERIFY SESSION BELONGS TO CURRENT USER
  const verifyAndRestoreSession = async (sessionId, userId, storageKey) => {
    try {
      const token = localStorage.getItem("token");
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      
      const res = await fetch(`${backendUrl}/api/chat/session/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const sessionData = await res.json();
        // ✅ VERIFY SESSION BELONGS TO CURRENT USER
        if (sessionData.user === userId) {
          console.log('✅ [CHAT INTERFACE] Session verified and restored:', sessionId);
          setSelectedSession(sessionId);
        } else {
          console.log('⚠️ [CHAT INTERFACE] Session belongs to different user, clearing:', {
            sessionUser: sessionData.user,
            currentUser: userId
          });
          localStorage.removeItem(storageKey);
        }
      } else {
        console.log('⚠️ [CHAT INTERFACE] Session not found or invalid, clearing:', sessionId);
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('❌ [CHAT INTERFACE] Failed to verify session:', error);
      localStorage.removeItem(storageKey);
    }
  };

  // ✅ USER-SPECIFIC SESSION SELECTION
  const handleSessionSelect = (sessionId) => {
    console.log('🎯 [CHAT INTERFACE] Session selected:', sessionId);
    
    const user = JSON.parse(localStorage.getItem("user"));
    const userSessionKey = `lastSelectedSession_${user._id}`;
    
    // ✅ VALIDATE SESSION ID
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      console.log('⚠️ [CHAT INTERFACE] Invalid session ID, clearing selection');
      setSelectedSession(null);
      localStorage.removeItem(userSessionKey);
      return;
    }
    
    // ✅ IMMEDIATE UPDATE WITH USER-SPECIFIC STORAGE
    setSelectedSession(sessionId);
    localStorage.setItem(userSessionKey, sessionId);
  };

  const handleSidebarToggle = (isOpen) => {
    setSidebarOpen(isOpen);
  };

  const handleSessionUpdate = (updatedSession) => {
    console.log('📝 [CHAT INTERFACE] Session updated:', updatedSession);
  };

  const handleSessionDelete = (deletedSessionId) => {
    console.log('🗑️ [CHAT INTERFACE] Session deleted:', deletedSessionId);
    
    // ✅ CLEAR SELECTED SESSION IF IT WAS DELETED
    if (selectedSession === deletedSessionId) {
      const user = JSON.parse(localStorage.getItem("user"));
      const userSessionKey = `lastSelectedSession_${user._id}`;
      
      setSelectedSession(null);
      localStorage.removeItem(userSessionKey);
    }
  };

  // ✅ LISTEN FOR SESSION CREATION FROM SIDEBAR
  useEffect(() => {
    const handleNewSessionCreated = (event) => {
      const { sessionId } = event.detail;
      console.log('🎉 [CHAT INTERFACE] New session created from sidebar:', sessionId);
      
      const user = JSON.parse(localStorage.getItem("user"));
      const userSessionKey = `lastSelectedSession_${user._id}`;
      
      setSelectedSession(sessionId);
      localStorage.setItem(userSessionKey, sessionId);
    };

    window.addEventListener('newSessionCreated', handleNewSessionCreated);
    return () => window.removeEventListener('newSessionCreated', handleNewSessionCreated);
  }, []);

  // ✅ CLEANUP ON USER CHANGE (ADD THIS)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'user' || e.key === 'token') {
        console.log('👤 [CHAT INTERFACE] User changed, clearing session');
        setSelectedSession(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-8 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-600 text-6xl">🔒</div>
          <div className="text-xl font-semibold text-red-800">
            Authentication Required
          </div>
          <div className="text-red-600">{authError}</div>
          <button
            onClick={() => window.location.href = '/signup'}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className={`flex-shrink-0 transition-all duration-300 ease-in-out border-r border-gray-200 ${
        sidebarOpen ? 'w-[280px]' : 'w-[60px]'
      }`}>
        <SideBar
          onSelectSession={handleSessionSelect}
          onToggle={handleSidebarToggle}
          onSessionDelete={handleSessionDelete}
          selectedSessionId={selectedSession}
        />
      </div>

      {/* Chat Dashboard */}
      <div className="flex-grow transition-all duration-300 ease-in-out">
        {selectedSession ? (
          <ChatDashBoard
            selectedSession={selectedSession}
            onSessionUpdate={handleSessionUpdate}
            onSessionDelete={handleSessionDelete}
            key={selectedSession}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl">💬</div>
              <div className="text-xl font-semibold text-gray-700">
                Welcome to Nexus AI
              </div>
              <div className="text-gray-500 max-w-md">
                Select a chat from the sidebar or start a new conversation by clicking "New Chat".
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
