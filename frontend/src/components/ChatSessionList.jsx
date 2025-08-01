"use client";
import React, { useEffect, useState, useCallback } from "react";
import { IconPlus, IconTrash, IconEdit, IconCheck, IconX } from "@tabler/icons-react";
import { useChat } from '../context/ChatContext';

const ChatSessionList = ({ onSelect }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");

  // ✅ CHAT CONTEXT INTEGRATION
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
    console.log('✅ [SESSION LIST] ChatContext available:', {
      hasContext: !!chatContext,
      currentSessionId: chatContext?.currentSessionId,
      totalSessions: chatContext?.debug?.totalSessions || 0
    });
  } catch (error) {
    console.log('⚠️ [SESSION LIST] ChatContext not available, using fallback mode:', error.message);
    chatContextAvailable = false;
  }

  const { 
    currentSessionId, 
    setSession, 
    isConnected,
    getSessionMessageCount,
    isSessionStreaming,
    debug 
  } = chatContext || {};

  // ✅ ENHANCED FETCH SESSIONS
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log('📤 [SESSION LIST] Fetching sessions...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased timeout

      const res = await fetch(`${backendUrl}/api/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Authentication expired. Please log in again.");
        } else if (res.status === 403) {
          throw new Error("Access denied. Please check your permissions.");
        } else {
          throw new Error(`Failed to load chats (${res.status})`);
        }
      }

      const data = await res.json();
      const sessionList = Array.isArray(data) ? data : [];
      
      console.log('✅ [SESSION LIST] Fetched', sessionList.length, 'sessions');
      setSessions(sessionList);
      
    } catch (err) {
      console.error('❌ [SESSION LIST] Fetch error:', err);
      
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection.');
      } else {
        setError(err.message || 'Failed to load chats');
      }
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, token]);

  // ✅ CREATE NEW SESSION
  const createNewSession = useCallback(async () => {
    if (loading) return;
    
    try {
      console.log('🆕 [SESSION LIST] Creating new session...');
      
      const response = await fetch(`${backendUrl}/api/chat/session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: 'New Chat'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session (${response.status})`);
      }

      const result = await response.json();
      
      if (result.success || result._id) {
        const newSession = result.session || result;
        console.log('✅ [SESSION LIST] New session created:', newSession._id);
        
        // ✅ ADD TO LIST IMMEDIATELY
        setSessions(prevSessions => {
          const exists = prevSessions.some(s => s._id === newSession._id);
          if (exists) return prevSessions;
          
          return [newSession, ...prevSessions].sort((a, b) => 
            new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
          );
        });
        
        // ✅ SET AS CURRENT SESSION
        if (chatContextAvailable && setSession) {
          setSession(newSession._id);
        }
        
        // ✅ NOTIFY PARENT
        if (onSelect) {
          onSelect(newSession._id);
        }
        
        // ✅ BROADCAST EVENT
        window.dispatchEvent(new CustomEvent('sessionCreated', {
          detail: { 
            session: newSession,
            sessionId: newSession._id,
            timestamp: new Date().toISOString()
          }
        }));
        
        return newSession;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ [SESSION LIST] Failed to create session:', error);
      
      // ✅ BROADCAST ERROR EVENT
      window.dispatchEvent(new CustomEvent('sessionCreationFailed', {
        detail: { error: error.message }
      }));
      
      setError(`Failed to create new chat: ${error.message}`);
      return null;
    }
  }, [backendUrl, token, loading, chatContextAvailable, setSession, onSelect]);

  // ✅ UPDATE SESSION TITLE
  const updateSessionTitle = useCallback(async (sessionId, newTitle) => {
    if (!sessionId || !newTitle.trim()) return false;
    
    try {
      console.log('📝 [SESSION LIST] Updating session title:', { sessionId, newTitle });
      
      const response = await fetch(`${backendUrl}/api/chat/session/${sessionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: newTitle.trim() })
      });

      if (!response.ok) {
        throw new Error(`Failed to update title (${response.status})`);
      }

      const result = await response.json();
      
      if (result.success) {
        // ✅ UPDATE LOCAL STATE
        setSessions(prevSessions => 
          prevSessions.map(session => 
            session._id === sessionId 
              ? { ...session, title: newTitle.trim(), updatedAt: new Date().toISOString() }
              : session
          )
        );
        
        // ✅ BROADCAST EVENT
        window.dispatchEvent(new CustomEvent('sessionTitleUpdated', {
          detail: { sessionId, title: newTitle.trim() }
        }));
        
        console.log('✅ [SESSION LIST] Title updated successfully');
        return true;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ [SESSION LIST] Failed to update title:', error);
      
      // ✅ BROADCAST ERROR EVENT
      window.dispatchEvent(new CustomEvent('sessionTitleUpdateFailed', {
        detail: { sessionId, error: error.message }
      }));
      
      return false;
    }
  }, [backendUrl, token]);

  // ✅ DELETE SESSION
  const deleteSession = useCallback(async (sessionId) => {
    if (!sessionId) return false;
    
    try {
      setDeletingSessionId(sessionId);
      console.log('🗑️ [SESSION LIST] Deleting session:', sessionId);
      
      const response = await fetch(`${backendUrl}/api/chat/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session (${response.status})`);
      }

      const result = await response.json();
      
      if (result.success) {
        // ✅ REMOVE FROM LOCAL STATE
        setSessions(prevSessions => 
          prevSessions.filter(session => session._id !== sessionId)
        );
        
        // ✅ CLEAR SESSION IF IT'S CURRENT
        if (sessionId === currentSessionId) {
          if (chatContextAvailable && setSession) {
            setSession(null);
          }
          if (onSelect) {
            onSelect(null);
          }
        }
        
        // ✅ BROADCAST EVENT
        window.dispatchEvent(new CustomEvent('sessionDeleted', {
          detail: { sessionId }
        }));
        
        console.log('✅ [SESSION LIST] Session deleted successfully');
        return true;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ [SESSION LIST] Failed to delete session:', error);
      setError(`Failed to delete chat: ${error.message}`);
      return false;
    } finally {
      setDeletingSessionId(null);
    }
  }, [backendUrl, token, currentSessionId, chatContextAvailable, setSession, onSelect]);

  // ✅ INITIAL LOAD
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ✅ EVENT LISTENERS FOR GLOBAL UPDATES
  useEffect(() => {
    // ✅ SESSION UPDATE HANDLER
    const handleSessionUpdate = (event) => {
      console.log('🔄 [SESSION LIST] Session updated, refreshing list:', event.detail);
      fetchSessions();
    };

    // ✅ NEW SESSION CREATED HANDLER
    const handleSessionCreated = (event) => {
      const { session } = event.detail;
      console.log('🆕 [SESSION LIST] External session created:', session._id);
      
      setSessions(prevSessions => {
        const exists = prevSessions.some(s => s._id === session._id);
        if (exists) {
          console.log('⚠️ [SESSION LIST] Session already exists in list');
          return prevSessions;
        }
        
        const newSessions = [session, ...prevSessions];
        return newSessions.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
      });
    };

    // ✅ TITLE UPDATE HANDLER
    const handleTitleUpdate = (event) => {
      const { sessionId, title } = event.detail;
      console.log('📝 [SESSION LIST] External title update:', { sessionId, title });
      
      setSessions(prevSessions => 
        prevSessions.map(session => 
          session._id === sessionId 
            ? { ...session, title, updatedAt: new Date().toISOString() }
            : session
        )
      );
    };

    // ✅ TITLE UPDATE FAILURE HANDLER
    const handleTitleUpdateFailed = (event) => {
      const { sessionId, error } = event.detail;
      console.error('❌ [SESSION LIST] External title update failed:', { sessionId, error });
      fetchSessions(); // Refresh from server
    };

    // ✅ SESSION DELETION HANDLER
    const handleSessionDeleted = (event) => {
      const { sessionId } = event.detail;
      console.log('🗑️ [SESSION LIST] External session deleted:', sessionId);
      
      setSessions(prevSessions => 
        prevSessions.filter(session => session._id !== sessionId)
      );
    };

    // ✅ SESSION CREATION ERROR HANDLER
    const handleSessionCreationFailed = (event) => {
      const { error } = event.detail;
      console.error('❌ [SESSION LIST] External session creation failed:', error);
      setError(`Failed to create session: ${error}`);
    };

    // ✅ ADD ALL EVENT LISTENERS
    const events = [
      ['sessionUpdated', handleSessionUpdate],
      ['sessionCreated', handleSessionCreated],
      ['newSessionCreated', handleSessionCreated], // Backward compatibility
      ['sessionTitleUpdated', handleTitleUpdate],
      ['sessionTitleUpdateFailed', handleTitleUpdateFailed],
      ['sessionDeleted', handleSessionDeleted],
      ['sessionCreationFailed', handleSessionCreationFailed]
    ];

    events.forEach(([event, handler]) => {
      window.addEventListener(event, handler);
    });
    
    return () => {
      events.forEach(([event, handler]) => {
        window.removeEventListener(event, handler);
      });
    };
  }, [fetchSessions]);

  // ✅ ENHANCED FORMATTING FUNCTIONS
  const formatSessionTitle = useCallback((session) => {
    if (session.title && session.title !== 'New Chat') {
      return session.title.length > 30 ? `${session.title.substring(0, 30)}...` : session.title;
    }
    return `Chat ${new Date(session.createdAt).toLocaleDateString()}`;
  }, []);

  const formatSessionTime = useCallback((session) => {
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
  }, []);

  // ✅ EDIT HANDLERS
  const startEditing = useCallback((sessionId, currentTitle) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSessionId(null);
    setEditingTitle("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (editingSessionId && editingTitle.trim()) {
      const success = await updateSessionTitle(editingSessionId, editingTitle.trim());
      if (success) {
        setEditingSessionId(null);
        setEditingTitle("");
      }
    }
  }, [editingSessionId, editingTitle, updateSessionTitle]);

  // ✅ SESSION SELECTION HANDLER
  const handleSessionSelect = useCallback((sessionId) => {
    console.log('📋 [SESSION LIST] Session selected:', sessionId);
    
    // ✅ VALIDATE SESSION ID
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length !== 24) {
      console.error('❌ [SESSION LIST] Invalid session ID:', sessionId);
      return;
    }

    // ✅ SET IN CONTEXT
    if (chatContextAvailable && setSession) {
      setSession(sessionId);
    }
    
    // ✅ NOTIFY PARENT
    if (onSelect) {
      onSelect(sessionId);
    }
  }, [chatContextAvailable, setSession, onSelect]);

  // ✅ MAIN RENDER
  return (
    <div className="space-y-2">
      {/* ✅ ENHANCED HEADER WITH CREATE BUTTON */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Chat Sessions</h3>
        <div className="flex items-center gap-2">
          {chatContextAvailable && (
            <div className={`text-xs px-2 py-1 rounded-full ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isConnected ? '🟢' : '🔴'}
            </div>
          )}
          <button
            onClick={createNewSession}
            disabled={loading}
            className="p-1 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"
            title="Create new chat"
          >
            <IconPlus size={16} className="text-blue-600" />
          </button>
        </div>
      </div>

      {/* ✅ ENHANCED LOADING STATE */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-500">Loading sessions...</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 p-3 bg-red-50 rounded-md border border-red-200">
          <div className="font-medium flex items-center gap-2">
            ⚠️ Error
          </div>
          <div className="text-xs mt-1">{error}</div>
          <button
            onClick={fetchSessions}
            className="text-xs mt-2 px-2 py-1 bg-red-100 hover:bg-red-200 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-gray-500 p-4 text-center">
          <div className="mb-2">📱 No chat sessions yet</div>
          <div className="text-xs mb-3">Start a conversation to begin</div>
          <button
            onClick={createNewSession}
            className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
          >
            Create New Chat
          </button>
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {sessions.map((session) => {
            const isCurrentSession = session._id === currentSessionId;
            const isStreaming = chatContextAvailable ? isSessionStreaming?.(session._id) : false;
            const messageCount = chatContextAvailable ? getSessionMessageCount?.(session._id) : 0;
            const isEditing = editingSessionId === session._id;
            const isDeleting = deletingSessionId === session._id;

            return (
              <div
                key={session._id}
                className={`group relative px-3 py-2 text-sm rounded-md cursor-pointer border transition-all duration-150 ${
                  isCurrentSession
                    ? 'bg-blue-100 border-blue-300 text-blue-900'
                    : 'hover:bg-gray-50 border-transparent hover:border-gray-200'
                } ${isStreaming ? 'ring-2 ring-purple-200 animate-pulse' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div 
                    className="flex-1 min-w-0"
                    onClick={() => !isEditing && !isDeleting && handleSessionSelect(session._id)}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 text-xs p-1 border rounded focus:outline-none focus:border-blue-500"
                          placeholder="Session title..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <IconCheck size={12} />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-800 truncate flex items-center gap-2">
                          {formatSessionTitle(session)}
                          {isStreaming && (
                            <span className="text-xs text-purple-600 animate-pulse">🌊</span>
                          )}
                          {isCurrentSession && (
                            <span className="text-xs text-blue-600">●</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                          <span>{formatSessionTime(session)}</span>
                          {chatContextAvailable && messageCount > 0 && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              {messageCount} msgs
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ✅ ACTION BUTTONS */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(session._id, session.title);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit title"
                      >
                        <IconEdit size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this chat session?')) {
                            deleteSession(session._id);
                          }
                        }}
                        disabled={isDeleting}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete session"
                      >
                        {isDeleting ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                        ) : (
                          <IconTrash size={12} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ✅ DEBUG INFO (DEV MODE) */}
      {debug && process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border-t">
          🐛 Debug: {sessions.length} sessions loaded, current: {currentSessionId || 'none'}
          <br />
          Context: {debug.totalSessions} sessions, {debug.totalMessages} messages
        </div>
      )}
    </div>
  );
};

export default ChatSessionList;
