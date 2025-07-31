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
      const { sessionId, session } = event.detail;
      console.log('🎉 [CHAT INTERFACE] New session created from event:', sessionId);
      
      const user = JSON.parse(localStorage.getItem("user"));
      const userSessionKey = `lastSelectedSession_${user._id}`;
      
      // ✅ ONLY UPDATE IF NOT ALREADY SELECTED
      if (selectedSession !== sessionId) {
        setSelectedSession(sessionId);
        localStorage.setItem(userSessionKey, sessionId);
      }
    };

    // ✅ ADD ERROR HANDLER
    const handleSessionCreationFailed = (event) => {
      const { error } = event.detail;
      console.error('❌ [CHAT INTERFACE] Session creation failed:', error);
      
      // Clear any temp session
      if (selectedSession && selectedSession.startsWith('temp-')) {
        setSelectedSession(null);
      }
    };

    window.addEventListener('newSessionCreated', handleNewSessionCreated);
    window.addEventListener('sessionCreated', handleNewSessionCreated); // ✅ ALSO LISTEN TO NEW EVENT
    window.addEventListener('sessionCreationFailed', handleSessionCreationFailed); // ✅ NEW
    
    return () => {
      window.removeEventListener('newSessionCreated', handleNewSessionCreated);
      window.removeEventListener('sessionCreated', handleNewSessionCreated); // ✅ NEW
      window.removeEventListener('sessionCreationFailed', handleSessionCreationFailed); // ✅ NEW
    };
  }, [selectedSession]);

  // ✅ REPLACE THE ENTIRE createNewChat FUNCTION WITH THIS ROBUST VERSION
  const createNewChat = async () => {
    try {
      const token = localStorage.getItem("token");
      const user = localStorage.getItem("user");
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

      // ✅ VALIDATION
      if (!token) {
        console.error('❌ No authentication token found');
        setAuthError('Authentication token missing. Please log in again.');
        return;
      }

      if (!user) {
        console.error('❌ No user data found');
        setAuthError('User data missing. Please log in again.');
        return;
      }

      let parsedUser;
      try {
        parsedUser = JSON.parse(user);
        if (!parsedUser._id) {
          throw new Error('User ID missing');
        }
      } catch (parseError) {
        console.error('❌ Invalid user data:', parseError);
        setAuthError('Invalid user data. Please log in again.');
        return;
      }

      console.log('🆕 [CHAT INTERFACE] Creating new chat session...', {
        userId: parsedUser._id,
        backendUrl
      });

      // ✅ SHOW IMMEDIATE FEEDBACK
      const tempSessionId = `temp-${Date.now()}`;
      setSelectedSession(tempSessionId);

      // ✅ REQUEST DATA
      const requestData = {
        title: 'New Chat',
        userId: parsedUser._id
      };

      console.log('📤 [CHAT INTERFACE] Sending request:', {
        url: `${backendUrl}/api/chat/session`,
        method: 'POST',
        body: requestData
      });

      const response = await fetch(`${backendUrl}/api/chat/session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestData)
      });

      console.log('📥 [CHAT INTERFACE] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          console.error('❌ [CHAT INTERFACE] Server error response:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          console.error('❌ [CHAT INTERFACE] Failed to parse error response:', jsonError);
          const textError = await response.text();
          console.error('❌ [CHAT INTERFACE] Error response text:', textError);
          errorMessage = textError || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ [CHAT INTERFACE] Session creation response:', data);

      // ✅ HANDLE BOTH RESPONSE FORMATS
      let sessionData;
      let isSuccess = false;

      // Check if response has success field (new format)
      if (data.hasOwnProperty('success')) {
        isSuccess = data.success;
        sessionData = data.session;
        console.log('📋 [CHAT INTERFACE] Using wrapped response format');
      } 
      // Check if response is direct session object (current backend format)
      else if (data._id && data.title && data.user) {
        isSuccess = true;
        sessionData = data;
        console.log('📋 [CHAT INTERFACE] Using direct session response format');
      }
      // Invalid response
      else {
        console.error('❌ [CHAT INTERFACE] Invalid response format:', data);
        throw new Error(data.message || data.error || 'Invalid response format from server');
      }

      if (isSuccess && sessionData) {
        const newSessionId = sessionData._id;
        console.log('✅ [CHAT INTERFACE] New session created successfully:', {
          sessionId: newSessionId,
          title: sessionData.title,
          userId: sessionData.user || sessionData.userId // Handle both field names
        });
        
        // ✅ IMMEDIATELY DISPATCH MULTIPLE EVENTS FOR COMPREHENSIVE UPDATE
        const sessionCreatedEvent = new CustomEvent('sessionCreated', {
          detail: { 
            session: sessionData,
            sessionId: newSessionId,
            timestamp: new Date().toISOString()
          }
        });
        
        const newSessionCreatedEvent = new CustomEvent('newSessionCreated', {
          detail: { 
            session: sessionData,
            sessionId: newSessionId
          }
        });

        window.dispatchEvent(sessionCreatedEvent);
        window.dispatchEvent(newSessionCreatedEvent);
        
        console.log('📢 [CHAT INTERFACE] Events dispatched:', {
          sessionCreated: true,
          newSessionCreated: true
        });

        // ✅ UPDATE STATE AND STORAGE
        handleSessionSelect(newSessionId);
        
        console.log('✅ [CHAT INTERFACE] Session selection updated');
        return sessionData;
        
      } else {
        console.error('❌ [CHAT INTERFACE] Session creation failed:', data);
        throw new Error(data.message || data.error || 'Failed to create session');
      }
      
    } catch (error) {
      console.error('❌ [CHAT INTERFACE] Failed to create new chat:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // ✅ CLEAR TEMP SESSION ON ERROR
      setSelectedSession(null);
      
      // ✅ HANDLE SPECIFIC ERROR TYPES
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        setAuthError('Session expired. Please log in again.');
        localStorage.clear();
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        setAuthError('Access denied. Please check your permissions.');
      } else if (error.message.includes('500')) {
        console.error('❌ Server error - check backend logs');
      }
      
      // ✅ DISPATCH ERROR EVENT
      window.dispatchEvent(new CustomEvent('sessionCreationFailed', {
        detail: { 
          error: error.message,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      }));
      
      // ✅ SHOW USER-FRIENDLY ERROR MESSAGE
      alert(`Failed to create new chat: ${error.message}`);
    }
  };

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
            <div className="text-center space-y-6 max-w-lg mx-auto p-8">
              <div className="text-6xl animate-pulse">💬</div>
              <div className="space-y-3">
                <div className="text-xl font-semibold text-gray-700">
                  Welcome to Nexus AI
                </div>
                <div className="text-gray-500 max-w-md mx-auto leading-relaxed">
                  Select a chat from the sidebar or start a new conversation by clicking the button below.
                </div>
              </div>
              
              {/* ✅ NEW CHAT BUTTON */}
              <div className="space-y-4">
                <button
                  onClick={createNewChat}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 4v16m8-8H4" 
                    />
                  </svg>
                  Start New Chat
                </button>
                
                {/* ✅ ADDITIONAL HELPFUL ACTIONS */}
                <div className="text-sm text-gray-400">
                  Or press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + N</kbd> to create a new chat
                </div>
              </div>

              {/* ✅ QUICK FEATURE HIGHLIGHTS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-sm">
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl mb-2">🤖</div>
                  <div className="font-medium text-gray-700">AI Assistant</div>
                  <div className="text-gray-500 text-center">Get help with coding, writing, and more</div>
                </div>
                
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl mb-2">📁</div>
                  <div className="font-medium text-gray-700">File Support</div>
                  <div className="text-gray-500 text-center">Upload images and documents</div>
                </div>
                
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl mb-2">🎤</div>
                  <div className="font-medium text-gray-700">Voice Input</div>
                  <div className="text-gray-500 text-center">Speak to the AI assistant</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
