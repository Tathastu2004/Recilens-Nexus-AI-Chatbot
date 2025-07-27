"use client";
import React, { useEffect, useState } from "react";

const ChatSessionList = ({ onSelect }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${backendUrl}/api/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Failed to load chats (${res.status})`);
      }

      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
      
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Failed to load chats');
      }
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [backendUrl]);

  // ✅ LISTEN FOR SESSION UPDATES
  useEffect(() => {
    const handleSessionUpdate = (event) => {
      console.log('🔄 [SESSION LIST] Session updated, refreshing list:', event.detail);
      fetchSessions();
    };

    window.addEventListener('sessionUpdated', handleSessionUpdate);
    return () => window.removeEventListener('sessionUpdated', handleSessionUpdate);
  }, []);

  const formatSessionTitle = (session) => {
    if (session.title && session.title !== 'New Chat') {
      return session.title.length > 30 ? `${session.title.substring(0, 30)}...` : session.title;
    }
    return `Chat ${new Date(session.createdAt).toLocaleDateString()}`;
  };

  const formatSessionTime = (session) => {
    const date = new Date(session.updatedAt || session.createdAt);
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
          <span className="ml-2 text-sm text-gray-500">Loading...</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
          <div className="font-medium">Error</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-gray-500 p-2 text-center">
          <div className="mb-1">No previous chats</div>
          <div className="text-xs">Start a conversation to begin</div>
        </div>
      ) : (
        <div className="space-y-1">
          {sessions.map((session) => (
            <div
              key={session._id}
              onClick={() => {
                console.log('📋 [SESSION LIST] Session clicked:', session._id);
                
                // ✅ VALIDATE SESSION ID BEFORE SELECTING
                if (session._id && typeof session._id === 'string' && session._id.length === 24) {
                  onSelect(session._id);
                } else {
                  console.error('❌ [SESSION LIST] Invalid session ID:', session._id);
                }
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
