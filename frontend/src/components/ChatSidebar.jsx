import { useEffect, useState } from 'react';
import axios from 'axios';
import { IconMessagePlus, IconDots } from '@tabler/icons-react';

const ChatSidebar = ({ user, onSelectSession }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        // Fixed: Use full backend URL instead of relative path
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

        // Ensure data is an array
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
    if (session.title) {
      return session.title.length > 25 
        ? `${session.title.substring(0, 25)}...` 
        : session.title;
    }
    // Fallback if no title
    return `Chat ${new Date(session.createdAt || Date.now()).toLocaleDateString()}`;
  };

  // Format session timestamp
  const formatSessionTime = (session) => {
    const date = new Date(session.updatedAt || session.createdAt || Date.now());
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleNewChat = () => {
    // Reset to a new chat session
    onSelectSession(null);
    console.log('🆕 [ChatSidebar] Starting new chat');
  };

  return (
    <div className="w-64 bg-gray-50 h-screen overflow-y-auto border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">💬 Chats</h2>
          <button
            onClick={handleNewChat}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title="New Chat"
          >
            <IconMessagePlus className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Chat Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-500">Loading chats...</span>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
              <div className="font-medium">Failed to load chats</div>
              <div className="text-xs mt-1">{error}</div>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-500 text-sm">
              <div className="mb-2">No previous chats</div>
              <div className="text-xs">Click the + button to start a new conversation</div>
            </div>
          </div>
        ) : (
          <ul className="p-2 space-y-1">
            {sessions.map((session) => (
              <li
                key={session._id}
                onClick={() => {
                  console.log('🖱️ [ChatSidebar] Selected Session:', {
                    id: session._id,
                    title: session.title,
                    session: session
                  });
                  onSelectSession(session);
                }}
                className="group p-3 cursor-pointer hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-all duration-150"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">
                      {formatSessionTitle(session)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatSessionTime(session)}
                    </div>
                  </div>
                  
                  {/* Optional: Menu button for each session */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Session menu clicked for:', session._id);
                      // Add menu functionality here (delete, rename, etc.)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                    title="Session options"
                  >
                    <IconDots className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="text-xs text-gray-500 text-center">
          {sessions.length} chat{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
