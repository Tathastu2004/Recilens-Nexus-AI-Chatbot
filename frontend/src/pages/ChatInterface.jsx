import React, { useState, useEffect } from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';

const ChatInterface = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [sessionSelectionTimeout, setSessionSelectionTimeout] = useState(null); // ✅ ADD MISSING STATE

  // ✅ CLEANUP TIMEOUT ON UNMOUNT
  useEffect(() => {
    return () => {
      if (sessionSelectionTimeout) {
        clearTimeout(sessionSelectionTimeout);
      }
    };
  }, [sessionSelectionTimeout]);

  // ✅ PERSIST SELECTED SESSION ON REFRESH
  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    
    if (!token || !user) {
      setAuthError('Please log in to access the chat interface.');
      setIsLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(user);
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

    // ✅ RESTORE LAST SELECTED SESSION FROM LOCALSTORAGE
    const lastSession = localStorage.getItem('lastSelectedSession');
    console.log('🔄 [CHAT INTERFACE] Restoring session:', lastSession);
    
    if (lastSession && 
        lastSession !== 'null' && 
        lastSession !== 'undefined' && 
        lastSession.trim() !== '') {
      
      // ✅ VALIDATE SESSION ID FORMAT
      if (lastSession.startsWith('new-') || lastSession.startsWith('temp-') || lastSession.match(/^[0-9a-fA-F]{24}$/)) {
        setSelectedSession(lastSession);
      } else {
        console.log('⚠️ [CHAT INTERFACE] Invalid session format, clearing:', lastSession);
        localStorage.removeItem('lastSelectedSession');
      }
    }
    
    setIsLoading(false);
  }, []);

  // ✅ IMPROVED SESSION SELECTION WITH PROPER CLEANUP
  const handleSessionSelect = (sessionId) => {
    console.log('🎯 [CHAT INTERFACE] Session selected:', sessionId);
    
    // ✅ CLEAR PREVIOUS TIMEOUT
    if (sessionSelectionTimeout) {
      clearTimeout(sessionSelectionTimeout);
    }
    
    // ✅ VALIDATE SESSION ID
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      console.log('⚠️ [CHAT INTERFACE] Invalid session ID, clearing selection');
      setSelectedSession(null);
      localStorage.removeItem('lastSelectedSession');
      return;
    }
    
    // ✅ IMMEDIATE UPDATE FOR BETTER UX
    setSelectedSession(sessionId);
    localStorage.setItem('lastSelectedSession', sessionId);
    
    // ✅ DEBOUNCE FOR BACKEND CALLS ONLY
    const timeout = setTimeout(() => {
      console.log('🔄 [CHAT INTERFACE] Debounced session update completed for:', sessionId);
    }, 100);
    
    setSessionSelectionTimeout(timeout);
  };

  const handleSidebarToggle = (isOpen) => {
    setSidebarOpen(isOpen);
  };

  const handleSessionUpdate = (updatedSession) => {
    console.log('📝 [CHAT INTERFACE] Session updated:', updatedSession);
    
    // ✅ TRIGGER SESSION LIST REFRESH
    window.dispatchEvent(new CustomEvent('sessionUpdated', { 
      detail: updatedSession 
    }));
  };

  const handleNewChat = () => {
    const tempSessionId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆕 [CHAT INTERFACE] Creating new chat with ID:', tempSessionId);
    setSelectedSession(tempSessionId);
    localStorage.setItem('lastSelectedSession', tempSessionId);
  };

  // ✅ ADD SESSION DELETION HANDLER
  const handleSessionDelete = (deletedSessionId) => {
    console.log('🗑️ [CHAT INTERFACE] Session deleted:', deletedSessionId);
    
    // ✅ CLEAR SELECTED SESSION IF IT WAS DELETED
    if (selectedSession === deletedSessionId) {
      setSelectedSession(null);
      localStorage.removeItem('lastSelectedSession');
    }
    
    // ✅ TRIGGER SESSION LIST REFRESH
    window.dispatchEvent(new CustomEvent('sessionUpdated', { 
      detail: { _id: deletedSessionId, deleted: true }
    }));
  };

  // ✅ ADD THIS INSIDE ChatInterface useEffect
  useEffect(() => {
    // ✅ LISTEN FOR SESSION CREATION TO UPDATE SELECTED SESSION
    const handleSessionCreated = (event) => {
      const { oldId, newId, session } = event.detail;
      console.log('🎉 [CHAT INTERFACE] Session created:', { oldId, newId });
      
      if (selectedSession === oldId) {
        setSelectedSession(newId);
        localStorage.setItem('lastSelectedSession', newId);
      }
    };

    window.addEventListener('sessionCreated', handleSessionCreated);
    return () => window.removeEventListener('sessionCreated', handleSessionCreated);
  }, [selectedSession]);

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
          onSessionDelete={handleSessionDelete} // ✅ ADD DELETE HANDLER
          selectedSessionId={selectedSession}
        />
      </div>

      {/* Chat Dashboard */}
      <div className="flex-grow transition-all duration-300 ease-in-out">
        {selectedSession ? (
          <ChatDashBoard
            selectedSession={selectedSession}
            onSessionUpdate={handleSessionUpdate}
            onSessionDelete={handleSessionDelete} // ✅ ADD DELETE HANDLER
            key={`${selectedSession}-${Date.now()}`} // ✅ FORCE REMOUNT ON SESSION CHANGE
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl">💬</div>
              <div className="text-xl font-semibold text-gray-700">
                Welcome to Nexus AI
              </div>
              <div className="text-gray-500 max-w-md">
                Select a chat from the sidebar or start a new conversation.
              </div>
              <button
                onClick={handleNewChat}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
