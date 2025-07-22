import React from 'react';
import SideBar from '../components/SideBar';
import ChatDashBoard from '../components/ChatDashBoard';

const ChatInterface = () => {
  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className="flex-shrink-0">
        <SideBar />
      </div>

      {/* Chat Dashboard */}
      <div className="flex-grow">
        <ChatDashBoard />
      </div>
    </div>
  );
};

export default ChatInterface;