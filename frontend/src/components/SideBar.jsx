"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconMessageCircle,
  IconUserBolt,
  IconMessagePlus,
  IconTrash,
  IconBolt,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils.js";
import { useClerkUser } from "../context/ClerkUserContext";
import { useChat } from "../context/ChatContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from '@clerk/clerk-react';

// ✅ UTILITY FUNCTIONS (unchanged)
const formatChatTitle = (chat) => {
  if (!chat) return "New Chat";
  
  if (chat.title && chat.title !== "New Chat" && chat.title.trim() !== "") {
    return chat.title.length > 25 ? chat.title.substring(0, 25) + "..." : chat.title;
  }
  
  if (chat.messages && chat.messages.length > 0) {
    const firstUserMessage = chat.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      const content = firstUserMessage.content.trim();
      if (content.length > 0) {
        return content.length > 25 ? content.substring(0, 25) + "..." : content;
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

// ✅ REDESIGNED DELETE CONFIRMATION DIALOG
const DeleteConfirmationDialog = ({ isOpen, onConfirm, onCancel, isDark, chatTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 backdrop-blur-sm transition-opacity"
        style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}
        onClick={onCancel}
      ></div>
      
      <div className="relative w-full max-w-md mx-auto rounded-2xl shadow-2xl transition-all transform scale-100"
           style={{ 
             backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
             border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
           }}>
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full"
               style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }}>
            <IconAlertTriangle size={24} style={{ color: '#ef4444' }} />
          </div>
          
          <h3 className="text-lg font-semibold text-center mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Delete Chat Session
          </h3>
          
          <p className="text-sm text-center mb-6 leading-relaxed"
             style={{ color: isDark ? '#d1d5db' : '#6b7280' }}>
            Are you sure you want to delete "{chatTitle}"? This action cannot be undone.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#d1d5db' : '#374151',
                border: 'none'
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

const SideBar = ({ onSelectSession, onToggle, selectedSessionId, onSessionDelete, isMobileMenuOpen, onMobileMenuClose }) => {
  const [chats, setChats] = useState([]);
  const { clerkUser, dbUser, loading, isAuthenticated } = useClerkUser();
  const { getToken } = useAuth();
  const { isDark } = useTheme();
  
  const user = dbUser || {
    _id: clerkUser?.id,
    name: `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() || clerkUser?.username || 'User',
    email: clerkUser?.primaryEmailAddress?.emailAddress,
    profilePicture: clerkUser?.imageUrl,
    role: 'client'
  };

  const navigate = useNavigate();
  
  // State management
  const [isOpen, setIsOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState(null);
  const [deletingChat, setDeletingChat] = useState(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs
  const operationInProgress = useRef(false);
  const hoverTimeoutRef = useRef(null);
  const stateChangeTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);
  const lastStateChangeRef = useRef(Date.now());

  // Delete dialog state
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

  // ✅ STABLE LOGOUT FUNCTION
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

  // Chat context integration
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

  // Sidebar toggle handlers
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

  // Cleanup timeouts
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
      
      const token = await getAuthToken();
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
          Authorization: `Bearer ${token}`,
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

      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication required. Please sign in again.");
      }

      console.log('🆕 [SIDEBAR] Creating new chat with Clerk token...');

      const res = await fetch(`${backendUrl}/api/chat/session`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
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

  // Delete dialog handlers
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
      
      const token = await getAuthToken();
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
          Authorization: `Bearer ${token}`,
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

  // Rest of the handlers
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

  // Links definition
  const links = [
    {
      label: creatingChat ? "Creating..." : "New Chat",
      href: "#",
      icon: creatingChat ? (
        <div className="animate-spin rounded-full h-5 w-5"
             style={{ 
               border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
               borderTopColor: isDark ? '#ffffff' : '#000000'
             }}></div>
      ) : (
        <IconMessagePlus className="h-5 w-5 shrink-0"
                        style={{ color: '#ffffff' }} />
      ),
      onClick: handleNewChat,
      disabled: creatingChat || operationInProgress.current
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <IconUserBolt className="h-5 w-5 shrink-0"
                          style={{ color: isDark ? '#ffffff' : '#000000' }} />,
    },
    {
      label: "Feedback",
      href: "/feedback",
      icon: <IconMessageCircle className="h-5 w-5 shrink-0"
                              style={{ color: isDark ? '#ffffff' : '#000000' }} />,
    },
    {
      label: "Logout",
      href: "#",
      icon: <IconArrowLeft className="h-5 w-5 shrink-0"
                          style={{ color: '#ef4444' }} />,
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
      <div className="h-screen flex items-center justify-center"
           style={{ 
             width: '280px',
             backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa'
           }}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto"
               style={{ 
                 border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                 borderTopColor: isDark ? '#ffffff' : '#000000'
               }}></div>
          <div className="text-sm"
               style={{ color: isDark ? '#d1d5db' : '#6b7280' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ✅ REDESIGNED SIDEBAR CONTAINER */}
      <div 
        className={`h-screen transition-all duration-300 ease-in-out ${  
          isOpen ? 'w-[280px]' : 'w-[70px]'
        } overflow-hidden`}
        style={{ backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col h-full justify-between transition-all duration-300 overflow-hidden"
             style={{ 
               backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa',
               borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`
             }}>
          <div className="flex flex-1 flex-col overflow-hidden">
            
            {/* ✅ MINIMAL LOGO SECTION - Updated for mobile */}
            <div className={`relative z-20 flex items-center justify-between py-6 text-sm font-normal transition-all duration-300 ${
              isOpen ? 'px-6' : 'justify-center px-3'
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
                {isOpen && (
                  <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="font-bold text-xl truncate"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}
                  >
                    Nexus AI
                  </motion.span>
                )}
              </Link>

              {/* ✅ MOBILE CLOSE BUTTON */}
              {isMobileMenuOpen && (
                <button
                  onClick={onMobileMenuClose}
                  className="lg:hidden p-2 rounded-lg transition-all duration-200 hover:scale-105"
                  style={{
                    color: isDark ? '#ffffff' : '#000000',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* New Chat Button */}
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
                    className={`transition-all duration-200 flex items-center transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 ${
                      isOpen 
                        ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                        : 'w-12 h-12 rounded-xl justify-center'
                    }`}
                    style={{
                      backgroundColor: isDark ? '#333333' : '#000000',
                      color: '#ffffff'
                    }}
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
                    className="ml-4 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: isConnected 
                        ? isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'
                        : isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                      color: isConnected ? '#22c55e' : '#ef4444'
                    }}
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
                  className="text-xs p-4 rounded-lg mt-4"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                >
                  <div className="truncate">{error}</div>
                  <button
                    onClick={() => fetchChats(false)}
                    className="mt-2 underline hover:no-underline transition-colors text-xs"
                    style={{ color: '#ef4444' }}
                  >
                    Retry
                  </button>
                </motion.div>
              )}
            </div>

            {/* ✅ REDESIGNED CHAT SESSIONS LIST - NATURAL DESIGN */}
            <div className={`flex-1 overflow-hidden mb-6 transition-all duration-300 ${
              isOpen ? 'mx-3' : 'mx-2'
            }`}>
              {isOpen ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full flex flex-col overflow-hidden"
                >
                  {/* SESSIONS LIST */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-1">
                      {chats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                          <div className="text-4xl mb-4">💬</div>
                          <h3 className="text-base font-semibold mb-2"
                              style={{ color: isDark ? '#ffffff' : '#000000' }}>
                            No conversations yet
                          </h3>
                          <p className="text-sm mb-6 leading-relaxed"
                             style={{ color: isDark ? '#888888' : '#6b7280' }}>
                            Start a new chat to begin your AI conversation
                          </p>
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
                              className={`group relative rounded-lg transition-all duration-200 cursor-pointer px-3 py-2.5 ${
                                isStreaming ? 'animate-pulse' : ''
                              }`}
                              style={{
                                backgroundColor: isCurrentSession
                                  ? isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
                                  : hoveredChat === chat._id 
                                    ? isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'
                                    : 'transparent'
                              }}
                            >
                              <div className="flex items-center justify-between min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="font-medium text-sm truncate transition-colors duration-200"
                                          style={{ 
                                            color: isCurrentSession 
                                              ? isDark ? '#ffffff' : '#000000'
                                              : isDark ? '#cccccc' : '#333333'
                                          }}>
                                      {formatChatTitle(chat)}
                                    </span>
                                    {isStreaming && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <div className="w-1 h-1 rounded-full animate-pulse"
                                             style={{ backgroundColor: isDark ? '#ffffff' : '#000000' }}></div>
                                        <div className="w-1 h-1 rounded-full animate-pulse"
                                             style={{ 
                                               backgroundColor: isDark ? '#ffffff' : '#000000',
                                               animationDelay: '0.2s'
                                             }}></div>
                                        <div className="w-1 h-1 rounded-full animate-pulse"
                                             style={{ 
                                               backgroundColor: isDark ? '#ffffff' : '#000000',
                                               animationDelay: '0.4s'
                                             }}></div>
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
                                    className="ml-3 p-1.5 rounded-md transition-all duration-200 disabled:opacity-50 shrink-0 hover:scale-110"
                                    style={{ 
                                      color: '#ef4444',
                                      backgroundColor: 'rgba(239, 68, 68, 0.1)'
                                    }}
                                    title="Delete chat"
                                  >
                                    {deletingChat === chat._id ? (
                                      <div className="w-3 h-3 animate-spin rounded-full border border-red-500 border-t-transparent"></div>
                                    ) : (
                                      <IconTrash className="h-3 w-3" />
                                    )}
                                  </motion.button>
                                )}
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
                  <div className="text-xs px-2 py-1 rounded-full font-medium"
                       style={{
                         backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                         color: isDark ? '#ffffff' : '#000000'
                       }}>
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
                            className="w-2 h-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-110"
                            style={{ 
                              backgroundColor: isCurrentSession 
                                ? isDark ? '#ffffff' : '#000000'
                                : isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                              transform: isCurrentSession ? 'scale(1.25)' : 'scale(1)'
                            }}
                            title={formatChatTitle(chat)}
                          />
                        );
                      })}
                      
                      {chats.length > 3 && (
                        <div className="text-xs"
                             style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}>
                          ⋯
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <div className={`mt-auto pt-6 transition-all duration-300 ${
              isOpen ? 'px-6' : 'px-3'
            }`}
                 style={{ borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}` }}>
              {links.slice(1).map((link, idx) => (
                <div key={idx} className={`mb-3 flex ${isOpen ? 'justify-start' : 'justify-center'}`}>
                  <button
                    onClick={link.onClick || (() => navigate(link.href))}
                    className={`transition-all duration-200 flex items-center text-left hover:scale-105 ${
                      isOpen 
                        ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                        : 'w-12 h-12 rounded-xl justify-center'
                    }`}
                    style={{
                      backgroundColor: 'transparent',
                      color: link.label === 'Logout' ? '#ef4444' : isDark ? '#ffffff' : '#000000'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
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
          <div className={`pt-5 pb-3 transition-all duration-300 ${
            isOpen ? 'px-6' : 'px-3'
          } flex ${isOpen ? 'justify-start' : 'justify-center'}`}
               style={{ borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}` }}>
            <button
              onClick={() => navigate('/profile')}
              className={`transition-all duration-200 flex items-center text-left hover:scale-105 ${
                isOpen 
                  ? 'w-full p-3 rounded-xl gap-3 justify-start min-w-0' 
                  : 'w-12 h-12 rounded-xl justify-center p-0'
              }`}
              style={{ 
                backgroundColor: 'transparent',
                color: isDark ? '#ffffff' : '#000000'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <div className={`relative shrink-0 ${isOpen ? '' : 'flex items-center justify-center'}`}>
                <img
                  src={getProfilePictureUrl()}
                  className={`rounded-full object-cover transition-all duration-200 ${
                    isOpen ? 'h-8 w-8' : 'h-10 w-10'
                  }`}
                  style={{ border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}
                  alt="Avatar"
                  onError={(e) =>
                    (e.target.src = "https://assets.aceternity.com/manu.png")
                  }
                />
                <div className={`absolute rounded-full transition-all duration-200 ${
                  isOpen ? '-bottom-0.5 -right-0.5 w-3 h-3' : '-bottom-1 -right-1 w-4 h-4'
                }`}
                     style={{ 
                       backgroundColor: chatContextAvailable && isConnected ? '#22c55e' : '#6b7280',
                       border: `2px solid ${isDark ? '#1F1F1F' : '#f8f9fa'}`
                     }}></div>
              </div>
              
              {isOpen && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 min-w-0"
                >
                  <div className="font-medium truncate transition-colors duration-200"
                       style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {user?.name || "User Name"}
                  </div>
                  <div className="text-xs transition-colors duration-200"
                       style={{ color: isDark ? '#888888' : '#6b7280' }}>
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
