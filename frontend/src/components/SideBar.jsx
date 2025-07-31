"use client";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
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

const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000");

const SideBar = ({ onSelectSession, onToggle, selectedSessionId, onSessionDelete }) => {
  const [chats, setChats] = useState([]);
  const { user, logoutUser, loading } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState(null);
  const [deletingChat, setDeletingChat] = useState(null);
  const [creatingChat, setCreatingChat] = useState(false); // ✅ ADD STATE FOR CREATING
  const operationInProgress = useRef(false); // ✅ PREVENT DUPLICATE OPERATIONS
  const [refreshTrigger, setRefreshTrigger] = useState(0); // ✅ ADD REFRESH TRIGGER STATE

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // ✅ OPTIMIZED FETCH CHATS WITH CACHING
  const fetchChats = async (useCache = true) => {
    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.warn("⚠️ No authentication token found");
        setChats([]);
        return;
      }

      console.log("📤 [SideBar] Fetching sessions...");

      const res = await fetch(`${backendUrl}/api/chat/sessions`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        cache: useCache ? 'default' : 'no-cache'
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("📦 [SideBar] Chat sessions loaded:", data.length);

      if (Array.isArray(data)) {
        setChats(data);
      } else {
        setChats([]);
      }
    } catch (error) {
      console.error("❌ Failed to fetch chat sessions:", error.message);
      setChats([]);
    }
  };

  // ✅ INITIAL FETCH
  useEffect(() => {
    fetchChats();
  }, [backendUrl]);

  // ✅ OPTIMIZED SOCKET LISTENERS - PREVENT DUPLICATES
  useEffect(() => {
    // ✅ IMMEDIATE UI UPDATE FOR NEW SESSIONS
    const handleNewSession = (newSession) => {
      console.log("🆕 [SideBar] New session via socket:", newSession);
      setChats((prevChats) => {
        // ✅ PREVENT DUPLICATES
        const exists = prevChats.some(chat => chat._id === newSession._id);
        if (exists) return prevChats;
        return [newSession, ...prevChats];
      });
    };

    // ✅ IMMEDIATE UI UPDATE FOR SESSION UPDATES
    const handleSessionUpdate = (updatedSession) => {
      console.log("📝 [SideBar] Session updated via socket:", updatedSession);
      setChats((prevChats) => {
        return prevChats.map((chat) =>
          chat._id === updatedSession._id ? { ...chat, ...updatedSession } : chat
        );
      });
    };

    // ✅ IMMEDIATE UI UPDATE FOR DELETIONS
    const handleSessionDelete = (deletedSessionId) => {
      console.log("🗑️ [SideBar] Session deleted via socket:", deletedSessionId);
      setChats((prevChats) => prevChats.filter(chat => chat._id !== deletedSessionId));
      
      // ✅ NOTIFY PARENT IF SELECTED SESSION WAS DELETED
      if (selectedSessionId === deletedSessionId && onSessionDelete) {
        onSessionDelete(deletedSessionId);
      }
    };

    socket.on("new-session-created", handleNewSession);
    socket.on("session-updated", handleSessionUpdate);
    socket.on("session-deleted", handleSessionDelete);

    return () => {
      socket.off("new-session-created", handleNewSession);
      socket.off("session-updated", handleSessionUpdate);
      socket.off("session-deleted", handleSessionDelete);
    };
  }, [selectedSessionId, onSessionDelete]);

  // ✅ OPTIMIZED NEW CHAT CREATION
  const handleNewChat = async () => {
    // ✅ PREVENT MULTIPLE CONCURRENT OPERATIONS
    if (operationInProgress.current || creatingChat) {
      console.log('⚠️ [SIDEBAR] Operation already in progress, skipping...');
      return;
    }

    try {
      operationInProgress.current = true;
      setCreatingChat(true);

      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error("❌ No authentication token found");
        return;
      }

      console.log("📤 [SideBar] Creating new chat session...");

      const res = await axios.post(
        `${backendUrl}/api/chat/session`,
        { title: "New Chat" },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          timeout: 10000 // ✅ ADD TIMEOUT
        }
      );

      const newSession = res.data.session || res.data;
      console.log("✅ [SideBar] New chat session created:", newSession._id);
      
      // ✅ IMMEDIATE UI UPDATE
      setChats((prev) => {
        // ✅ CHECK FOR DUPLICATES
        const exists = prev.some(chat => chat._id === newSession._id);
        if (exists) return prev;
        return [newSession, ...prev];
      });
      
      // ✅ EMIT SOCKET EVENT FOR OTHER CLIENTS
      socket.emit("new-session-created", newSession);
      
      // ✅ NOTIFY PARENT TO SELECT NEW SESSION
      if (onSelectSession) {
        onSelectSession(newSession._id);
      }

      // ✅ NOTIFY CHAT INTERFACE
      window.dispatchEvent(new CustomEvent('newSessionCreated', { 
        detail: { sessionId: newSession._id, session: newSession }
      }));
      
    } catch (err) {
      console.error("❌ Failed to create chat:", err.message);
      alert("Failed to create new chat. Please try again.");
    } finally {
      operationInProgress.current = false;
      setCreatingChat(false);
    }
  };

  // ✅ OPTIMIZED DELETE CHAT
  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    
    // ✅ PREVENT MULTIPLE OPERATIONS
    if (operationInProgress.current || deletingChat) {
      return;
    }
    
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return;
    }

    try {
      operationInProgress.current = true;
      setDeletingChat(chatId);
      
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error("❌ No authentication token found");
        return;
      }

      console.log("🗑️ [SideBar] Deleting chat session:", chatId);

      // ✅ IMMEDIATE UI UPDATE (OPTIMISTIC)
      setChats((prev) => prev.filter(chat => chat._id !== chatId));
      
      // ✅ NOTIFY PARENT IMMEDIATELY
      if (selectedSessionId === chatId && onSessionDelete) {
        onSessionDelete(chatId);
      }

      const res = await axios.delete(
        `${backendUrl}/api/chat/session/${chatId}`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );

      console.log("✅ Chat session deleted successfully");
      
      // ✅ EMIT SOCKET EVENT FOR OTHER CLIENTS
      socket.emit("session-deleted", chatId);
      
    } catch (err) {
      console.error("❌ Failed to delete chat:", err.message);
      
      // ✅ ROLLBACK ON ERROR
      fetchChats(false); // Force refresh from server
      alert("Failed to delete chat. Please try again.");
    } finally {
      operationInProgress.current = false;
      setDeletingChat(null);
    }
  };

  // ✅ OPTIMIZED CHAT SELECTION
  const handleSelectChat = (sessionId) => {
    if (operationInProgress.current) return; // ✅ PREVENT DURING OPERATIONS
    
    console.log("🎯 [SideBar] Selected chat session:", sessionId);
    if (onSelectSession) {
      onSelectSession(sessionId);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await logoutUser();
      console.log("🚪 Logout result:", result);
      navigate("/signup");
    } catch (error) {
      console.error("❌ Logout error:", error);
      navigate("/signup");
    }
  };

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

  const getProfilePictureUrl = () => {
    if (!user?.profilePicture) return "https://assets.aceternity.com/manu.png";
    if (user.profilePicture.startsWith("http")) return user.profilePicture;
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    return `${baseUrl}${user.profilePicture}`;
  };

  const handleToggle = (newOpenState) => {
    setOpen(newOpenState);
    if (onToggle) {
      onToggle(newOpenState);
    }
  };

  // ✅ ADD THIS TO YOUR SIDEBAR COMPONENT (if it exists)
  useEffect(() => {
    const handleSessionCreated = (event) => {
      console.log('🎉 [SIDEBAR] New session created, updating UI');
      // Force re-render or refresh session list
      setRefreshTrigger(prev => prev + 1); // If you have a refresh trigger state
    };

    window.addEventListener('sessionCreated', handleSessionCreated);
    window.addEventListener('newSessionCreated', handleSessionCreated);
    
    return () => {
      window.removeEventListener('sessionCreated', handleSessionCreated);
      window.removeEventListener('newSessionCreated', handleSessionCreated);
    };
  }, []);

  return (
    <div className="h-screen w-full">
      <Sidebar open={open} setOpen={handleToggle} animate={true}>
        <SidebarBody className="flex flex-col h-full justify-between gap-2">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />

            <div className="mt-8 mb-4">
              <SidebarLink
                link={links[0]}
                onClick={links[0].disabled ? undefined : links[0].onClick}
                className={`transition-colors ${
                  links[0].disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'bg-primary/10 hover:bg-primary/20'
                }`}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {open && (
                <>
                  <div className="text-sm text-muted-foreground px-2 mb-2">
                    Previous Chats ({chats.length})
                  </div>
                  <div className="space-y-2">
                    {chats.length === 0 ? (
                      <div className="text-xs text-gray-500 px-2 py-1">
                        No previous chats
                      </div>
                    ) : (
                      chats.map((chat) => (
                        <div
                          key={chat._id}
                          onClick={() => handleSelectChat(chat._id)}
                          onMouseEnter={() => setHoveredChat(chat._id)}
                          onMouseLeave={() => setHoveredChat(null)}
                          className={`px-2 py-1 text-sm hover:bg-primary/10 rounded-md cursor-pointer transition-colors flex items-center justify-between group ${
                            selectedSessionId === chat._id ? 'bg-primary/20 font-medium' : ''
                          }`}
                        >
                          <span className="truncate">
                            {chat.title || "Untitled Chat"}
                          </span>
                          {hoveredChat === chat._id && !operationInProgress.current && (
                            <button
                              onClick={(e) => handleDeleteChat(e, chat._id)}
                              disabled={deletingChat === chat._id}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

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
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
    </div>
  );
};

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
