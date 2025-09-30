"use client";
import React, { useEffect, useState, useCallback } from "react";
import { IconPlus, IconTrash, IconEdit, IconCheck, IconX, IconRobot, IconMessage, IconBolt, IconExclamationTriangle } from "@tabler/icons-react";
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';

// ✅ CUSTOM DELETE CONFIRMATION DIALOG COMPONENT
const DeleteConfirmationDialog = ({ isOpen, onConfirm, onCancel, isDark, sessionTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm transition-opacity"
        style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' }}
        onClick={onCancel}
      ></div>
      
      {/* Dialog */}
      <div className="relative w-full max-w-md mx-auto rounded-2xl shadow-2xl transition-all transform scale-100"
           style={{ 
             backgroundColor: isDark ? '#2f2f2f' : '#ffffff',
             border: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`
           }}>
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full"
               style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }}>
            <IconExclamationTriangle size={24} style={{ color: '#ef4444' }} />
          </div>
          
          {/* Title */}
          <h3 className="text-lg font-semibold text-center mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Delete Chat Session
          </h3>
          
          {/* Message */}
          <p className="text-sm text-center mb-6 leading-relaxed"
             style={{ color: isDark ? '#d1d5db' : '#6b7280' }}>
            Are you sure you want to delete "{sessionTitle}"? This action cannot be undone.
          </p>
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{ 
                backgroundColor: isDark ? '#4a4a4a' : '#f5f5f5',
                color: isDark ? '#d1d5db' : '#374151',
                border: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatSessionList = ({ onSelect }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  
  // ✅ DELETE DIALOG STATE
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    sessionId: null,
    sessionTitle: ''
  });
  
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
          title: 'New Chat',
          autoUpdateTitle: true
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

  // ✅ DELETE DIALOG HANDLERS
  const openDeleteDialog = useCallback((sessionId, sessionTitle) => {
    setDeleteDialog({
      isOpen: true,
      sessionId,
      sessionTitle: sessionTitle || 'New Chat'
    });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({
      isOpen: false,
      sessionId: null,
      sessionTitle: ''
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteDialog.sessionId) {
      await deleteSession(deleteDialog.sessionId);
      closeDeleteDialog();
    }
  }, [deleteDialog.sessionId, deleteSession, closeDeleteDialog]);

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

  // ✅ FORMATTING FUNCTIONS
  const formatSessionTitle = useCallback((session) => {
    if (session.title && session.title !== 'New Chat') {
      return session.title.length > 25 ? `${session.title.substring(0, 25)}...` : session.title;
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

  // ✅ RENDER
  return (
    <>
      <div className="h-full flex flex-col transition-all duration-300"
           style={{ backgroundColor: isDark ? '#171717' : '#ffffff' }}>
        
        {/* Header */}
        <div className="p-3 sm:p-4 transition-all duration-300"
             style={{ 
               borderBottom: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
               backgroundColor: isDark ? 'rgba(47, 47, 47, 0.5)' : 'rgba(255, 255, 255, 0.5)',
               backdropFilter: 'blur(10px)'
             }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center"
                   style={{ backgroundColor: isDark ? '#10a37f' : '#000000' }}>
                <IconMessage size={12} className="text-white" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Chat Sessions
              </h2>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              {chatContextAvailable && (
                <div className="text-xs px-2 py-1 rounded-full font-medium transition-all hidden sm:block"
                     style={{
                       backgroundColor: isConnected 
                         ? isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'
                         : isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                       color: isConnected ? '#22c55e' : '#ef4444',
                       border: `1px solid ${isConnected ? '#22c55e' : '#ef4444'}`
                     }}>
                  {isConnected ? '⚡ Live' : '🔄 Sync'}
                </div>
              )}
              
              <button
                onClick={createNewSession}
                disabled={loading}
                className="p-2 rounded-xl transition-all duration-200 disabled:opacity-50 group transform hover:scale-105"
                style={{
                  backgroundColor: isDark ? '#10a37f' : '#000000',
                  color: '#ffffff',
                  boxShadow: isDark ? '0 4px 12px rgba(16, 163, 127, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
                title="Create new chat"
              >
                <IconPlus size={14} className="group-hover:rotate-90 transition-transform duration-200" />
              </button>
            </div>
          </div>
          
          <div className="text-xs flex items-center gap-2"
               style={{ color: isDark ? '#d1d5db' : '#6b7280' }}>
            <IconRobot size={12} />
            <span>{sessions.length} conversations</span>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <div className="relative mb-4">
                <div className="w-8 h-8 rounded-full animate-spin"
                     style={{ 
                       border: `2px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
                       borderTopColor: isDark ? '#10a37f' : '#000000'
                     }}></div>
                <div className="absolute inset-0 w-8 h-8 rounded-full animate-ping opacity-20"
                     style={{ backgroundColor: isDark ? '#10a37f' : '#000000' }}></div>
              </div>
              <span className="text-sm font-medium"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Loading conversations...
              </span>
            </div>
          ) : error ? (
            <div className="m-3 sm:m-4 p-4 rounded-xl transition-all"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                   border: `1px solid #ef4444`,
                   color: isDark ? '#ffffff' : '#000000'
                 }}>
              <div className="font-medium flex items-center gap-2 mb-2">
                <span className="text-lg">⚠️</span>
                <span>Connection Error</span>
              </div>
              <div className="text-xs opacity-90 mb-3">{error}</div>
              <button
                onClick={fetchSessions}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:scale-105"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444'
                }}
              >
                Retry Connection
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
              <div className="relative mb-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-xl"
                     style={{ backgroundColor: isDark ? '#10a37f' : '#000000' }}>
                  <IconRobot size={24} className="text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: '#22c55e' }}>
                  <IconBolt size={10} className="text-white" />
                </div>
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-2"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Ready to Chat!
              </h3>
              <p className="text-xs sm:text-sm mb-4 leading-relaxed max-w-xs"
                 style={{ color: isDark ? '#d1d5db' : '#6b7280' }}>
                No conversations yet. Start your first AI chat session and explore the possibilities.
              </p>
              <button
                onClick={createNewSession}
                className="px-4 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
                style={{
                  backgroundColor: isDark ? '#10a37f' : '#000000',
                  color: '#ffffff',
                  boxShadow: isDark ? '0 4px 12px rgba(16, 163, 127, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                Start New Chat
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto px-2 sm:px-3 py-2 space-y-1">
              {sessions.map((session) => {
                const isCurrentSession = session._id === currentSessionId;
                const isStreaming = chatContextAvailable ? isSessionStreaming?.(session._id) : false;
                const isEditing = editingSessionId === session._id;
                const isDeleting = deletingSessionId === session._id;

                return (
                  <div
                    key={session._id}
                    className={`group relative rounded-xl transition-all duration-200 ${
                      isCurrentSession ? 'ring-2' : ''
                    } ${isStreaming ? 'animate-pulse' : ''}`}
                    style={{
                      backgroundColor: isCurrentSession
                        ? isDark ? 'rgba(16, 163, 127, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                        : isDark ? 'transparent' : 'transparent',
                      border: `1px solid ${
                        isCurrentSession 
                          ? isDark ? '#10a37f' : '#000000'
                          : isDark ? '#4a4a4a' : '#e5e5e5'
                      }`,
                      ringColor: isCurrentSession 
                        ? isDark ? '#10a37f' : '#000000' 
                        : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrentSession) {
                        e.target.style.backgroundColor = isDark ? 'rgba(47, 47, 47, 0.5)' : 'rgba(245, 245, 245, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrentSession) {
                        e.target.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div className="p-2.5 sm:p-3">
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
                                className="flex-1 text-xs sm:text-sm p-2 rounded-lg focus:outline-none focus:ring-2 transition-colors"
                                style={{ 
                                  backgroundColor: isDark ? '#4a4a4a' : '#f9f9f9',
                                  border: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
                                  color: isDark ? '#ffffff' : '#000000'
                                }}
                                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${isDark ? '#10a37f' : '#000000'}33`}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                                placeholder="Session title..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                autoFocus
                              />
                              <button
                                onClick={saveEdit}
                                className="p-1.5 rounded-lg transition-colors hover:scale-110"
                                style={{ 
                                  color: '#22c55e',
                                  backgroundColor: 'rgba(34, 197, 94, 0.1)'
                                }}
                              >
                                <IconCheck size={12} />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-1.5 rounded-lg transition-colors hover:scale-110"
                                style={{ 
                                  color: '#ef4444',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)'
                                }}
                              >
                                <IconX size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                                   style={{ 
                                     backgroundColor: isCurrentSession 
                                       ? isDark ? '#10a37f' : '#000000'
                                       : isDark ? '#4a4a4a' : '#d1d5db'
                                   }}></div>
                              <span className="font-medium text-xs sm:text-sm truncate transition-colors"
                                    style={{ 
                                      color: isCurrentSession 
                                        ? isDark ? '#10a37f' : '#000000'
                                        : isDark ? '#ffffff' : '#000000'
                                    }}>
                                {formatSessionTitle(session)}
                              </span>
                              {isStreaming && (
                                <div className="flex items-center gap-1 ml-auto">
                                  <div className="w-1 h-1 rounded-full animate-pulse"
                                       style={{ backgroundColor: isDark ? '#10a37f' : '#000000' }}></div>
                                  <div className="w-1 h-1 rounded-full animate-pulse"
                                       style={{ 
                                         backgroundColor: isDark ? '#10a37f' : '#000000',
                                         animationDelay: '0.2s'
                                       }}></div>
                                  <div className="w-1 h-1 rounded-full animate-pulse"
                                       style={{ 
                                         backgroundColor: isDark ? '#10a37f' : '#000000',
                                         animationDelay: '0.4s'
                                       }}></div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(session._id, session.title);
                              }}
                              className="p-1.5 rounded-lg transition-all hover:scale-110"
                              style={{ 
                                color: isDark ? '#d1d5db' : '#6b7280',
                                backgroundColor: isDark ? 'rgba(209, 213, 219, 0.1)' : 'rgba(107, 114, 128, 0.1)'
                              }}
                              title="Edit title"
                            >
                              <IconEdit size={10} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(session._id, formatSessionTitle(session));
                              }}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg transition-all hover:scale-110 disabled:opacity-50"
                              style={{ 
                                color: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)'
                              }}
                              title="Delete session"
                            >
                              {isDeleting ? (
                                <div className="animate-spin rounded-full h-2.5 w-2.5 border border-red-500 border-t-transparent"></div>
                              ) : (
                                <IconTrash size={10} />
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

        {/* Debug Footer */}
        {debug && process.env.NODE_ENV === 'development' && (
          <div className="p-3 text-xs transition-all"
               style={{ 
                 borderTop: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
                 backgroundColor: isDark ? 'rgba(47, 47, 47, 0.3)' : 'rgba(245, 245, 245, 0.5)',
                 color: isDark ? '#d1d5db' : '#6b7280'
               }}>
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

      {/* ✅ CUSTOM DELETE CONFIRMATION DIALOG */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onConfirm={handleDeleteConfirm}
        onCancel={closeDeleteDialog}
        isDark={isDark}
        sessionTitle={deleteDialog.sessionTitle}
      />
    </>
  );
};

export default ChatSessionList;
