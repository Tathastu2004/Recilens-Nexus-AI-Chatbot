"use client";
import React, { useEffect, useState, useCallback } from "react";
import { IconPlus, IconTrash, IconEdit, IconCheck, IconX, IconRobot, IconMessage, IconBolt } from "@tabler/icons-react";
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';

const ChatSessionList = ({ onSelect }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");

  // ✅ THEME CONTEXT
  const { isDark } = useTheme();

  // ✅ CHAT CONTEXT INTEGRATION
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
  } catch (error) {
    chatContextAvailable = false;
  }

  const { 
    currentSessionId, 
    setSession, 
    isConnected,
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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
      
      setSessions(sessionList);
      
    } catch (err) {
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
        
        setSessions(prevSessions => {
          const exists = prevSessions.some(s => s._id === newSession._id);
          if (exists) return prevSessions;
          
          return [newSession, ...prevSessions].sort((a, b) => 
            new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
          );
        });
        
        if (chatContextAvailable && setSession) {
          setSession(newSession._id);
        }
        
        if (onSelect) {
          onSelect(newSession._id);
        }
        
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
        setSessions(prevSessions => 
          prevSessions.map(session => 
            session._id === sessionId 
              ? { ...session, title: newTitle.trim(), updatedAt: new Date().toISOString() }
              : session
          )
        );
        
        window.dispatchEvent(new CustomEvent('sessionTitleUpdated', {
          detail: { sessionId, title: newTitle.trim() }
        }));
        
        return true;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
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
        setSessions(prevSessions => 
          prevSessions.filter(session => session._id !== sessionId)
        );
        
        if (sessionId === currentSessionId) {
          if (chatContextAvailable && setSession) {
            setSession(null);
          }
          if (onSelect) {
            onSelect(null);
          }
        }
        
        window.dispatchEvent(new CustomEvent('sessionDeleted', {
          detail: { sessionId }
        }));
        
        return true;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
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
    const handleSessionUpdate = (event) => {
      fetchSessions();
    };

    const handleSessionCreated = (event) => {
      const { session } = event.detail;
      
      setSessions(prevSessions => {
        const exists = prevSessions.some(s => s._id === session._id);
        if (exists) {
          return prevSessions;
        }
        
        const newSessions = [session, ...prevSessions];
        return newSessions.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
      });
    };

    const handleTitleUpdate = (event) => {
      const { sessionId, title } = event.detail;
      
      setSessions(prevSessions => 
        prevSessions.map(session => 
          session._id === sessionId 
            ? { ...session, title, updatedAt: new Date().toISOString() }
            : session
        )
      );
    };

    const handleTitleUpdateFailed = (event) => {
      fetchSessions();
    };

    const handleSessionDeleted = (event) => {
      const { sessionId } = event.detail;
      
      setSessions(prevSessions => 
        prevSessions.filter(session => session._id !== sessionId)
      );
    };

    const handleSessionCreationFailed = (event) => {
      const { error } = event.detail;
      setError(`Failed to create session: ${error}`);
    };

    const events = [
      ['sessionUpdated', handleSessionUpdate],
      ['sessionCreated', handleSessionCreated],
      ['newSessionCreated', handleSessionCreated],
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

  // ✅ FORMATTING FUNCTIONS - SIMPLIFIED (NO TIME/DATE)
  const formatSessionTitle = useCallback((session) => {
    if (session.title && session.title !== 'New Chat') {
      return session.title.length > 30 ? `${session.title.substring(0, 30)}...` : session.title;
    }
    return 'New Chat';
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
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length !== 24) {
      return;
    }

    if (chatContextAvailable && setSession) {
      setSession(sessionId);
    }
    
    if (onSelect) {
      onSelect(sessionId);
    }
  }, [chatContextAvailable, setSession, onSelect]);

  // ✅ AI-THEMED DARK SIDEBAR RENDER
  return (
    <div className={`h-full flex flex-col transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-b from-gray-800 via-gray-900 to-black' 
        : 'bg-gradient-to-b from-gray-100 via-gray-200 to-gray-300'
    }`}>
      
      {/* ✅ AI-STYLED HEADER */}
      <div className={`p-4 border-b transition-all duration-300 ${
        isDark 
          ? 'border-gray-700/50 bg-gray-800/50 backdrop-blur-sm' 
          : 'border-gray-300/50 bg-white/50 backdrop-blur-sm'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
              <IconMessage size={14} className="text-white" />
            </div>
            <h2 className={`text-sm font-bold transition-colors ${
              isDark 
                ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
            }`}>
              Chat Sessions
            </h2>
          </div>
          
          {/* ✅ CONNECTION STATUS & CREATE BUTTON */}
          <div className="flex items-center gap-2">
            {chatContextAvailable && (
              <div className={`text-xs px-2 py-1 rounded-full font-medium transition-all ${
                isConnected 
                  ? isDark 
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : isDark 
                    ? 'bg-red-900/30 text-red-400 border border-red-500/30' 
                    : 'bg-red-100 text-red-700 border border-red-200'
              }`}>
                {isConnected ? '⚡ Live' : '🔄 Sync'}
              </div>
            )}
            
            <button
              onClick={createNewSession}
              disabled={loading}
              className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-50 group ${
                isDark 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg'
              } transform hover:scale-105`}
              title="Create new chat"
            >
              <IconPlus size={14} className="group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>
        </div>
        
        {/* ✅ SESSIONS COUNT - SIMPLIFIED */}
        <div className={`text-xs flex items-center gap-2 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <IconRobot size={12} />
          <span>{sessions.length} conversations</span>
        </div>
      </div>

      {/* ✅ SESSIONS LIST */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="relative mb-4">
              <div className={`w-8 h-8 rounded-full animate-spin ${
                isDark 
                  ? 'border-2 border-gray-700 border-t-blue-400' 
                  : 'border-2 border-gray-300 border-t-blue-500'
              }`}></div>
              <div className="absolute inset-0 w-8 h-8 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full animate-ping opacity-20"></div>
            </div>
            <span className={`text-sm font-medium ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>Loading conversations...</span>
            <span className={`text-xs mt-1 ${
              isDark ? 'text-gray-500' : 'text-gray-500'
            }`}>Syncing with AI brain</span>
          </div>
        ) : error ? (
          <div className={`m-4 p-4 rounded-xl border transition-all ${
            isDark 
              ? 'bg-red-900/20 border-red-500/30 text-red-400' 
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <div className="font-medium flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <span>Connection Error</span>
            </div>
            <div className="text-xs opacity-90 mb-3">{error}</div>
            <button
              onClick={fetchSessions}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isDark 
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300' 
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
              }`}
            >
              Retry Connection
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl">
                <IconRobot size={28} className="text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                <IconBolt size={12} className="text-white" />
              </div>
            </div>
            <h3 className={`text-base font-bold mb-2 ${
              isDark 
                ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
            }`}>
              Ready to Chat!
            </h3>
            <p className={`text-sm mb-4 leading-relaxed ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              No conversations yet. Start your first AI chat session and explore the possibilities.
            </p>
            <button
              onClick={createNewSession}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                isDark 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
              } shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              Start New Chat
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto px-3 py-2 space-y-1">
            {sessions.map((session, index) => {
              const isCurrentSession = session._id === currentSessionId;
              const isStreaming = chatContextAvailable ? isSessionStreaming?.(session._id) : false;
              const isEditing = editingSessionId === session._id;
              const isDeleting = deletingSessionId === session._id;

              return (
                <div
                  key={session._id}
                  className={`group relative rounded-xl transition-all duration-200 border ${
                    isCurrentSession
                      ? isDark 
                        ? 'bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-500/50 shadow-lg shadow-blue-500/20' 
                        : 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-300 shadow-md'
                      : isDark 
                        ? 'hover:bg-gray-700/30 border-gray-700/50 hover:border-gray-600/50' 
                        : 'hover:bg-white/70 border-gray-200 hover:border-gray-300'
                  } ${isStreaming ? 'animate-pulse ring-2 ring-purple-500/30' : ''}`}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => !isEditing && !isDeleting && handleSessionSelect(session._id)}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className={`flex-1 text-sm p-2 border rounded-lg focus:outline-none transition-colors ${
                                isDark 
                                  ? 'bg-gray-800 border-gray-600 text-gray-200 focus:border-blue-400' 
                                  : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'
                              }`}
                              placeholder="Session title..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDark 
                                  ? 'text-emerald-400 hover:bg-emerald-500/20' 
                                  : 'text-emerald-600 hover:bg-emerald-100'
                              }`}
                            >
                              <IconCheck size={14} />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDark 
                                  ? 'text-red-400 hover:bg-red-500/20' 
                                  : 'text-red-600 hover:bg-red-100'
                              }`}
                            >
                              <IconX size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              isCurrentSession 
                                ? 'bg-gradient-to-r from-blue-400 to-purple-400 shadow-lg' 
                                : isDark 
                                  ? 'bg-gray-600' 
                                  : 'bg-gray-400'
                            }`}></div>
                            <span className={`font-medium text-sm truncate transition-colors ${
                              isCurrentSession 
                                ? isDark 
                                  ? 'text-blue-300' 
                                  : 'text-blue-700'
                                : isDark 
                                  ? 'text-gray-200' 
                                  : 'text-gray-800'
                            }`}>
                              {formatSessionTitle(session)}
                            </span>
                            {isStreaming && (
                              <div className="flex items-center gap-1 ml-auto">
                                <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse"></div>
                                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                              </div>
                            )}
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
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDark 
                                ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/20' 
                                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-100'
                            }`}
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
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              isDark 
                                ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20' 
                                : 'text-gray-500 hover:text-red-600 hover:bg-red-100'
                            }`}
                            title="Delete session"
                          >
                            {isDeleting ? (
                              <div className={`animate-spin rounded-full h-3 w-3 border ${
                                isDark ? 'border-red-400 border-t-transparent' : 'border-red-600 border-t-transparent'
                              }`}></div>
                            ) : (
                              <IconTrash size={12} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ AI-THEMED FOOTER */}
      {debug && process.env.NODE_ENV === 'development' && (
        <div className={`p-3 border-t text-xs transition-all ${
          isDark 
            ? 'border-gray-700/50 bg-gray-800/30 text-gray-500' 
            : 'border-gray-300/50 bg-gray-100/50 text-gray-600'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <IconBolt size={12} />
            <span className="font-medium">Debug Mode</span>
          </div>
          <div className="space-y-0.5">
            <div>Sessions: {sessions.length} loaded, current: {currentSessionId ? '✓' : '✗'}</div>
            <div>Context: {debug.totalSessions} sessions, {debug.totalMessages} messages</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSessionList;
