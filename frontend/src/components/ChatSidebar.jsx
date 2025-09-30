import { useEffect, useState } from 'react';
import axios from 'axios';
import { IconMessagePlus, IconDots, IconMessage, IconRobot, IconPlus } from '@tabler/icons-react';
import { useTheme } from '../context/ThemeContext'; // Assuming you have this

const ChatSidebar = ({ user, onSelectSession, selectedSessionId, isDark }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Define backend URL consistently
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token') || user?.token;
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        console.log('📤 [ChatSidebar] Fetching sessions from:', `${backendUrl}/api/chat/sessions`);

        const res = await axios.get(`${backendUrl}/api/chat/sessions`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('📥 [ChatSidebar] Response received:', {
          status: res.status,
          dataType: typeof res.data,
          isArray: Array.isArray(res.data),
          count: res.data?.length
        });

        if (Array.isArray(res.data)) {
          setSessions(res.data);
        } else {
          console.warn('⚠️ [ChatSidebar] Response is not an array:', res.data);
          setSessions([]);
        }

      } catch (err) {
        console.error('❌ [ChatSidebar] Failed to fetch sessions:', {
          error: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        setError(err.message);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [backendUrl, user]);

  // Format session title for display
  const formatSessionTitle = (session) => {
    if (session.title && session.title !== 'New Chat') {
      return session.title.length > (isCollapsed ? 15 : 25) 
        ? `${session.title.substring(0, isCollapsed ? 15 : 25)}...` 
        : session.title;
    }
    return 'New Chat';
  };

  // Format session timestamp
  const formatSessionTime = (session) => {
    const date = new Date(session.updatedAt || session.createdAt || Date.now());
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleNewChat = () => {
    onSelectSession(null);
    console.log('🆕 [ChatSidebar] Starting new chat');
  };

  const handleSessionSelect = (session) => {
    console.log('🖱️ [ChatSidebar] Selected Session:', {
      id: session._id,
      title: session.title,
      session: session
    });
    onSelectSession(session);
  };

  return (
    <div 
      className={`h-screen overflow-hidden flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64 sm:w-72 lg:w-80'
      }`}
      style={{
        backgroundColor: isDark ? '#171717' : '#ffffff',
        borderRight: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`
      }}
    >
      {/* Header */}
      <div 
        className="p-3 sm:p-4 transition-all duration-300"
        style={{ 
          borderBottom: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
          backgroundColor: isDark ? 'rgba(47, 47, 47, 0.5)' : 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Collapse Toggle Button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 md:hidden lg:flex"
              style={{
                backgroundColor: isDark ? '#2f2f2f' : '#f5f5f5',
                color: isDark ? '#ffffff' : '#000000'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = isDark ? '#4a4a4a' : '#e5e5e5';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = isDark ? '#2f2f2f' : '#f5f5f5';
              }}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              >
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>

            {/* Logo and Title */}
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: isDark ? '#10a37f' : '#000000' }}
              >
                <IconMessage size={14} className="text-white" />
              </div>
              {!isCollapsed && (
                <h2 
                  className="text-base sm:text-lg font-bold transition-opacity duration-300"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Chats
                </h2>
              )}
            </div>
          </div>
          
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="p-2 rounded-xl transition-all duration-200 hover:scale-110 group"
            style={{
              backgroundColor: isDark ? '#10a37f' : '#000000',
              color: '#ffffff',
              boxShadow: isDark ? '0 4px 12px rgba(16, 163, 127, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}
            title="New Chat"
          >
            <IconPlus 
              size={14} 
              className="group-hover:rotate-90 transition-transform duration-200" 
            />
          </button>
        </div>
        
        {/* Stats */}
        {!isCollapsed && (
          <div 
            className="text-xs flex items-center gap-2"
            style={{ color: isDark ? '#d1d5db' : '#6b7280' }}
          >
            <IconRobot size={12} />
            <span>{sessions.length} conversations</span>
          </div>
        )}
      </div>

      {/* Chat Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="relative mb-4">
              <div 
                className="w-8 h-8 rounded-full animate-spin"
                style={{ 
                  border: `2px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
                  borderTopColor: isDark ? '#10a37f' : '#000000'
                }}
              ></div>
            </div>
            {!isCollapsed && (
              <span 
                className="text-sm font-medium"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Loading conversations...
              </span>
            )}
          </div>
        ) : error ? (
          <div className="p-3 sm:p-4">
            <div 
              className="text-sm p-3 rounded-xl"
              style={{ 
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid #ef4444`,
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <div className="font-medium flex items-center gap-2">
                <span>⚠️</span>
                {!isCollapsed && <span>Failed to load chats</span>}
              </div>
              {!isCollapsed && (
                <div className="text-xs mt-1 opacity-90">{error}</div>
              )}
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="relative mb-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: isDark ? '#10a37f' : '#000000' }}
              >
                <IconRobot size={20} className="text-white" />
              </div>
            </div>
            {!isCollapsed && (
              <>
                <h3 
                  className="text-sm font-bold mb-2"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  No conversations yet
                </h3>
                <p 
                  className="text-xs leading-relaxed"
                  style={{ color: isDark ? '#d1d5db' : '#6b7280' }}
                >
                  Click the + button to start your first AI conversation
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => {
              const isSelected = selectedSessionId === session._id;
              
              return (
                <div
                  key={session._id}
                  onClick={() => handleSessionSelect(session)}
                  className={`group cursor-pointer p-2.5 sm:p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${
                    isSelected ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? isDark ? 'rgba(16, 163, 127, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                      : 'transparent',
                    border: `1px solid ${
                      isSelected 
                        ? isDark ? '#10a37f' : '#000000'
                        : isDark ? '#4a4a4a' : '#e5e5e5'
                    }`,
                    ringColor: isSelected 
                      ? isDark ? '#10a37f' : '#000000' 
                      : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.target.style.backgroundColor = isDark ? 'rgba(47, 47, 47, 0.5)' : 'rgba(245, 245, 245, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.target.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {/* Status Indicator */}
                      <div 
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ 
                          backgroundColor: isSelected 
                            ? isDark ? '#10a37f' : '#000000'
                            : isDark ? '#4a4a4a' : '#d1d5db'
                        }}
                      ></div>
                      
                      <div className="flex-1 min-w-0">
                        <div 
                          className="font-medium text-sm truncate transition-colors"
                          style={{ 
                            color: isSelected 
                              ? isDark ? '#10a37f' : '#000000'
                              : isDark ? '#ffffff' : '#000000'
                          }}
                        >
                          {formatSessionTitle(session)}
                        </div>
                        {!isCollapsed && (
                          <div 
                            className="text-xs mt-1"
                            style={{ color: isDark ? '#d1d5db' : '#6b7280' }}
                          >
                            {formatSessionTime(session)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Menu Button */}
                    {!isCollapsed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Session menu clicked for:', session._id);
                          // Add menu functionality here (delete, rename, etc.)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:scale-110"
                        style={{ 
                          color: isDark ? '#d1d5db' : '#6b7280',
                          backgroundColor: isDark ? 'rgba(209, 213, 219, 0.1)' : 'rgba(107, 114, 128, 0.1)'
                        }}
                        title="Session options"
                      >
                        <IconDots size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div 
        className="p-3 transition-all duration-300"
        style={{ 
          borderTop: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
          backgroundColor: isDark ? 'rgba(47, 47, 47, 0.3)' : 'rgba(245, 245, 245, 0.5)'
        }}
      >
        {!isCollapsed && (
          <div 
            className="text-xs text-center"
            style={{ color: isDark ? '#d1d5db' : '#6b7280' }}
          >
            {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
