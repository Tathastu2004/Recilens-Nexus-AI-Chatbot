import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";

const features = [
  "Authentication with Email Verification",
  "Real-Time Chat (Socket.IO)",
  "User Profile & Photo Upload",
  "Admin Dashboard",
  "File Uploads (Cloudinary)",
  "Role-Based Access & Protected Routes"
];

const LandingPage = () => {
  const [bgPos, setBgPos] = useState("0% 50%");
  const [transition, setTransition] = useState("background-position 2s cubic-bezier(0.4,0,0.2,1)");
  const containerRef = useRef(null);

  // Mouse movement handler
  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.round((x / rect.width) * 100);
    setBgPos(`${percent}% 50%`);
  };

  // On mouse enter, speed up transition
  const handleMouseEnter = () => {
    setTransition("background-position 0.3s cubic-bezier(0.4,0,0.2,1)");
  };

  // On mouse leave, slow down transition and reset position
  const handleMouseLeave = () => {
    setTransition("background-position 2s cubic-bezier(0.4,0,0.2,1)");
    setBgPos("0% 50%");
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full flex flex-col items-center justify-center min-h-screen overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(90deg, #000 0%, #222 50%, #000 100%)",
        backgroundSize: "200% 200%",
        backgroundPosition: bgPos,
        transition: transition,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated Gradient Heading */}
      <h1 className="text-6xl md:text-7xl font-extrabold text-center bg-gradient-to-r from-white via-gray-400 to-white bg-clip-text text-transparent animate-gradient-x drop-shadow-lg mt-32">
        Nexus AI Chatbot
      </h1>
      <p className="mt-8 text-xl text-gray-300 text-center max-w-2xl">
        Smart, secure, and real-time chat for everyone.
      </p>

      {/* Animated Divider */}
      <div className="w-1/2 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-30 my-12 animate-pulse"></div>

      {/* Feature List */}
      <ul className="text-gray-200 text-lg space-y-2 mb-12 text-center max-w-xl mx-auto">
        {features.map((feature, idx) => (
          <li key={idx} className="py-1 border-b border-white/10 last:border-b-0">{feature}</li>
        ))}
      </ul>

      {/* Buttons */}
      <div className="flex gap-6 mt-4 flex-wrap justify-center">
        <Link to="/signup" className="px-8 py-3 rounded-full border border-white text-black bg-white hover:bg-gray-100 hover:text-black transition font-semibold shadow-lg">Sign Up</Link>
        <Link to="/login" className="px-8 py-3 rounded-full border border-white text-black bg-white hover:bg-gray-100 hover:text-black transition font-semibold shadow-lg">Sign In</Link>
        <Link to="/chat" className="px-8 py-3 rounded-full border border-white text-black bg-white hover:bg-gray-100 hover:text-black transition font-semibold shadow-lg">Try Chat</Link>
      </div>

      <footer className="mt-20 text-gray-500 text-sm font-semibold drop-shadow-lg z-10 text-center">
        &copy; {new Date().getFullYear()} Nexus AI Chatbot. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
