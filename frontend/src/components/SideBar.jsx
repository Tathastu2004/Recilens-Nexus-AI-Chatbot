"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar.jsx";
import { Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconMessageCircle,
  IconUserBolt,
  IconMessagePlus,
  IconTrash,
  IconRobot,
  IconBolt,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils.js";
import { useClerkUser } from "../context/ClerkUserContext";
import { useChat } from "../context/ChatContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from '@clerk/clerk-react'; // ✅ ADD CLERK AUTH

// ✅ UTILITY FUNCTIONS (unchanged)
const formatChatTitle = (chat) => {
  if (!chat) return "New Chat";
  
  if (chat.title && chat.title !== "New Chat" && chat.title.trim() !== "") {
    return chat.title.length > 30 ? chat.title.substring(0, 30) + "..." : chat.title;
  }
  
  if (chat.messages && chat.messages.length > 0) {
    const firstUserMessage = chat.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      const content = firstUserMessage.content.trim();
      if (content.length > 0) {
        return content.length > 30 ? content.substring(0, 30) + "..." : content;
      }
    }
  }
  
  if (chat.createdAt) {
    const date = new Date(chat.createdAt);
    return `Chat ${date.toLocaleDateString()}`;
  }
  
  return "New Chat";
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

// ✅ DELETE CONFIRMATION DIALOG (unchanged)
const DeleteConfirmationDialog = ({ isOpen, onConfirm, onCancel, isDark, chatTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      ></div>
      
      <div className={`relative w-full max-w-md mx-auto rounded-2xl border shadow-2xl transition-all transform scale-100 ${
        isDark 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className={`flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full ${
            isDark ? 'bg-red-900/30' : 'bg-red-100'
          }`}>
            <IconAlertTriangle size={24} className={isDark ? 'text-red-400' : 'text-red-600'} />
          </div>
          
          <h3 className={`text-lg font-semibold text-center mb-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Delete Chat Session
          </h3>
          
          <p className={`text-sm text-center mb-6 leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Are you sure you want to delete "{chatTitle}"? This action cannot be undone.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isDark 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SideBar = ({ onSelectSession, onToggle, selectedSessionId, onSessionDelete }) => {
  const [chats, setChats] = useState([]);
  const { clerkUser, dbUser, loading, isAuthenticated } = useClerkUser();
  const { getToken } = useAuth(); // ✅ USE CLERK AUTH
  const { isDark } = useTheme();
  
  const user = dbUser || {
    _id: clerkUser?.id,
    name: `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() || clerkUser?.username || 'User',
    email: clerkUser?.primaryEmailAddress?.emailAddress,
    profilePicture: clerkUser?.imageUrl,
    role: 'client'
  };

  const navigate = useNavigate();
  
  // State management (unchanged)
  const [isOpen, setIsOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState(null);
  const [deletingChat, setDeletingChat] = useState(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs (unchanged)
  const operationInProgress = useRef(false);
  const hoverTimeoutRef = useRef(null);
  const stateChangeTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);
  const lastStateChangeRef = useRef(Date.now());

  // Delete dialog state (unchanged)
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    chatId: null,
    chatTitle: ''
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // ✅ GET CLERK TOKEN HELPER
  const getAuthToken = useCallback(async () => {
    try {
      const token = await getToken();
      console.log('🔑 [SIDEBAR] Got Clerk token:', token ? 'Present' : 'Missing');
      return token;
    } catch (error) {
      console.error('❌ [SIDEBAR] Failed to get Clerk token:', error);
      return null;
    }
  }, [getToken]);

  // ✅ STABLE LOGOUT FUNCTION (unchanged)
  const logoutUser = async () => {
    try {
      localStorage.clear();
      if (window.Clerk) {
        await window.Clerk.signOut();
      }
      console.log('✅ User logged out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      localStorage.clear();
      return { success: false, error: error.message };
    }
  };

  // Chat context integration (unchanged)
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
  } catch (error) {
    console.log('⚠️ [SIDEBAR] ChatContext not available');
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

  // Sidebar toggle handlers (unchanged)
  const handleSidebarToggle = useCallback((newState, immediate = false) => {
    const now = Date.now();
    
    if (!immediate && now - lastStateChangeRef.current < 150) {
      return;
    }
    
    if (stateChangeTimeoutRef.current) {
      clearTimeout(stateChangeTimeoutRef.current);
    }
    
    if (immediate) {
      setIsOpen(newState);
      lastStateChangeRef.current = now;
    } else {
      stateChangeTimeoutRef.current = setTimeout(() => {
        setIsOpen(newState);
        lastStateChangeRef.current = Date.now();
      }, 50);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      if (isHoveringRef.current) {
        handleSidebarToggle(true);
      }
    }, 100);
  }, [handleSidebarToggle]);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        handleSidebarToggle(false);
      }
    }, 200);
  }, [handleSidebarToggle]);

  // Cleanup timeouts (unchanged)
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (stateChangeTimeoutRef.current) {
        clearTimeout(stateChangeTimeoutRef.current);
      }
    };
  }, []);

  // ✅ FIXED FETCH CHATS FUNCTION - USE CLERK TOKEN
  const fetchChats = useCallback(async (useCache = true) => {
    if (operationInProgress.current) return;
    
    try {
      setError(null);
      
      const token = await getAuthToken(); // ✅ USE CLERK TOKEN
      if (!token) {
        console.warn("⚠️ [SIDEBAR] No Clerk token available");
        setError("Authentication required. Please sign in again.");
        setChats([]);
        return;
      }

      console.log('📤 [SIDEBAR] Fetching sessions with Clerk token...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${backendUrl}/api/chat/sessions`, {
        headers: { 
          Authorization: `Bearer ${token}`, // ✅ USE CLERK TOKEN
          "Content-Type": "application/json"
        },
        cache: useCache ? 'default' : 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📥 [SIDEBAR] Response status:', res.status);

      if (!res.ok) {
        if (res.status === 401) {
          setError("Session expired. Please sign in again.");
          // Clear local storage and redirect
          localStorage.clear();
          navigate('/signup');
          return;
        }
        throw new Error(`Failed to load chats (${res.status})`);
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        const sortedChats = data.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
        setChats(sortedChats);
        console.log('✅ [SIDEBAR] Loaded', sortedChats.length, 'chat sessions');
      } else {
        setChats([]);
      }
    } catch (error) {
      console.error("❌ [SIDEBAR] Failed to fetch chat sessions:", error.message);
      
      if (error.name === 'AbortError') {
        setError('Request timed out. Please check your connection.');
      } else if (error.message.includes('401')) {
        setError('Session expired. Please sign in again.');
        localStorage.clear();
        navigate('/signup');
      } else {
        setError(error.message || 'Failed to load chats');
      }
      setChats([]);
    }
  }, [backendUrl, getAuthToken, navigate]);

  // ✅ EFFECT FOR INITIAL FETCH - WAIT FOR AUTHENTICATION
  useEffect(() => {
    if (isAuthenticated && clerkUser) {
      console.log('🔄 [SIDEBAR] User authenticated, fetching chats...');
      fetchChats();
    } else {
      console.log('⏳ [SIDEBAR] Waiting for authentication...', { isAuthenticated, hasClerkUser: !!clerkUser });
    }
  }, [isAuthenticated, clerkUser, fetchChats]);

  // ✅ FIXED NEW CHAT CREATION - USE CLERK TOKEN
  const handleNewChat = useCallback(async () => {
    if (operationInProgress.current || creatingChat) {
      return;
    }

    try {
      operationInProgress.current = true;
      setCreatingChat(true);
      setError(null);

      const token = await getAuthToken(); // ✅ USE CLERK TOKEN
      if (!token) {
        throw new Error("Authentication required. Please sign in again.");
      }

      console.log('🆕 [SIDEBAR] Creating new chat with Clerk token...');

      const res = await fetch(`${backendUrl}/api/chat/session`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, // ✅ USE CLERK TOKEN
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "New Chat" })
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(`Failed to create session (${res.status})`);
      }

      const result = await res.json();
      const newSession = result.session || result;
      
      setChats((prev) => {
        const exists = prev.some(chat => chat._id === newSession._id);
        if (exists) return prev;
        
        return [newSession, ...prev].sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
      });
      
      if (chatContextAvailable && setSession) {
        setSession(newSession._id);
      }
      
      if (onSelectSession) {
        onSelectSession(newSession._id);
      }
      
      console.log('✅ [SIDEBAR] New chat created:', newSession._id);
      
    } catch (err) {
      console.error("❌ [SIDEBAR] Failed to create chat:", err.message);
      if (err.message.includes('401') || err.message.includes('Authentication')) {
        setError("Session expired. Please sign in again.");
        localStorage.clear();
        navigate('/signup');
      } else {
        setError(`Failed to create new chat: ${err.message}`);
      }
      
    } finally {
      operationInProgress.current = false;
      setCreatingChat(false);
    }
  }, [backendUrl, getAuthToken, chatContextAvailable, setSession, onSelectSession, navigate]);

  // Delete dialog handlers (unchanged)
  const openDeleteDialog = useCallback((chatId, chatTitle) => {
    setDeleteDialog({
      isOpen: true,
      chatId,
      chatTitle: chatTitle || 'New Chat'
    });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({
      isOpen: false,
      chatId: null,
      chatTitle: ''
    });
  }, []);

  // ✅ FIXED DELETE CHAT FUNCTION - USE CLERK TOKEN
  const handleDeleteChat = useCallback(async () => {
    const { chatId } = deleteDialog;
    
    if (operationInProgress.current || deletingChat || !chatId) {
      return;
    }

    try {
      operationInProgress.current = true;
      setDeletingChat(chatId);
      setError(null);
      
      const token = await getAuthToken(); // ✅ USE CLERK TOKEN
      if (!token) {
        throw new Error("Authentication required. Please sign in again.");
      }

      // Optimistically remove from UI
      setChats((prev) => prev.filter(chat => chat._id !== chatId));
      
      if (chatContextAvailable && currentSessionId === chatId) {
        setSession(null);
      }
      
      if (selectedSessionId === chatId && onSessionDelete) {
        onSessionDelete(chatId);
      }

      const res = await fetch(`${backendUrl}/api/chat/session/${chatId}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`, // ✅ USE CLERK TOKEN
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(`Failed to delete session (${res.status})`);
      }
      
      console.log('✅ [SIDEBAR] Chat deleted:', chatId);
      
    } catch (err) {
      console.error("❌ [SIDEBAR] Failed to delete chat:", err.message);
      if (err.message.includes('401') || err.message.includes('Authentication')) {
        setError("Session expired. Please sign in again.");
        localStorage.clear();
        navigate('/signup');
      } else {
        setError(`Failed to delete chat: ${err.message}`);
        // Restore the chat list on error
        fetchChats(false);
      }
      
    } finally {
      operationInProgress.current = false;
      setDeletingChat(null);
      closeDeleteDialog();
    }
  }, [deleteDialog, getAuthToken, backendUrl, currentSessionId, selectedSessionId, chatContextAvailable, setSession, onSessionDelete, fetchChats, closeDeleteDialog, navigate]);

  // Rest of the handlers (unchanged)
  const handleSelectChat = useCallback((sessionId) => {
    if (operationInProgress.current) return;
    
    if (chatContextAvailable && setSession) {
      setSession(sessionId);
    }
    
    if (onSelectSession) {
      onSelectSession(sessionId);
    }
  }, [chatContextAvailable, setSession, onSelectSession]);

  const handleLogout = useCallback(async () => {
    try {
      const result = await logoutUser();
      navigate("/signup");
    } catch (error) {
      console.error("❌ [SIDEBAR] Logout error:", error);
      navigate("/signup");
    }
  }, [navigate]);

  // Links definition (unchanged)
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
      label: "Feedback",
      href: "/feedback",
      icon: <IconMessageCircle className={`h-5 w-5 shrink-0 ${
        isDark ? 'text-gray-300' : 'text-gray-700'
      }`} />,
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

  const getProfilePictureUrl = useCallback(() => {
    if (!user?.profilePicture) return "https://assets.aceternity.com/manu.png";
    if (user.profilePicture.startsWith("http")) return user.profilePicture;
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    return `${baseUrl}${user.profilePicture}`;
  }, [user?.profilePicture]);

  // Loading state
  if (loading && !user?._id && !clerkUser?.id) {
    return (
      <div className={`h-screen w-[280px] flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center space-y-4">
          <div className={`w-8 h-8 rounded-full border-2 border-t-2 animate-spin mx-auto ${
            isDark ? 'border-gray-700 border-t-blue-400' : 'border-gray-200 border-t-blue-500'
          }`}></div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Rest of the render method stays the same...
  return (
    <>
      {/* ✅ SIDEBAR CONTAINER - UNCHANGED */}
      <div 
        className={`h-screen transition-all duration-300 ease-in-out ${  
          isOpen ? 'w-[280px]' : 'w-[70px]'
        } ${
          isDark 
            ? 'bg-gradient-to-b from-gray-800 via-gray-900 to-black' 
            : 'bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200'
        } overflow-hidden`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`flex flex-col h-full justify-between transition-all duration-300 ${
          isDark 
            ? 'bg-gradient-to-b from-gray-800 via-gray-900 to-black border-r border-gray-700/50' 
            : 'bg-gradient-to-b from-white via-gray-50 to-gray-100 border-r border-gray-200'
        } overflow-hidden`}>
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Logo section unchanged */}
            <div className={`relative z-20 flex items-center py-6 text-sm font-normal transition-all duration-300 ${
              isOpen ? 'justify-start px-6' : 'justify-center px-3'
            }`}>
              <Link 
                to="/chat" 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => {
                  if (chatContextAvailable && setSession) {
                    setSession(null);
                  }
                  if (onSelectSession) {
                    onSelectSession(null);
                  }
                  navigate('/chat');
                }}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <IconRobot size={18} className="text-white" />
                </div>
                {isOpen && (
                  <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`font-bold text-lg ml-3 truncate ${
                      isDark 
                        ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                    }`}
                  >
                    Nexus AI
                  </motion.span>
                )}
              </Link>
            </div>

            {/* New Chat Button and Connection Status */}
            <div className={`mb-6 transition-all duration-300 ${
              isOpen ? 'px-6' : 'px-3'
            }`}>
              <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
                <div className={`transition-all duration-200 ${
                  links[0].disabled ? 'opacity-50 cursor-not-allowed' : ''
                } ${isOpen ? 'flex-1 max-w-full' : 'w-12 h-12'}`}>
                  <button
                    onClick={links[0].disabled ? undefined : links[0].onClick}
                    disabled={links[0].disabled}
                    className={`transition-all duration-200 flex items-center ${
                      isDark 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl' 
                        : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg'
                    } transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 ${
                      isOpen 
                        ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                        : 'w-12 h-12 rounded-xl justify-center'
                    }`}
                  >
                    <div className="shrink-0">
                      {links[0].icon}
                    </div>
                    {isOpen && (
                      <motion.span 
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="font-medium truncate"
                      >
                        {links[0].label}
                      </motion.span>
                    )}
                  </button>
                </div>
                
                {/* Connection Status */}
                {chatContextAvailable && isOpen && (
                  <motion.div 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`ml-4 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap shrink-0 ${
                      isConnected 
                        ? isDark 
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : isDark 
                          ? 'bg-red-900/30 text-red-400 border border-red-500/30' 
                          : 'bg-red-100 text-red-700 border border-red-200'
                    }`}
                  >
                    {isConnected ? '⚡' : '🔄'}
                  </motion.div>
                )}
              </div>
              
              {/* Error Display */}
              {error && isOpen && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-xs p-4 rounded-lg mt-4 ${
                    isDark 
                      ? 'text-red-400 bg-red-900/20 border border-red-500/30' 
                      : 'text-red-600 bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="truncate">{error}</div>
                  <button
                    onClick={() => fetchChats(false)}
                    className={`mt-2 underline hover:no-underline transition-colors text-xs ${
                      isDark ? 'text-red-300' : 'text-red-700'
                    }`}
                  >
                    Retry
                  </button>
                </motion.div>
              )}
            </div>

            {/* ✅ CHAT SESSIONS CONTAINER */}
            <div className={`flex-1 overflow-hidden rounded-xl mb-6 transition-all duration-300 ${
              isOpen ? 'mx-6' : 'mx-2'
            } ${
              isDark 
                ? 'bg-gradient-to-b from-gray-700/30 to-gray-800/30 border border-gray-600/30 backdrop-blur-sm' 
                : 'bg-gradient-to-b from-gray-50/80 to-gray-100/80 border border-gray-200/50 backdrop-blur-sm'
            }`}>
              {isOpen ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full flex flex-col overflow-hidden"
                >
                  {/* SESSIONS HEADER */}
                  <div className={`p-5 border-b shrink-0 ${
                    isDark 
                      ? 'border-gray-600/30 bg-gray-800/20' 
                      : 'border-gray-200/50 bg-white/50'
                  }`}>
                    <div className="flex items-center gap-3 mb-3 min-w-0">
                      <div className="w-5 h-5 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shrink-0">
                        <IconRobot size={12} className="text-white" />
                      </div>
                      <span className={`text-sm font-bold truncate ${
                        isDark 
                          ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                      }`}>
                        Chat Sessions
                      </span>
                    </div>
                    
                    <div className={`text-xs flex items-center gap-3 min-w-0 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <span className="truncate">{chats.length} conversations</span>
                    </div>
                  </div>
                  
                  {/* SESSIONS LIST */}
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
                            onClick={handleNewChat}
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
                                  
                                  {/* DELETE BUTTON */}
                                  {hoveredChat === chat._id && !operationInProgress.current && (
                                    <motion.button
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      transition={{ duration: 0.1 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeleteDialog(chat._id, formatChatTitle(chat));
                                      }}
                                      disabled={deletingChat === chat._id}
                                      className={`ml-3 p-2 rounded-lg transition-all duration-200 disabled:opacity-50 shrink-0 ${
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
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                // COLLAPSED STATE
                <div className="flex flex-col items-center py-6 space-y-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                    <IconRobot size={16} className="text-white" />
                  </div>
                  
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                    isDark 
                      ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' 
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {chats.length}
                  </div>

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
                      
                      {chats.length > 3 && (
                        <div className={`text-xs ${
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

            {/* Navigation Links */}
            <div className={`mt-auto pt-6 border-t transition-all duration-300 ${
              isOpen ? 'px-6' : 'px-3'
            } ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
              {links.slice(1).map((link, idx) => (
                <div key={idx} className={`mb-3 flex ${isOpen ? 'justify-start' : 'justify-center'}`}>
                  <button
                    onClick={link.onClick || (() => navigate(link.href))}
                    className={`transition-all duration-200 flex items-center text-left ${
                      isDark 
                        ? 'hover:bg-gray-700/30 text-gray-300 hover:text-white' 
                        : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                    } ${
                      isOpen 
                        ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                        : 'w-12 h-12 rounded-xl justify-center'
                    }`}
                  >
                    <div className="shrink-0">
                      {link.icon}
                    </div>
                    {isOpen && (
                      <motion.span 
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="font-medium truncate"
                      >
                        {link.label}
                      </motion.span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* User Profile Section */}
          <div className={`border-t pt-5 pb-3 transition-all duration-300 ${
            isOpen ? 'px-6' : 'px-3'
          } ${isDark ? 'border-gray-700/50' : 'border-gray-200'} flex ${
            isOpen ? 'justify-start' : 'justify-center'
          }`}>
            <button
              onClick={() => navigate('/profile')}
              className={`transition-all duration-200 flex items-center text-left ${
                isDark 
                  ? 'hover:bg-gray-700/30 text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-700'
              } ${
                isOpen 
                  ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                  : 'w-12 h-12 rounded-xl justify-center p-0'
              }`}
            >
              <div className={`relative shrink-0 ${isOpen ? '' : 'flex items-center justify-center'}`}>
                <img
                  src={getProfilePictureUrl()}
                  className={`rounded-full object-cover border-2 transition-all duration-200 ${
                    isDark ? 'border-gray-600' : 'border-gray-200'
                  } ${isOpen ? 'h-8 w-8' : 'h-10 w-10'}`}
                  alt="Avatar"
                  onError={(e) =>
                    (e.target.src = "https://assets.aceternity.com/manu.png")
                  }
                />
                <div className={`absolute rounded-full border-2 transition-all duration-200 ${
                  isDark ? 'border-gray-800' : 'border-white'
                } ${
                  chatContextAvailable && isConnected ? 'bg-green-500' : 'bg-gray-400'
                } ${
                  isOpen ? '-bottom-0.5 -right-0.5 w-3 h-3' : '-bottom-1 -right-1 w-4 h-4'
                }`}></div>
              </div>
              
              {isOpen && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 min-w-0"
                >
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
                </motion.div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onConfirm={handleDeleteChat}
        onCancel={closeDeleteDialog}
        isDark={isDark}
        chatTitle={deleteDialog.chatTitle}
      />
    </>
  );
};

export default SideBar;
