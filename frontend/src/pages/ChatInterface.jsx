import React, { useState } from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';

const ChatInterface = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSidebarToggle = (isOpen) => {
    setSidebarOpen(isOpen);
  };

  const handleSessionSelect = (sessionId) => {
    console.log('🔄 [ChatInterface] Session selected:', sessionId);
    setSelectedSession(sessionId);
  };

  const handleSessionUpdate = (updatedSession) => {
    console.log('📝 [ChatInterface] Session updated:', updatedSession);
  };

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
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl">💬</div>
              <div className="text-xl font-semibold text-gray-700">
                Welcome to Nexus AI
              </div>
              <div className="text-gray-500">
                Select a chat from the sidebar or start a new conversation
              </div>
              <button
                onClick={() => {
                  console.log('Creating new chat from welcome screen...');
                  setSelectedSession('new');
                }}
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
