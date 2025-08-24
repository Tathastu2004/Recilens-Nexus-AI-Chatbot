"use client";
import React, { useState, useEffect, useRef , useCallback} from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar.jsx";
import {Link} from "react-router-dom";
import {
  IconArrowLeft,
  IconMessageCircle,
  IconUserBolt,
  IconMessagePlus,
  IconTrash,
  IconRobot,
  IconBolt,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils.js";
import { useUser } from "../context/UserContext.jsx";
import { useChat } from "../context/ChatContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

const SideBar = ({ onSelectSession, onToggle, selectedSessionId, onSessionDelete }) => {
  const [chats, setChats] = useState([]);
  const { user, logoutUser, loading } = useUser();
  const { isDark } = useTheme();
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
    
    // if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
    //   return;
    // }

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
        <div className={`animate-spin rounded-full h-5 w-5 border-2 ${
          isDark ? 'border-blue-400 border-t-transparent' : 'border-blue-500 border-t-transparent'
        }`}></div>
      ) : (
        <IconMessagePlus className={`h-5 w-5 shrink-0 ${
          isDark ? 'text-blue-400' : 'text-blue-600'
        }`} />
      ),
      onClick: handleNewChat,
      disabled: creatingChat || operationInProgress.current
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <IconUserBolt className={`h-5 w-5 shrink-0 ${
        isDark ? 'text-gray-300' : 'text-gray-700'
      }`} />,
    },
     {
    label: "Feedback", // <-- Changed from Settings to Feedback
    href: "/feedback", // <-- Route to /feedback
    icon: <IconMessageCircle className={`h-5 w-5 shrink-0 ${
      isDark ? 'text-gray-300' : 'text-gray-700'
    }`} />, // <-- Feedback icon
  },
    {
      label: "Logout",
      href: "#",
      icon: <IconArrowLeft className={`h-5 w-5 shrink-0 ${
        isDark ? 'text-red-400' : 'text-red-600'
      }`} />,
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

  // ✅ FORMAT CHAT TITLE (NO DATE)
  const formatChatTitle = (chat) => {
    if (chat.title && chat.title !== 'New Chat') {
      return chat.title.length > 25 ? `${chat.title.substring(0, 25)}...` : chat.title;
    }
    return 'New Chat';
  };

  return (
  <div className={`h-screen transition-all duration-300 ${  
    open ? 'w-[280px]' : 'w-[70px]'
  } ${
    isDark 
      ? 'bg-gradient-to-b from-gray-800 via-gray-900 to-black' 
      : 'bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200'
  } overflow-hidden`}>
    <Sidebar open={open} setOpen={handleToggle} animate={true}>
      <SidebarBody className={`flex flex-col h-full justify-between transition-all duration-300 ${
        isDark 
          ? 'bg-gradient-to-b from-gray-800 via-gray-900 to-black border-r border-gray-700/50' 
          : 'bg-gradient-to-b from-white via-gray-50 to-gray-100 border-r border-gray-200'
      } overflow-hidden`}>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* ✅ LOGO - FIXED: Remove duplicate div and add proper routing */}
          <div className={`relative z-20 flex items-center py-6 text-sm font-normal transition-all duration-300 ${
            open ? 'justify-start px-6' : 'justify-center px-3'
          }`}>
            <Link 
              to="/chat" 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                // ✅ CLEAR SESSION TO GO TO WELCOME PAGE
                if (chatContextAvailable && setSession) {
                  setSession(null);
                }
                // ✅ CLEAR PARENT SELECTION
                if (onSelectSession) {
                  onSelectSession(null);
                }
                // ✅ NAVIGATE TO CHAT INTERFACE (WELCOME SCREEN)
                navigate('/chat');
              }}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <IconRobot size={18} className="text-white" />
              </div>
              {open && (
                <span className={`font-bold text-lg ml-3 truncate transition-all duration-200 ${
                  isDark 
                    ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                }`}>
                  Nexus AI
                </span>
              )}
            </Link>
          </div>

          {/* ✅ NEW CHAT BUTTON - FASTER ANIMATION */}
          <div className={`mb-6 transition-all duration-300 ${
            open ? 'px-6' : 'px-3'
          }`}>
            <div className={`flex items-center ${open ? 'justify-between' : 'justify-center'}`}>
              <div className={`transition-all duration-200 ${
                links[0].disabled ? 'opacity-50 cursor-not-allowed' : ''
              } ${open ? 'flex-1 max-w-full' : 'w-12 h-12'}`}>
                <button
                  onClick={links[0].disabled ? undefined : links[0].onClick}
                  disabled={links[0].disabled}
                  className={`transition-all duration-200 flex items-center ${
                    isDark 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg'
                  } transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 ${
                    open 
                      ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                      : 'w-12 h-12 rounded-xl justify-center'
                  }`}
                >
                  <div className="shrink-0">
                    {links[0].icon}
                  </div>
                  {open && (
                    <span className="font-medium truncate transition-all duration-200">
                      {links[0].label}
                    </span>
                  )}
                </button>
              </div>
              
              {/* ✅ CONNECTION STATUS - FASTER ANIMATION */}
              {chatContextAvailable && open && (
                <div className={`ml-4 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                  isConnected 
                    ? isDark 
                      ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : isDark 
                      ? 'bg-red-900/30 text-red-400 border border-red-500/30' 
                      : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {isConnected ? '⚡' : '🔄'}
                </div>
              )}
            </div>
            
            {/* ✅ ERROR DISPLAY - FASTER ANIMATION */}
            {error && open && (
              <div className={`text-xs p-4 rounded-lg mt-4 transition-all duration-200 ${
                isDark 
                  ? 'text-red-400 bg-red-900/20 border border-red-500/30' 
                  : 'text-red-600 bg-red-50 border border-red-200'
              }`}>
                <div className="truncate">{error}</div>
                <button
                  onClick={() => fetchChats(false)}
                  className={`mt-2 underline hover:no-underline transition-colors text-xs ${
                    isDark ? 'text-red-300' : 'text-red-700'
                  }`}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* ✅ CHAT SESSIONS CONTAINER - IMPROVED COLLAPSED MARGINS */}
          <div className={`flex-1 overflow-hidden rounded-xl mb-6 transition-all duration-300 ${
            open ? 'mx-6' : 'mx-2'  // ✅ FIXED: Reduced margin for collapsed state
          } ${
            isDark 
              ? 'bg-gradient-to-b from-gray-700/30 to-gray-800/30 border border-gray-600/30 backdrop-blur-sm' 
              : 'bg-gradient-to-b from-gray-50/80 to-gray-100/80 border border-gray-200/50 backdrop-blur-sm'
          }`}>
            {open ? (
              <div className="h-full flex flex-col overflow-hidden">
                {/* ✅ SESSIONS HEADER - FASTER ANIMATION */}
                <div className={`p-5 border-b transition-all duration-200 shrink-0 ${
                  isDark 
                    ? 'border-gray-600/30 bg-gray-800/20' 
                    : 'border-gray-200/50 bg-white/50'
                }`}>
                  <div className="flex items-center gap-3 mb-3 min-w-0">
                    <div className="w-5 h-5 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shrink-0">
                      <IconRobot size={12} className="text-white" />
                    </div>
                    <span className={`text-sm font-bold transition-colors duration-200 truncate ${
                      isDark 
                        ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                    }`}>
                      Chat Sessions
                    </span>
                  </div>
                  
                  <div className={`text-xs flex items-center gap-3 min-w-0 transition-colors duration-200 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <span className="truncate">{chats.length} conversations</span>
                    {chatContextAvailable && debug && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all duration-200 ${
                        isDark 
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' 
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {debug.totalMessages} msgs
                      </span>
                    )}
                  </div>
                </div>
                
                {/* ✅ SESSIONS LIST - FASTER ANIMATION */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {chats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="relative mb-6">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                            <IconRobot size={20} className="text-white" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                            <IconBolt size={8} className="text-white" />
                          </div>
                        </div>
                        <div className={`text-sm font-medium mb-2 transition-colors duration-200 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Ready to Chat!
                        </div>
                        <div className={`text-xs transition-colors duration-200 ${
                          isDark ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          Start your first conversation
                        </div>
                      </div>
                    ) : (
                      chats.map((chat) => {
                        const isCurrentSession = chatContextAvailable ? 
                          (currentSessionId === chat._id) : 
                          (selectedSessionId === chat._id);
                        const isStreaming = chatContextAvailable ? 
                          isSessionStreaming?.(chat._id) : false;

                        return (
                          <div
                            key={chat._id}
                            onClick={() => handleSelectChat(chat._id)}
                            onMouseEnter={() => setHoveredChat(chat._id)}
                            onMouseLeave={() => setHoveredChat(null)}
                            className={`group relative rounded-xl transition-all duration-200 border cursor-pointer overflow-hidden ${
                              isCurrentSession
                                ? isDark 
                                  ? 'bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-500/50 shadow-lg shadow-blue-500/20' 
                                  : 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-300 shadow-md'
                                : isDark 
                                  ? 'hover:bg-gray-700/30 border-gray-600/30 hover:border-gray-500/50' 
                                  : 'hover:bg-white/70 border-gray-200 hover:border-gray-300'
                            } ${isStreaming ? 'animate-pulse ring-2 ring-purple-500/30' : ''}`}
                          >
                            {/* ✅ CHAT ITEM - FASTER ANIMATION */}
                            <div className="p-4 min-w-0">
                              <div className="flex items-center justify-between min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full shrink-0 transition-all duration-200 ${
                                      isCurrentSession 
                                        ? 'bg-gradient-to-r from-blue-400 to-purple-400 shadow-lg' 
                                        : isDark 
                                          ? 'bg-gray-600' 
                                          : 'bg-gray-400'
                                    }`}></div>
                                    <span className={`font-medium text-sm truncate transition-colors duration-200 ${
                                      isCurrentSession 
                                        ? isDark 
                                          ? 'text-blue-300' 
                                          : 'text-blue-700'
                                        : isDark 
                                          ? 'text-gray-200' 
                                          : 'text-gray-800'
                                    }`}>
                                      {formatChatTitle(chat)}
                                    </span>
                                    {isStreaming && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse"></div>
                                        <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                        <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* ✅ DELETE BUTTON - FASTER ANIMATION */}
                                {hoveredChat === chat._id && !operationInProgress.current && (
                                  <button
                                    onClick={(e) => handleDeleteChat(e, chat._id)}
                                    disabled={deletingChat === chat._id}
                                    className={`ml-3 p-2 rounded-lg transition-all duration-200 disabled:opacity-50 opacity-0 group-hover:opacity-100 shrink-0 ${
                                      isDark 
                                        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20' 
                                        : 'text-gray-500 hover:text-red-600 hover:bg-red-100'
                                    }`}
                                    title="Delete chat"
                                  >
                                    {deletingChat === chat._id ? (
                                      <div className={`w-3 h-3 animate-spin rounded-full border ${
                                        isDark ? 'border-red-400 border-t-transparent' : 'border-red-600 border-t-transparent'
                                      }`}></div>
                                    ) : (
                                      <IconTrash className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // ✅ COLLAPSED STATE - FIXED DOTS ALIGNMENT
              <div className="flex flex-col items-center py-6 space-y-4 transition-all duration-200">
                {/* Main chat icon indicator */}
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                  <IconRobot size={16} className="text-white" />
                </div>
                
                {/* Session count indicator */}
                <div className={`text-xs px-2 py-1 rounded-full font-medium transition-all duration-200 ${
                  isDark 
                    ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' 
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {chats.length}
                </div>

                {/* ✅ FIXED: Recent session indicators - Properly centered */}
                {chats.length > 0 && (
                  <div className="flex flex-col items-center space-y-2">
                    {chats.slice(0, 3).map((chat, idx) => {
                      const isCurrentSession = chatContextAvailable ? 
                        (currentSessionId === chat._id) : 
                        (selectedSessionId === chat._id);
                      
                      return (
                        <div
                          key={chat._id}
                          onClick={() => handleSelectChat(chat._id)}
                          className={`w-2 h-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-110 ${
                            isCurrentSession 
                              ? 'bg-gradient-to-r from-blue-400 to-purple-400 shadow-lg scale-125' 
                              : isDark 
                                ? 'bg-gray-600 hover:bg-gray-500' 
                                : 'bg-gray-400 hover:bg-gray-500'
                          }`}
                          title={formatChatTitle(chat)}
                        />
                      );
                    })}
                    
                    {/* Show indicator for more sessions if there are more than 3 */}
                    {chats.length > 3 && (
                      <div className={`text-xs transition-all duration-200 ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        ⋯
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✅ NAVIGATION LINKS - FASTER ANIMATION */}
          <div className={`mt-auto pt-6 border-t transition-all duration-300 ${
            open ? 'px-6' : 'px-3'
          } ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
            {links.slice(1).map((link, idx) => (
              <div key={idx} className={`mb-3 flex ${open ? 'justify-start' : 'justify-center'}`}>
                <button
                  onClick={link.onClick || (() => navigate(link.href))}
                  className={`transition-all duration-200 flex items-center text-left ${
                    isDark 
                      ? 'hover:bg-gray-700/30 text-gray-300 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                  } ${
                    open 
                      ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                      : 'w-12 h-12 rounded-xl justify-center'
                  }`}
                >
                  <div className="shrink-0">
                    {link.icon}
                  </div>
                  {open && (
                    <span className="font-medium truncate transition-all duration-200">
                      {link.label}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ USER PROFILE SECTION - FASTER ANIMATION */}
        <div className={`border-t pt-5 pb-3 transition-all duration-300 ${
          open ? 'px-6' : 'px-3'
        } ${isDark ? 'border-gray-700/50' : 'border-gray-200'} flex ${
          open ? 'justify-start' : 'justify-center'
        }`}>
          <button
            onClick={() => navigate('/profile')}
            className={`transition-all duration-200 flex items-center text-left ${
              isDark 
                ? 'hover:bg-gray-700/30 text-gray-300' 
                : 'hover:bg-gray-100 text-gray-700'
            } ${
              open 
                ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                : 'w-12 h-12 rounded-xl justify-center p-0'
            }`}
          >
            {/* ✅ PROFILE IMAGE CONTAINER - FASTER ANIMATION */}
            <div className={`relative shrink-0 ${open ? '' : 'flex items-center justify-center'}`}>
              <img
                src={getProfilePictureUrl()}
                className={`rounded-full object-cover border-2 transition-all duration-200 ${
                  isDark ? 'border-gray-600' : 'border-gray-200'
                } ${open ? 'h-8 w-8' : 'h-10 w-10'}`}
                alt="Avatar"
                onError={(e) =>
                  (e.target.src = "https://assets.aceternity.com/manu.png")
                }
              />
              {/* ✅ STATUS DOT - FASTER ANIMATION */}
              <div className={`absolute rounded-full border-2 transition-all duration-200 ${
                isDark ? 'border-gray-800' : 'border-white'
              } ${
                chatContextAvailable && isConnected ? 'bg-green-500' : 'bg-gray-400'
              } ${
                open ? '-bottom-0.5 -right-0.5 w-3 h-3' : '-bottom-1 -right-1 w-4 h-4'
              }`}></div>
            </div>
            
            {/* ✅ USER INFO - FASTER ANIMATION */}
            {open && (
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate transition-colors duration-200 ${
                  isDark ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  {user?.name || "User Name"}
                </div>
                <div className={`text-xs transition-colors duration-200 ${
                  isDark ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {chatContextAvailable && isConnected ? 'Online' : 'Offline'}
                </div>
              </div>
            )}
          </button>
        </div>
      </SidebarBody>
    </Sidebar>
  </div>
);
};

export default SideBar;
