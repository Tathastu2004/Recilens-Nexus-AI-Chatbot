"use client";
import React, { useState, useEffect, useRef , useCallback} from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar.jsx";
import {
  IconArrowLeft,
  IconSettings,
  IconUserBolt,
  IconMessagePlus,
  IconTrash,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils.js";
import { useUser } from "../context/UserContext.jsx";
import { useChat } from "../context/ChatContext.jsx";

const SideBar = ({ onSelectSession, onToggle, selectedSessionId, onSessionDelete }) => {
  const [chats, setChats] = useState([]);
  const { user, logoutUser, loading } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState(null);
  const [deletingChat, setDeletingChat] = useState(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const operationInProgress = useRef(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");

  // ✅ CHAT CONTEXT INTEGRATION
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
    console.log('✅ [SIDEBAR] ChatContext available:', {
      hasContext: !!chatContext,
      currentSessionId: chatContext?.currentSessionId,
      isConnected: chatContext?.isConnected
    });
  } catch (error) {
    console.log('⚠️ [SIDEBAR] ChatContext not available, using fallback mode:', error.message);
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

  // ✅ ENHANCED FETCH CHATS WITH ERROR HANDLING
  const fetchChats = useCallback(async (useCache = true) => {
    try {
      setError(null);
      
      if (!token) {
        console.warn("⚠️ [SIDEBAR] No authentication token found");
        setChats([]);
        return;
      }

      console.log("📤 [SIDEBAR] Fetching sessions...");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${backendUrl}/api/chat/sessions`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        cache: useCache ? 'default' : 'no-cache',
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
      console.log("📦 [SIDEBAR] Chat sessions loaded:", data.length);

      if (Array.isArray(data)) {
        // ✅ SORT BY LAST ACTIVITY
        const sortedChats = data.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
        setChats(sortedChats);
      } else {
        setChats([]);
      }
    } catch (error) {
      console.error("❌ [SIDEBAR] Failed to fetch chat sessions:", error.message);
      
      if (error.name === 'AbortError') {
        setError('Request timed out. Please check your connection.');
      } else {
        setError(error.message || 'Failed to load chats');
      }
      setChats([]);
    }
  }, [backendUrl, token]);

  // ✅ INITIAL FETCH
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // ✅ ENHANCED NEW CHAT CREATION WITH CHATCONTEXT INTEGRATION
  const handleNewChat = async () => {
    if (operationInProgress.current || creatingChat) {
      console.log('⚠️ [SIDEBAR] Operation already in progress, skipping...');
      return;
    }

    try {
      operationInProgress.current = true;
      setCreatingChat(true);
      setError(null);

      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("📤 [SIDEBAR] Creating new chat session...");

      const res = await fetch(`${backendUrl}/api/chat/session`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "New Chat" })
      });

      if (!res.ok) {
        throw new Error(`Failed to create session (${res.status})`);
      }

      const result = await res.json();
      const newSession = result.session || result;
      
      console.log("✅ [SIDEBAR] New chat session created:", newSession._id);
      
      // ✅ ADD TO LOCAL STATE IMMEDIATELY
      setChats((prev) => {
        const exists = prev.some(chat => chat._id === newSession._id);
        if (exists) return prev;
        
        return [newSession, ...prev].sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
      });
      
      // ✅ SET IN CHATCONTEXT
      if (chatContextAvailable && setSession) {
        setSession(newSession._id);
      }
      
      // ✅ NOTIFY PARENT COMPONENT
      if (onSelectSession) {
        onSelectSession(newSession._id);
      }

      // ✅ BROADCAST EVENTS FOR OTHER COMPONENTS
      window.dispatchEvent(new CustomEvent('sessionCreated', { 
        detail: { 
          session: newSession,
          sessionId: newSession._id, 
          timestamp: new Date().toISOString()
        }
      }));
      
      window.dispatchEvent(new CustomEvent('newSessionCreated', { 
        detail: { sessionId: newSession._id, session: newSession }
      }));
      
    } catch (err) {
      console.error("❌ [SIDEBAR] Failed to create chat:", err.message);
      setError(`Failed to create new chat: ${err.message}`);
      
      // ✅ BROADCAST ERROR EVENT
      window.dispatchEvent(new CustomEvent('sessionCreationFailed', {
        detail: { error: err.message }
      }));
      
    } finally {
      operationInProgress.current = false;
      setCreatingChat(false);
    }
  };

  // ✅ ENHANCED DELETE CHAT WITH CHATCONTEXT INTEGRATION
  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    
    if (operationInProgress.current || deletingChat) {
      return;
    }
    
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return;
    }

    try {
      operationInProgress.current = true;
      setDeletingChat(chatId);
      setError(null);
      
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("🗑️ [SIDEBAR] Deleting chat session:", chatId);

      // ✅ OPTIMISTIC UPDATE - REMOVE FROM UI IMMEDIATELY
      setChats((prev) => prev.filter(chat => chat._id !== chatId));
      
      // ✅ CLEAR FROM CHATCONTEXT IF IT'S CURRENT SESSION
      if (chatContextAvailable && currentSessionId === chatId) {
        setSession(null);
      }
      
      // ✅ NOTIFY PARENT IMMEDIATELY
      if (selectedSessionId === chatId && onSessionDelete) {
        onSessionDelete(chatId);
      }

      const res = await fetch(`${backendUrl}/api/chat/session/${chatId}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to delete session (${res.status})`);
      }

      console.log("✅ [SIDEBAR] Chat session deleted successfully");
      
      // ✅ BROADCAST EVENTS
      window.dispatchEvent(new CustomEvent('sessionDeleted', {
        detail: { sessionId: chatId }
      }));
      
    } catch (err) {
      console.error("❌ [SIDEBAR] Failed to delete chat:", err.message);
      setError(`Failed to delete chat: ${err.message}`);
      
      // ✅ ROLLBACK ON ERROR - REFRESH FROM SERVER
      fetchChats(false);
      
    } finally {
      operationInProgress.current = false;
      setDeletingChat(null);
    }
  };

  // ✅ ENHANCED CHAT SELECTION WITH CHATCONTEXT
  const handleSelectChat = (sessionId) => {
    if (operationInProgress.current) return;
    
    console.log("🎯 [SIDEBAR] Selected chat session:", sessionId);
    
    // ✅ SET IN CHATCONTEXT
    if (chatContextAvailable && setSession) {
      setSession(sessionId);
    }
    
    // ✅ NOTIFY PARENT
    if (onSelectSession) {
      onSelectSession(sessionId);
    }
  };

  // ✅ EVENT LISTENERS FOR GLOBAL UPDATES
  useEffect(() => {
    const handleSessionCreated = (event) => {
      const { session } = event.detail;
      console.log('🎉 [SIDEBAR] External session created:', session._id);
      
      setChats(prevChats => {
        const exists = prevChats.some(chat => chat._id === session._id);
        if (exists) return prevChats;
        
        return [session, ...prevChats].sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
      });
      
      setRefreshTrigger(prev => prev + 1);
    };

    const handleSessionUpdated = (event) => {
      const { session } = event.detail;
      console.log('📝 [SIDEBAR] External session updated:', session._id);
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat._id === session._id ? { ...chat, ...session } : chat
        )
      );
    };

    const handleSessionDeleted = (event) => {
      const { sessionId } = event.detail;
      console.log('🗑️ [SIDEBAR] External session deleted:', sessionId);
      
      setChats(prevChats => prevChats.filter(chat => chat._id !== sessionId));
    };

    const handleTitleUpdate = (event) => {
      const { sessionId, title } = event.detail;
      console.log('📝 [SIDEBAR] External title update:', { sessionId, title });
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat._id === sessionId 
            ? { ...chat, title, updatedAt: new Date().toISOString() }
            : chat
        )
      );
    };

    const handleSessionCreationFailed = (event) => {
      const { error } = event.detail;
      console.error('❌ [SIDEBAR] External session creation failed:', error);
      setError(`Failed to create session: ${error}`);
    };

    // ✅ ADD ALL EVENT LISTENERS
    const events = [
      ['sessionCreated', handleSessionCreated],
      ['newSessionCreated', handleSessionCreated],
      ['sessionUpdated', handleSessionUpdated],
      ['sessionDeleted', handleSessionDeleted],
      ['sessionTitleUpdated', handleTitleUpdate],
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
  }, []);

  // ✅ ENHANCED LOGOUT HANDLER
  const handleLogout = async () => {
    try {
      const result = await logoutUser();
      console.log("🚪 [SIDEBAR] Logout result:", result);
      navigate("/signup");
    } catch (error) {
      console.error("❌ [SIDEBAR] Logout error:", error);
      navigate("/signup");
    }
  };

  // ✅ ENHANCED LINKS WITH STATUS INDICATORS
  const links = [
    {
      label: creatingChat ? "Creating..." : "New Chat",
      href: "#",
      icon: creatingChat ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
      ) : (
        <IconMessagePlus className="h-5 w-5 shrink-0 text-neutral-700" />
      ),
      onClick: handleNewChat,
      disabled: creatingChat || operationInProgress.current
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <IconUserBolt className="h-5 w-5 shrink-0 text-neutral-700" />,
    },
    {
      label: "Settings",
      href: "#",
      icon: <IconSettings className="h-5 w-5 shrink-0 text-neutral-700" />,
    },
    {
      label: "Logout",
      href: "#",
      icon: <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700" />,
      onClick: handleLogout,
    },
  ];

  // ✅ ENHANCED PROFILE PICTURE HANDLER
  const getProfilePictureUrl = () => {
    if (!user?.profilePicture) return "https://assets.aceternity.com/manu.png";
    if (user.profilePicture.startsWith("http")) return user.profilePicture;
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    return `${baseUrl}${user.profilePicture}`;
  };

  // ✅ ENHANCED TOGGLE HANDLER
  const handleToggle = (newOpenState) => {
    setOpen(newOpenState);
    if (onToggle) {
      onToggle(newOpenState);
    }
  };

  // ✅ FORMAT CHAT TITLE
  const formatChatTitle = (chat) => {
    if (chat.title && chat.title !== 'New Chat') {
      return chat.title.length > 25 ? `${chat.title.substring(0, 25)}...` : chat.title;
    }
    return `Chat ${new Date(chat.createdAt || Date.now()).toLocaleDateString()}`;
  };

  // ✅ FORMAT CHAT TIME
  const formatChatTime = (chat) => {
    const date = new Date(chat.updatedAt || chat.createdAt || Date.now());
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

  return (
    <div className="h-screen w-full">
      <Sidebar open={open} setOpen={handleToggle} animate={true}>
        <SidebarBody className="flex flex-col h-full justify-between gap-2">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />

            {/* ✅ ENHANCED HEADER WITH STATUS */}
            <div className="mt-8 mb-4">
              <div className="flex items-center justify-between mb-2">
                <SidebarLink
                  link={links[0]}
                  onClick={links[0].disabled ? undefined : links[0].onClick}
                  className={`transition-colors flex-1 ${
                    links[0].disabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'bg-primary/10 hover:bg-primary/20'
                  }`}
                />
                {/* ✅ CONNECTION STATUS */}
                {chatContextAvailable && open && (
                  <div className={`ml-2 text-xs px-2 py-1 rounded-full ${
                    isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isConnected ? '🟢' : '🔴'}
                  </div>
                )}
              </div>
              
              {/* ✅ ERROR DISPLAY */}
              {error && open && (
                <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded mb-2">
                  {error}
                  <button
                    onClick={() => fetchChats(false)}
                    className="ml-2 underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* ✅ ENHANCED CHAT LIST */}
            <div className="flex-1 overflow-y-auto">
              {open && (
                <>
                  <div className="text-sm text-muted-foreground px-2 mb-2 flex items-center justify-between">
                    <span>Previous Chats ({chats.length})</span>
                    {chatContextAvailable && debug && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {debug.totalMessages} msgs
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {chats.length === 0 ? (
                      <div className="text-xs text-gray-500 px-2 py-4 text-center">
                        <div className="mb-2">📱 No previous chats</div>
                        <div className="text-xs">Start a conversation to begin</div>
                      </div>
                    ) : (
                      chats.map((chat) => {
                        const isCurrentSession = chatContextAvailable ? 
                          (currentSessionId === chat._id) : 
                          (selectedSessionId === chat._id);
                        const isStreaming = chatContextAvailable ? 
                          isSessionStreaming?.(chat._id) : false;
                        const messageCount = chatContextAvailable ? 
                          getSessionMessageCount?.(chat._id) : 0;

                        return (
                          <div
                            key={chat._id}
                            onClick={() => handleSelectChat(chat._id)}
                            onMouseEnter={() => setHoveredChat(chat._id)}
                            onMouseLeave={() => setHoveredChat(null)}
                            className={`px-2 py-2 text-sm hover:bg-primary/10 rounded-md cursor-pointer transition-all duration-150 flex items-center justify-between group border ${
                              isCurrentSession ? 'bg-primary/20 font-medium border-primary/30' : 'border-transparent'
                            } ${isStreaming ? 'ring-2 ring-purple-200 animate-pulse' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate">
                                  {formatChatTitle(chat)}
                                </span>
                                {isStreaming && (
                                  <span className="text-xs text-purple-600 animate-pulse">🌊</span>
                                )}
                                {isCurrentSession && (
                                  <span className="text-xs text-blue-600">●</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                                <span>{formatChatTime(chat)}</span>
                                {chatContextAvailable && messageCount > 0 && (
                                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                    {messageCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* ✅ ENHANCED DELETE BUTTON */}
                            {hoveredChat === chat._id && !operationInProgress.current && (
                              <button
                                onClick={(e) => handleDeleteChat(e, chat._id)}
                                disabled={deletingChat === chat._id}
                                className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                title="Delete chat"
                              >
                                {deletingChat === chat._id ? (
                                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                                ) : (
                                  <IconTrash className="h-4 w-4 text-red-500 hover:text-red-700" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ✅ ENHANCED NAVIGATION LINKS */}
            <div className="mt-auto pt-4 border-t border-border">
              {links.slice(1).map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={link}
                  onClick={link.onClick}
                />
              ))}
            </div>
          </div>

          {/* ✅ ENHANCED USER PROFILE SECTION */}
          <div>
            <SidebarLink
              link={{
                label: user?.name || "User Name",
                href: "/profile",
                icon: (
                  <div className="relative">
                    <img
                      src={getProfilePictureUrl()}
                      className="h-7 w-7 rounded-full object-cover border border-gray-200"
                      alt="Avatar"
                      onError={(e) =>
                        (e.target.src = "https://assets.aceternity.com/manu.png")
                      }
                    />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                      chatContextAvailable && isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                ),
              }}
            />
            
            {/* ✅ CONNECTION STATUS FOOTER */}
            {open && chatContextAvailable && (
              <div className="text-xs text-center mt-2 text-gray-500">
                {chats.length} chat{chats.length !== 1 ? 's' : ''}
                {debug && (
                  <div className="mt-1">
                    {debug.totalSessions} sessions • {debug.totalMessages} msgs
                  </div>
                )}
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  <span>{isConnected ? 'Streaming Active' : 'Disconnected'}</span>
                </div>
              </div>
            )}
          </div>
        </SidebarBody>
      </Sidebar>
    </div>
  );
};

// ✅ ENHANCED LOGO COMPONENT
export const Logo = () => {
  return (
    <a
      href="#"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-black dark:text-white"
      >
        Nexus AI
      </motion.span>
    </a>
  );
};

export default SideBar;
