import React, { useState, useEffect } from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';
import { useTheme } from '../context/ThemeContext';
import { IconSun, IconMoon, IconFileText, IconRocket, IconShield, IconBolt, IconSparkles } from '@tabler/icons-react';

// ✅ SessionPersistence utilities (unchanged)
const SessionPersistence = {
  getUserSessionKey: (userId) => `nexus_session_${userId}`,
  
  saveSession: (userId, sessionId, metadata = {}) => {
    if (!userId || !sessionId) return false;
    
    const sessionData = {
      sessionId,
      userId,
      timestamp: Date.now(),
      url: window.location.href,
      metadata
    };
    
    try {
      localStorage.setItem(SessionPersistence.getUserSessionKey(userId), JSON.stringify(sessionData));
      localStorage.setItem('nexus_last_session', JSON.stringify(sessionData));
      localStorage.setItem('currentChatSession', sessionId);
      
      console.log('💾 [PERSISTENCE] Session saved:', { userId, sessionId, timestamp: sessionData.timestamp });
      return true;
    } catch (error) {
      console.error('❌ [PERSISTENCE] Save failed:', error);
      return false;
    }
  },
  
  loadSession: (userId) => {
    if (!userId) return null;
    
    try {
      const userKey = SessionPersistence.getUserSessionKey(userId);
      let sessionData = localStorage.getItem(userKey);
      
      if (!sessionData) {
        sessionData = localStorage.getItem('nexus_last_session');
      }
      
      if (!sessionData) return null;
      
      const parsed = JSON.parse(sessionData);
      
      if (!parsed.sessionId || !parsed.userId || parsed.userId !== userId) {
        console.log('⚠️ [PERSISTENCE] Invalid session data, clearing');
        SessionPersistence.clearSession(userId);
        return null;
      }
      
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > maxAge) {
        console.log('⚠️ [PERSISTENCE] Session expired, clearing');
        SessionPersistence.clearSession(userId);
        return null;
      }
      
      console.log('✅ [PERSISTENCE] Session loaded:', { 
        sessionId: parsed.sessionId, 
        age: Math.round((Date.now() - parsed.timestamp) / 1000 / 60), 
        minutes: 'minutes ago' 
      });
      
      return parsed;
    } catch (error) {
      console.error('❌ [PERSISTENCE] Load failed:', error);
      SessionPersistence.clearSession(userId);
      return null;
    }
  },
  
  clearSession: (userId) => {
    try {
      if (userId) {
        localStorage.removeItem(SessionPersistence.getUserSessionKey(userId));
      }
      localStorage.removeItem('nexus_last_session');
      localStorage.removeItem('currentChatSession');
      console.log('🧹 [PERSISTENCE] Session cleared');
    } catch (error) {
      console.error('❌ [PERSISTENCE] Clear failed:', error);
    }
  },
  
  getSessionFromURL: () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
  },
  
  updateURL: (sessionId) => {
    try {
      const url = new URL(window.location);
      if (sessionId) {
        url.searchParams.set('session', sessionId);
      } else {
        url.searchParams.delete('session');
      }
      window.history.replaceState({}, '', url);
      console.log('🔗 [PERSISTENCE] URL updated:', url.toString());
    } catch (error) {
      console.error('❌ [PERSISTENCE] URL update failed:', error);
    }
  }
};

const ChatInterface = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  // ✅ REFRESH-PROOF SESSION RESTORATION
  useEffect(() => {
    const restoreSessionOnRefresh = async () => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        console.log('⚠️ [REFRESH] No stored auth data, waiting for Clerk...');
        setIsLoading(false);
        return;
      }

      let parsedUser;
      try {
        parsedUser = JSON.parse(storedUser);
        if (!parsedUser._id) {
          console.log('⚠️ [REFRESH] Invalid user data');
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.log('⚠️ [REFRESH] Failed to parse user data');
        setIsLoading(false);
        return;
      }

      console.log('🔄 [REFRESH] Starting session restoration for user:', parsedUser._id);

      const urlSession = SessionPersistence.getSessionFromURL();
      const persistedSession = SessionPersistence.loadSession(parsedUser._id);
      
      console.log('🔍 [REFRESH] Session sources:', {
        urlSession,
        persistedSessionId: persistedSession?.sessionId,
        persistedAge: persistedSession ? Math.round((Date.now() - persistedSession.timestamp) / 1000 / 60) + ' min ago' : 'none'
      });

      let sessionToRestore = urlSession || persistedSession?.sessionId;
      
      if (sessionToRestore && sessionToRestore.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('✅ [REFRESH] Valid session found, verifying:', sessionToRestore);
        
        const isValid = await verifySessionWithServer(sessionToRestore, parsedUser._id);
        
        if (isValid) {
          console.log('✅ [REFRESH] Session verified, restoring:', sessionToRestore);
          
          setSelectedSession(sessionToRestore);
          setSessionVerified(true);
          
          SessionPersistence.saveSession(parsedUser._id, sessionToRestore, {
            restored: true,
            source: urlSession ? 'url' : 'localStorage'
          });
          SessionPersistence.updateURL(sessionToRestore);
          
        } else {
          console.log('❌ [REFRESH] Session verification failed, clearing');
          setSelectedSession(null);
          setSessionVerified(false);
          SessionPersistence.clearSession(parsedUser._id);
          SessionPersistence.updateURL(null);
        }
      } else {
        console.log('ℹ️ [REFRESH] No valid session to restore');
        setSelectedSession(null);
        setSessionVerified(false);
        SessionPersistence.clearSession(parsedUser._id);
        SessionPersistence.updateURL(null);
      }
      
      setIsLoading(false);
    };

    const timer = setTimeout(restoreSessionOnRefresh, 1000);
    return () => clearTimeout(timer);
  }, []);

  // ✅ ENHANCED SESSION VERIFICATION
  const verifySessionWithServer = async (sessionId, userId) => {
    try {
      const token = localStorage.getItem("token");
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      
      console.log('🔍 [VERIFY] Checking session with server:', sessionId);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
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
        const isValid = sessionData.user === userId;
        
        console.log('📋 [VERIFY] Server response:', {
          sessionId: sessionData._id,
          sessionUser: sessionData.user,
          currentUser: userId,
          title: sessionData.title,
          isValid
        });
        
        return isValid;
      } else {
        console.log('⚠️ [VERIFY] Session not found:', res.status);
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ [VERIFY] Verification timeout');
      } else {
        console.error('❌ [VERIFY] Verification failed:', error);
      }
      return false;
    }
  };

  // ✅ ENHANCED SESSION SELECTION WITH PERSISTENCE
  const handleSessionSelect = (sessionId) => {
    console.log('🎯 [SELECT] Session selected:', sessionId);
    
    const user = JSON.parse(localStorage.getItem("user"));
    
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      console.log('⚠️ [SELECT] Clearing session selection');
      setSelectedSession(null);
      setSessionVerified(false);
      SessionPersistence.clearSession(user._id);
      SessionPersistence.updateURL(null);
      return;
    }
    
    if (!sessionId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ [SELECT] Invalid session ID format:', sessionId);
      return;
    }
    
    setSelectedSession(sessionId);
    setSessionVerified(true);
    
    SessionPersistence.saveSession(user._id, sessionId, {
      selectedAt: Date.now(),
      source: 'user_selection'
    });
    SessionPersistence.updateURL(sessionId);
    
    // ✅ CLOSE MOBILE MENU WHEN SESSION IS SELECTED
    setIsMobileMenuOpen(false);
    
    console.log('✅ [SELECT] Session selection completed and persisted');
  };

  const handleSessionUpdate = (updatedSession) => {
    console.log('📝 [CHAT INTERFACE] Session updated:', updatedSession);
    
    if (updatedSession && updatedSession !== selectedSession) {
      handleSessionSelect(updatedSession);
    }
  };

  const handleSessionDelete = (deletedSessionId) => {
    console.log('🗑️ [CHAT INTERFACE] Session deleted:', deletedSessionId);
    
    if (selectedSession === deletedSessionId) {
      handleSessionSelect(null);
    }
  };

  // ✅ HANDLE BROWSER NAVIGATION
  useEffect(() => {
    const handlePopState = () => {
      const urlSession = SessionPersistence.getSessionFromURL();
      
      console.log('🔙 [NAVIGATION] Browser navigation detected:', {
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

  // ✅ LISTEN FOR SESSION CREATION
  useEffect(() => {
    const handleNewSessionCreated = (event) => {
      const { sessionId } = event.detail;
      console.log('🎉 [CHAT INTERFACE] New session created from event:', sessionId);
      
      handleSessionSelect(sessionId);
    };

    const handleSessionCreationFailed = (event) => {
      const { error } = event.detail;
      console.error('❌ [CHAT INTERFACE] Session creation failed:', error);
      
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

  // ✅ CREATE NEW CHAT
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
      console.log('🆕 [CREATE] Creating new chat session...');

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
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const sessionData = data.success ? data.session : data;
      const newSessionId = sessionData._id;
      
      console.log('✅ [CREATE] New session created:', newSessionId);
      
      window.dispatchEvent(new CustomEvent('sessionCreated', {
        detail: { session: sessionData, sessionId: newSessionId }
      }));
      
      handleSessionSelect(newSessionId);
      
      return sessionData;
      
    } catch (error) {
      console.error('❌ [CREATE] Failed to create new chat:', error);
      
      if (error.message.includes('401')) {
        setAuthError('Session expired. Please log in again.');
        localStorage.clear();
      } else {
        alert(`Failed to create new chat: ${error.message}`);
      }
    }
  };

  // ✅ MINIMAL LOADING STATE
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa' }}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto"
               style={{ 
                 border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                 borderTopColor: isDark ? '#ffffff' : '#000000'
               }}></div>
          <div className="text-sm"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // ✅ MINIMAL AUTH ERROR STATE
  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen p-4"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa' }}>
        <div className="text-center space-y-6 p-8 rounded-xl max-w-md w-full"
             style={{ 
               backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
               border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
             }}>
          <div className="text-4xl">🔒</div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              Authentication Required
            </h3>
            <p className="text-sm"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
              {authError}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/signup'}
            className="px-6 py-2 font-medium rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full"
         style={{ backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa' }}>
      
      {/* ✅ MOBILE SIDEBAR OVERLAY */}
      <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden ${
        isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
           onClick={() => setIsMobileMenuOpen(false)} />

      {/* ✅ SIDEBAR */}
      <div className={`
        fixed lg:relative 
        inset-y-0 left-0 
        z-50 lg:z-auto
        transform lg:transform-none
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <SideBar
          onSelectSession={handleSessionSelect}
          onSessionDelete={handleSessionDelete}
          selectedSessionId={selectedSession}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        />
      </div>

      {/* ✅ MAIN CONTENT */}
      <div className="flex-1 min-w-0 flex flex-col">
        
        {/* ✅ MOBILE HEADER - FIXED POSITION */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-4"
             style={{ 
               backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
               borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
             }}>
          
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="text-lg font-semibold"
               style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Nexus AI
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
        </div>

        {/* Add mobile padding top to prevent content overlap */}
        <div className="lg:hidden h-16"></div>

        {/* ✅ CONTENT AREA */}
        <div className="flex-1">
          {selectedSession && sessionVerified && selectedSession.match(/^[0-9a-fA-F]{24}$/) ? (
            <ChatDashBoard
              selectedSession={selectedSession}
              onSessionUpdate={handleSessionUpdate}
              onSessionDelete={handleSessionDelete}
              onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
              key={selectedSession}
            />
          ) : (
            // ✅ CLEAN WELCOME SCREEN - ChatGPT/Perplexity Style
            <div className="h-full flex flex-col"
                 style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
              
              {/* Desktop Theme Toggle */}
              <div className="hidden lg:flex justify-end p-6">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: isDark ? '#ffffff' : '#666666'
                  }}
                  title={isDark ? 'Light mode' : 'Dark mode'}
                >
                  {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
                </button>
              </div>

              {/* ✅ MAIN WELCOME CONTENT */}
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center space-y-8 max-w-2xl mx-auto">
                  
                  {/* Simple Title */}
                  <div className="space-y-4">
                    <h1 className="text-4xl sm:text-5xl font-bold"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      How can I help you today?
                    </h1>
                  </div>
                  
                  {/* CTA Button */}
                  <div className="space-y-6">
                    <button
                      onClick={createNewChat}
                      className="inline-flex items-center gap-3 px-8 py-4 font-medium text-lg rounded-xl transition-all hover:scale-105"
                      style={{
                        backgroundColor: isDark ? '#ffffff' : '#000000',
                        color: isDark ? '#000000' : '#ffffff'
                      }}
                    >
                      <IconSparkles size={20} />
                      Start new chat
                    </button>

                    <div className="text-sm"
                         style={{ color: isDark ? '#888888' : '#666666' }}>
                      Begin by typing a message or uploading a file
                    </div>
                  </div>

                  {/* ✅ SIMPLE FEATURE CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
                    {[
                      {
                        icon: <IconBolt size={24} />, // <-- changed from IconZap
                        title: 'Fast responses',
                        description: 'Get instant answers powered by advanced AI'
                      },
                      {
                        icon: <IconFileText size={24} />,
                        title: 'File support',
                        description: 'Upload documents, images, and code files'
                      },
                      {
                        icon: <IconShield size={24} />,
                        title: 'Private & secure',
                        description: 'Your conversations are encrypted and private'
                      }
                    ].map((feature, index) => (
                      <div
                        key={index}
                        className="p-6 rounded-xl transition-colors"
                        style={{
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
                        }}
                      >
                        <div className="space-y-3 text-center">
                          <div className="inline-flex p-3 rounded-lg"
                               style={{
                                 backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                 color: isDark ? '#ffffff' : '#000000'
                               }}>
                            {feature.icon}
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-semibold"
                                style={{ color: isDark ? '#ffffff' : '#000000' }}>
                              {feature.title}
                            </h3>
                            <p className="text-sm"
                               style={{ color: isDark ? '#cccccc' : '#666666' }}>
                              {feature.description}
                            </p>
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
    </div>
  );
};

export default ChatInterface;
