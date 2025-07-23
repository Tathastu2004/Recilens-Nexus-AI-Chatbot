"use client";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar.jsx";
import {
  IconArrowLeft,
  IconSettings,
  IconUserBolt,
  IconMessagePlus,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils.js";
import { useUser } from "../context/UserContext.jsx";

const SideBar = () => {
  const [chats, setChats] = useState([]); // State for previous chats
  const { user, logoutUser } = useUser(); // Get user data and logout function
  const navigate = useNavigate();

  // Handle logout
  const handleLogout = async () => {
    try {
      const result = await logoutUser();
      console.log('Logout result:', result);
      
      // Always redirect to signup after logout, regardless of success/failure
      navigate('/signup');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to signup even if there's an error
      navigate('/signup');
    }
  };

  const links = [
    {
      label: "New Chat",
      href: "#",
      icon: (
        <IconMessagePlus className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: (
        <IconUserBolt className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Settings",
      href: "#",
      icon: (
        <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Logout",
      href: "#",
      icon: (
        <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
      onClick: handleLogout, // Add onClick handler for logout
    },
  ];

  const [open, setOpen] = useState(true);
  
  return (
    <div className="h-screen w-full">
      <Sidebar open={open} setOpen={setOpen} animate={true}>
        <SidebarBody className="flex flex-col h-full justify-between gap-2">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />

            {/* New Chat Button */}
            <div className="mt-8 mb-4">
              <SidebarLink
                link={links[0]}
                className="bg-primary/10 hover:bg-primary/20 transition-colors"
              />
            </div>

            {/* Previous Chats Section */}
            <div className="flex-1 overflow-y-auto">
              <div className="text-sm text-muted-foreground px-2 mb-2">
                Previous Chats
              </div>
              <div className="space-y-2">
                {chats.map((chat, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 text-sm hover:bg-primary/10 rounded-md cursor-pointer"
                  >
                    {chat.title}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Navigation */}
            <div className="mt-auto pt-4 border-t border-border">
              {links.slice(1).map((link, idx) => (
                <SidebarLink 
                  key={idx} 
                  link={link}
                  onClick={link.onClick} // Pass onClick handler if it exists
                />
              ))}
            </div>
          </div>

          {/* User Profile */}
          <div>
            <SidebarLink
              link={{
                label: user?.name || "User Name", // Use actual user name from context
                href: "#",
                icon: (
                  <img
                    src={user?.profilePicture || "https://assets.aceternity.com/manu.png"}
                    className="h-7 w-7 shrink-0 rounded-full"
                    width={50}
                    height={50}
                    alt="Avatar"
                  />
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
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
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