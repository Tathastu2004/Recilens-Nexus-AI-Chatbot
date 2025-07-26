"use client";
import React, { useState, useEffect } from "react";
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

const SideBar = ({ onSelectSession, onToggle, selectedSessionId }) => {
  const [chats, setChats] = useState([]);
  const { user, logoutUser, loading } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState(null);
  const [deletingChat, setDeletingChat] = useState(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // Fetch user's previous chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const token = localStorage.getItem("token");
        
        if (!token) {
          console.warn("⚠️ No authentication token found");
          setChats([]);
          return;
        }

        console.log("📤 [SideBar] Fetching sessions from:", `${backendUrl}/api/chat/sessions`);

        const res = await fetch(`${backendUrl}/api/chat/sessions`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });

        console.log("📥 [SideBar] Response status:", res.status);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log("📦 [SideBar] Chat sessions:", data);

        if (Array.isArray(data)) {
          setChats(data);
        } else {
          console.warn("⚠️ Chat sessions response is not an array:", data);
          setChats([]);
        }
      } catch (error) {
        console.error("❌ Failed to fetch chat sessions:", {
          error: error.message,
          stack: error.stack
        });
        setChats([]);
      }
    };

    fetchChats();
  }, [backendUrl]);

  // Listen for real-time session updates
  useEffect(() => {
    // Listen for session updates
    socket.on("session-updated", (updatedSession) => {
      console.log("📝 [SideBar] Session updated via socket:", updatedSession);
      setChats((prevChats) => {
        const updatedChats = prevChats.map((chat) =>
          chat._id === updatedSession._id ? updatedSession : chat
        );
        return updatedChats;
      });
    });

    // Listen for new sessions
    socket.on("new-session-created", (newSession) => {
      console.log("🆕 [SideBar] New session created via socket:", newSession);
      setChats((prevChats) => [newSession, ...prevChats]);
    });

    // Listen for session deletions
    socket.on("session-deleted", (deletedSessionId) => {
      console.log("🗑️ [SideBar] Session deleted via socket:", deletedSessionId);
      setChats((prevChats) => prevChats.filter(chat => chat._id !== deletedSessionId));
    });

    return () => {
      socket.off("session-updated");
      socket.off("new-session-created");
      socket.off("session-deleted");
    };
  }, []);

  const handleNewChat = async () => {
    try {
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
          } 
        }
      );

      console.log("✅ New chat session created:", res.data);
      
      const newSession = res.data.session || res.data;
      
      // Add to local state
      setChats((prev) => [newSession, ...prev]);
      
      // Emit socket event for other clients
      socket.emit("new-session-created", newSession);
      
      // Select the new session
      onSelectSession(newSession._id);
    } catch (err) {
      console.error("❌ Failed to create chat:", {
        error: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingChat(chatId);
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error("❌ No authentication token found");
        return;
      }

      console.log("🗑️ [SideBar] Deleting chat session:", chatId);

      const res = await axios.delete(
        `${backendUrl}/api/chat/session/${chatId}`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          } 
        }
      );

      console.log("✅ Chat session deleted:", res.data);
      
      // Remove from local state
      setChats((prev) => prev.filter(chat => chat._id !== chatId));
      
      // Emit socket event for other clients
      socket.emit("session-deleted", chatId);
      
      // If this was the selected session, clear selection
      if (selectedSessionId === chatId) {
        onSelectSession(null);
      }
      
    } catch (err) {
      console.error("❌ Failed to delete chat:", {
        error: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      alert("Failed to delete chat. Please try again.");
    } finally {
      setDeletingChat(null);
    }
  };

  const handleSelectChat = (sessionId) => {
    console.log("🧠 Selected chat session:", sessionId);
    onSelectSession(sessionId);
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
      label: "New Chat",
      href: "#",
      icon: <IconMessagePlus className="h-5 w-5 shrink-0 text-neutral-700" />,
      onClick: handleNewChat,
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

  return (
    <div className="h-screen w-full">
      <Sidebar open={open} setOpen={handleToggle} animate={true}>
        <SidebarBody className="flex flex-col h-full justify-between gap-2">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />

            <div className="mt-8 mb-4">
              <SidebarLink
                link={links[0]}
                onClick={links[0].onClick}
                className="bg-primary/10 hover:bg-primary/20 transition-colors"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {open && (
                <>
                  <div className="text-sm text-muted-foreground px-2 mb-2">
                    Previous Chats
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
                          className="px-2 py-1 text-sm hover:bg-primary/10 rounded-md cursor-pointer transition-colors flex items-center justify-between group"
                        >
                          <span className="truncate">
                            {chat.title || "Untitled Chat"}
                          </span>
                          {hoveredChat === chat._id && (
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
