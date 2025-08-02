import React, { useState, useEffect } from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';
import { useTheme } from '../context/ThemeContext';
import { IconSun, IconMoon, IconBrain, IconFileText, IconMicrophone } from '@tabler/icons-react';

const ChatInterface = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  // ✅ ENHANCED PERSISTENT SESSION RESTORATION WITH PROPER VERIFICATION
  useEffect(() => {
    const initializeSession = async () => {
      // Check authentication first
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

      // ✅ MULTIPLE SESSION RESTORATION SOURCES - PRIORITY ORDER
      const urlParams = new URLSearchParams(window.location.search);
      const urlSession = urlParams.get('session');
      const userSessionKey = `lastSelectedSession_${parsedUser._id}`;
      const localStorageSession = localStorage.getItem(userSessionKey);
      const fallbackSession = localStorage.getItem('currentChatSession'); // ChatDashBoard persistence
      
      console.log('🔄 [CHAT INTERFACE] Session restoration sources:', {
        userId: parsedUser._id,
        urlSession,
        localStorageSession,
        fallbackSession,
        currentUrl: window.location.href
      });

      // ✅ DETERMINE SESSION TO RESTORE (URL takes highest priority)
      let sessionToRestore = urlSession || localStorageSession || fallbackSession;
      
      // Clean up old non-user-specific data
      if (localStorage.getItem('lastSelectedSession')) {
        console.log('🧹 [CHAT INTERFACE] Cleaning old non-user-specific session data');
        localStorage.removeItem('lastSelectedSession');
      }
      
      if (sessionToRestore && 
          sessionToRestore !== 'null' && 
          sessionToRestore !== 'undefined' && 
          sessionToRestore.trim() !== '' &&
          sessionToRestore.match(/^[0-9a-fA-F]{24}$/)) {
        
        console.log('✅ [CHAT INTERFACE] Valid session found, verifying:', sessionToRestore);
        
        // ✅ VERIFY SESSION EXISTS AND BELONGS TO USER
        const isValid = await verifyAndRestoreSession(sessionToRestore, parsedUser._id, userSessionKey);
        
        if (isValid) {
          console.log('✅ [CHAT INTERFACE] Session verified and restored:', sessionToRestore);
          setSelectedSession(sessionToRestore);
          setSessionVerified(true);
          
          // ✅ ENSURE URL AND STORAGE ARE SYNCED
          if (!urlSession) {
            // Update URL if session came from localStorage
            const url = new URL(window.location);
            url.searchParams.set('session', sessionToRestore);
            window.history.replaceState({}, '', url);
          }
          
          // ✅ ENSURE USER-SPECIFIC STORAGE IS UPDATED
          localStorage.setItem(userSessionKey, sessionToRestore);
          localStorage.setItem('currentChatSession', sessionToRestore); // For ChatDashBoard
          
        } else {
          console.log('❌ [CHAT INTERFACE] Session verification failed, clearing');
          setSelectedSession(null);
          setSessionVerified(false);
          
          // Clear invalid session from all sources
          localStorage.removeItem(userSessionKey);
          localStorage.removeItem('currentChatSession');
          
          // Remove from URL
          const url = new URL(window.location);
          url.searchParams.delete('session');
          window.history.replaceState({}, '', url);
        }
      } else {
        console.log('ℹ️ [CHAT INTERFACE] No valid session to restore');
        setSelectedSession(null);
        setSessionVerified(false);
        
        // Clean up URL if it has invalid session
        if (urlSession) {
          const url = new URL(window.location);
          url.searchParams.delete('session');
          window.history.replaceState({}, '', url);
        }
      }
      
      setIsLoading(false);
    };

    initializeSession();
  }, []); // ✅ Run only once on mount

  // ✅ ENHANCED SESSION VERIFICATION
  const verifyAndRestoreSession = async (sessionId, userId, storageKey) => {
    try {
      const token = localStorage.getItem("token");
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      
      console.log('🔍 [CHAT INTERFACE] Verifying session:', {
        sessionId,
        userId,
        backendUrl: backendUrl + '/api/chat/session/' + sessionId
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const res = await fetch(`${backendUrl}/api/chat/session/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const sessionData = await res.json();
        console.log('📋 [CHAT INTERFACE] Session verification response:', {
          sessionId: sessionData._id,
          sessionUser: sessionData.user,
          currentUser: userId,
          title: sessionData.title,
          isValid: sessionData.user === userId
        });
        
        // ✅ VERIFY SESSION BELONGS TO CURRENT USER
        if (sessionData.user === userId) {
          return true;
        } else {
          console.log('⚠️ [CHAT INTERFACE] Session belongs to different user');
          return false;
        }
      } else {
        console.log('⚠️ [CHAT INTERFACE] Session not found or invalid:', {
          status: res.status,
          statusText: res.statusText
        });
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ [CHAT INTERFACE] Session verification timeout');
      } else {
        console.error('❌ [CHAT INTERFACE] Session verification failed:', error);
      }
      return false;
    }
  };

  // ✅ ENHANCED SESSION SELECTION WITH PROPER PERSISTENCE
  const handleSessionSelect = (sessionId) => {
    console.log('🎯 [CHAT INTERFACE] Session selected:', {
      sessionId,
      previous: selectedSession,
      isValid: sessionId && sessionId.match(/^[0-9a-fA-F]{24}$/)
    });
    
    const user = JSON.parse(localStorage.getItem("user"));
    const userSessionKey = `lastSelectedSession_${user._id}`;
    
    // ✅ VALIDATE SESSION ID
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      console.log('⚠️ [CHAT INTERFACE] Invalid session ID, clearing selection');
      setSelectedSession(null);
      setSessionVerified(false);
      
      // Clear from storage and URL
      localStorage.removeItem(userSessionKey);
      localStorage.removeItem('currentChatSession');
      
      const url = new URL(window.location);
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url);
      return;
    }
    
    // ✅ UPDATE STATE AND PERSISTENCE
    setSelectedSession(sessionId);
    setSessionVerified(true); // ✅ Set verified immediately for valid sessions
    
    // ✅ PERSIST TO MULTIPLE LOCATIONS
    localStorage.setItem(userSessionKey, sessionId);
    localStorage.setItem('currentChatSession', sessionId); // For ChatDashBoard compatibility
    
    // ✅ UPDATE URL
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url);
    
    console.log('✅ [CHAT INTERFACE] Session selection persisted:', {
      sessionId,
      url: url.toString(),
      userStorage: userSessionKey,
      globalStorage: 'currentChatSession'
    });
  };

  const handleSidebarToggle = (isOpen) => {
    setSidebarOpen(isOpen);
  };

  const handleSessionUpdate = (updatedSession) => {
    console.log('📝 [CHAT INTERFACE] Session updated:', updatedSession);
    
    // ✅ ENSURE UPDATED SESSION REMAINS SELECTED
    if (updatedSession && updatedSession !== selectedSession) {
      handleSessionSelect(updatedSession);
    }
  };

  const handleSessionDelete = (deletedSessionId) => {
    console.log('🗑️ [CHAT INTERFACE] Session deleted:', deletedSessionId);
    
    // ✅ CLEAR SELECTED SESSION IF IT WAS DELETED
    if (selectedSession === deletedSessionId) {
      handleSessionSelect(null);
    }
  };

  // ✅ HANDLE BROWSER NAVIGATION (BACK/FORWARD)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSession = urlParams.get('session');
      
      console.log('🔙 [CHAT INTERFACE] Browser navigation detected:', {
        urlSession,
        currentSelected: selectedSession
      });
      
      if (urlSession !== selectedSession) {
        if (urlSession && urlSession.match(/^[0-9a-fA-F]{24}$/)) {
          handleSessionSelect(urlSession);
        } else {
          handleSessionSelect(null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSession]);

  // ✅ LISTEN FOR SESSION CREATION FROM SIDEBAR
  useEffect(() => {
    const handleNewSessionCreated = (event) => {
      const { sessionId } = event.detail;
      console.log('🎉 [CHAT INTERFACE] New session created from event:', sessionId);
      
      // ✅ ALWAYS SELECT NEW SESSION
      handleSessionSelect(sessionId);
    };

    const handleSessionCreationFailed = (event) => {
      const { error } = event.detail;
      console.error('❌ [CHAT INTERFACE] Session creation failed:', error);
      
      // Clear any temp session
      if (selectedSession && selectedSession.startsWith('temp-')) {
        handleSessionSelect(null);
      }
    };

    window.addEventListener('newSessionCreated', handleNewSessionCreated);
    window.addEventListener('sessionCreated', handleNewSessionCreated);
    window.addEventListener('sessionCreationFailed', handleSessionCreationFailed);
    
    return () => {
      window.removeEventListener('newSessionCreated', handleNewSessionCreated);
      window.removeEventListener('sessionCreated', handleNewSessionCreated);
      window.removeEventListener('sessionCreationFailed', handleSessionCreationFailed);
    };
  }, [selectedSession]);

  // ✅ ENHANCED createNewChat FUNCTION
  const createNewChat = async () => {
    try {
      const token = localStorage.getItem("token");
      const user = localStorage.getItem("user");
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

      if (!token || !user) {
        setAuthError('Authentication required. Please log in again.');
        return;
      }

      const parsedUser = JSON.parse(user);
      if (!parsedUser._id) {
        setAuthError('Invalid user data. Please log in again.');
        return;
      }

      console.log('🆕 [CHAT INTERFACE] Creating new chat session...');

      // ✅ SHOW IMMEDIATE FEEDBACK
      const tempSessionId = `temp-${Date.now()}`;
      handleSessionSelect(tempSessionId);

      const response = await fetch(`${backendUrl}/api/chat/session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: 'New Chat',
          userId: parsedUser._id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // Handle both response formats
      let sessionData;
      if (data.success && data.session) {
        sessionData = data.session;
      } else if (data._id && data.title) {
        sessionData = data;
      } else {
        throw new Error('Invalid response format from server');
      }

      const newSessionId = sessionData._id;
      console.log('✅ [CHAT INTERFACE] New session created:', newSessionId);
      
      // ✅ DISPATCH EVENTS
      window.dispatchEvent(new CustomEvent('sessionCreated', {
        detail: { 
          session: sessionData,
          sessionId: newSessionId,
          timestamp: new Date().toISOString()
        }
      }));
      
      window.dispatchEvent(new CustomEvent('newSessionCreated', {
        detail: { 
          session: sessionData,
          sessionId: newSessionId
        }
      }));
      
      // ✅ SELECT NEW SESSION
      handleSessionSelect(newSessionId);
      
      return sessionData;
      
    } catch (error) {
      console.error('❌ [CHAT INTERFACE] Failed to create new chat:', error);
      
      // Clear temp session
      handleSessionSelect(null);
      
      // Handle specific errors
      if (error.message.includes('401')) {
        setAuthError('Session expired. Please log in again.');
        localStorage.clear();
      } else {
        alert(`Failed to create new chat: ${error.message}`);
      }
      
      window.dispatchEvent(new CustomEvent('sessionCreationFailed', {
        detail: { 
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  // ✅ LOADING STATE
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-screen transition-all duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <div className="text-center space-y-6">
          <div className="relative">
            <div className={`w-16 h-16 rounded-full border-4 border-t-4 animate-spin mx-auto ${
              isDark 
                ? 'border-gray-700 border-t-blue-400' 
                : 'border-gray-200 border-t-blue-500'
            }`}></div>
          </div>
          
          <div className="space-y-2">
            <div className={`text-xl font-semibold transition-colors ${
              isDark 
                ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
            }`}>
              Restoring Session
            </div>
            <div className={`text-sm animate-pulse ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Loading your conversation...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ AUTH ERROR STATE
  if (authError) {
    return (
      <div className={`flex items-center justify-center h-screen transition-all duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-red-900 to-gray-900' 
          : 'bg-gradient-to-br from-red-50 via-pink-50 to-red-50'
      }`}>
        <div className={`text-center space-y-6 p-8 rounded-2xl border backdrop-blur-sm transition-all ${
          isDark 
            ? 'bg-red-900/20 border-red-500/30 shadow-2xl shadow-red-500/10' 
            : 'bg-red-50/80 border-red-200 shadow-xl'
        }`}>
          <div className="relative">
            <div className="text-6xl animate-bounce">🔒</div>
          </div>
          
          <div className="space-y-3">
            <div className={`text-xl font-bold transition-colors ${
              isDark 
                ? 'bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent' 
                : 'text-red-800'
            }`}>
              Authentication Required
            </div>
            <div className={`max-w-md mx-auto leading-relaxed ${
              isDark ? 'text-red-300' : 'text-red-600'
            }`}>
              {authError}
            </div>
          </div>
          
          <button
            onClick={() => window.location.href = '/signup'}
            className={`px-8 py-3 font-medium rounded-xl transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
              isDark 
                ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg' 
                : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-md'
            }`}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'
    }`}>
      {/* ✅ SIDEBAR */}
      <div className={`flex-shrink-0 transition-all duration-300 ease-in-out border-r ${
        isDark ? 'border-gray-700' : 'border-gray-200'
      } ${sidebarOpen ? 'w-[280px]' : 'w-[70px]'}`}>
        <SideBar
          onSelectSession={handleSessionSelect}
          onToggle={handleSidebarToggle}
          onSessionDelete={handleSessionDelete}
          selectedSessionId={selectedSession}
        />
      </div>

      {/* ✅ MAIN CONTENT - ONLY SHOW CHAT IF SESSION EXISTS AND IS VERIFIED */}
      <div className="flex-grow">
        {selectedSession && sessionVerified && selectedSession.match(/^[0-9a-fA-F]{24}$/) ? (
          <ChatDashBoard
            selectedSession={selectedSession}
            onSessionUpdate={handleSessionUpdate}
            onSessionDelete={handleSessionDelete}
            key={selectedSession} // ✅ Force re-render when session changes
          />
        ) : (
          // ✅ WELCOME SCREEN
          <div className={`h-full ${
            isDark 
              ? 'bg-gray-900' 
              : 'bg-gray-50'
          }`}>
            {/* Theme toggle button */}
            <button
              onClick={toggleTheme}
              className={`absolute top-4 right-4 z-50 p-3 rounded-xl transition-all duration-200 ${
                isDark 
                  ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-600' 
                  : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 shadow-sm'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
            </button>

            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center space-y-8 max-w-4xl mx-auto">
                {/* Hero section */}
                <div className="space-y-6">
                  <div className="relative inline-block">
                    <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center ${
                      isDark ? 'bg-blue-600' : 'bg-blue-500'
                    }`}>
                      <IconBrain size={40} className="text-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h1 className={`text-4xl md:text-5xl font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      Welcome to Nexus AI
                    </h1>
                    <p className={`text-lg md:text-xl max-w-2xl mx-auto leading-relaxed ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Your intelligent AI companion is ready to assist with coding, writing, analysis, and creative tasks. 
                      Start a conversation to unlock the power of advanced AI.
                    </p>
                  </div>
                </div>
                
                {/* CTA button */}
                <div className="space-y-6">
                  <button
                    onClick={createNewChat}
                    className={`group inline-flex items-center gap-4 px-8 py-4 font-semibold text-lg rounded-2xl transition-all duration-200 hover:scale-105 ${
                      isDark 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    } shadow-lg hover:shadow-xl`}
                  >
                    <svg 
                      className="w-6 h-6 transition-transform group-hover:rotate-12" 
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
                    <span>Start New Conversation</span>
                  </button>
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                  {[
                    {
                      icon: <IconBrain size={32} />,
                      title: 'Advanced AI',
                      description: 'State-of-the-art language models for intelligent conversations',
                      color: 'blue'
                    },
                    {
                      icon: <IconFileText size={32} />,
                      title: 'File Support',
                      description: 'Upload and analyze documents, images, and code files',
                      color: 'green'
                    },
                    {
                      icon: <IconMicrophone size={32} />,
                      title: 'Voice Input',
                      description: 'Natural speech recognition for hands-free interaction',
                      color: 'purple'
                    }
                  ].map((feature, index) => (
                    <div
                      key={index}
                      className={`p-6 rounded-2xl border transition-all duration-200 hover:scale-105 cursor-pointer ${
                        isDark 
                          ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      } shadow-lg hover:shadow-xl`}
                    >
                      <div className="text-center space-y-4">
                        <div className={`inline-flex p-3 rounded-xl ${
                          feature.color === 'blue' 
                            ? isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                            : feature.color === 'green'
                            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
                            : isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {feature.icon}
                        </div>
                        
                        <div className={`font-bold text-lg ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {feature.title}
                        </div>
                        
                        <div className={`text-sm leading-relaxed ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {feature.description}
                        </div>
                      </div>
                    </div>
                  ))}
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