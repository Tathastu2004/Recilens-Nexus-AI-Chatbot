import React, { useState, useEffect } from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';
import { debugAuth } from '../utils/authDebug';

const ChatInterface = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // ✅ Debug auth state on mount
  useEffect(() => {
    console.log('🔍 [CHAT INTERFACE] Debug auth state on mount:');
    const authState = debugAuth();
    
    // Check if user is properly authenticated
    if (!authState.hasToken || !authState.hasUser) {
      console.error('❌ [CHAT INTERFACE] Authentication incomplete:', authState);
      setAuthError('Please log in to access the chat interface.');
      setIsLoading(false);
      return;
    }

    if (!authState.user._id) {
      console.error('❌ [CHAT INTERFACE] User ID missing from stored user data');
      setAuthError('Invalid user data. Please log in again.');
      setIsLoading(false);
      return;
    }

    console.log('✅ [CHAT INTERFACE] Authentication verified:', {
      userId: authState.user._id,
      userName: authState.user.name,
      hasToken: authState.hasToken
    });
    
    setIsLoading(false);
  }, []);

  const handleSidebarToggle = (isOpen) => {
    console.log('🎯 [CHAT INTERFACE] Sidebar toggle:', isOpen);
    setSidebarOpen(isOpen);
  };

  const handleSessionSelect = (sessionId) => {
    console.log('🔄 [CHAT INTERFACE] Session selected:', sessionId);
    setSelectedSession(sessionId);
  };

  const handleSessionUpdate = (updatedSession) => {
    console.log('📝 [CHAT INTERFACE] Session updated:', updatedSession);
    // You can add additional logic here if needed
  };

  const handleNewChat = () => {
    console.log('🆕 [CHAT INTERFACE] Creating new chat from welcome screen...');
    // Generate a temporary session ID or trigger new session creation
    const tempSessionId = `new-${Date.now()}`;
    setSelectedSession(tempSessionId);
  };

  // ✅ Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <div className="text-gray-600">Loading chat interface...</div>
        </div>
      </div>
    );
  }

  // ✅ Show auth error
  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-8 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-600 text-6xl">🔒</div>
          <div className="text-xl font-semibold text-red-800">
            Authentication Required
          </div>
          <div className="text-red-600">
            {authError}
          </div>
          <button
            onClick={() => window.location.href = '/login'}
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
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out border-r border-gray-200 ${
          sidebarOpen ? 'w-[280px]' : 'w-[60px]'
        }`}
      >
        <SideBar
          onSelectSession={handleSessionSelect}
          onToggle={handleSidebarToggle}
          selectedSessionId={selectedSession} // Pass selected session ID
        />
      </div>

      {/* Chat Dashboard */}
      <div className="flex-grow transition-all duration-300 ease-in-out">
        {selectedSession ? (
          <ChatDashBoard
            selectedSession={selectedSession}
            onSessionUpdate={handleSessionUpdate}
            key={selectedSession} // ✅ Force re-render when session changes
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl">💬</div>
              <div className="text-xl font-semibold text-gray-700">
                Welcome to Nexus AI
              </div>
              <div className="text-gray-500 max-w-md">
                Select a chat from the sidebar or start a new conversation to begin chatting with our AI assistant.
              </div>
              <button
                onClick={handleNewChat}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Start New Chat
              </button>
              
              {/* ✅ Debug info in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-8 p-4 bg-gray-100 rounded-lg text-left text-xs">
                  <div className="font-semibold text-gray-700 mb-2">Debug Info:</div>
                  <div className="text-gray-600">
                    <div>Selected Session: {selectedSession || 'None'}</div>
                    <div>Sidebar Open: {sidebarOpen ? 'Yes' : 'No'}</div>
                    <div>User ID: {JSON.parse(localStorage.getItem("user") || '{}')._id || 'Not found'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
