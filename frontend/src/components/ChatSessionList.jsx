"use client";
import React, { useEffect, useState } from "react";

const ChatSessionList = ({ onSelect }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define backend URL consistently
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // Fetch chat sessions from backend
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem("token");
        
        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("📤 [ChatSessionList] Fetching sessions from:", `${backendUrl}/api/chat/sessions`);

        // Fixed: Use full backend URL instead of relative path
        const res = await fetch(`${backendUrl}/api/chat/sessions`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("📥 [ChatSessionList] Response status:", res.status);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log("📦 [ChatSessionList] Fetched sessions:", {
          count: data.length,
          sessions: data
        });

        // Ensure data is an array
        if (Array.isArray(data)) {
          setSessions(data);
        } else {
          console.warn("⚠️ [ChatSessionList] Response is not an array:", data);
          setSessions([]);
        }
        
      } catch (err) {
        console.error("❌ [ChatSessionList] Failed to fetch sessions:", {
          error: err.message,
          stack: err.stack
        });
        setError(err.message);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [backendUrl]);

  // Format session title for display
  const formatSessionTitle = (session) => {
    if (session.title) {
      return session.title.length > 30 
        ? `${session.title.substring(0, 30)}...` 
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
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-500">Loading chats...</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
          <div className="font-medium">Failed to load chats</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-gray-500 p-2 text-center">
          <div className="mb-1">No previous chats</div>
          <div className="text-xs">Start a new conversation to begin</div>
        </div>
      ) : (
        <div className="space-y-1">
          {sessions.map((session) => (
            <div
              key={session._id}
              onClick={() => {
                console.log("🖱️ [ChatSessionList] Selected Session:", {
                  id: session._id,
                  title: session.title,
                  session: session
                });
                onSelect(session);
              }}
              className="px-3 py-2 text-sm hover:bg-blue-50 rounded-md cursor-pointer border border-transparent hover:border-blue-200 transition-all duration-150"
            >
              <div className="flex flex-col">
                <div className="font-medium text-gray-800 truncate">
                  {formatSessionTitle(session)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatSessionTime(session)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatSessionList;
