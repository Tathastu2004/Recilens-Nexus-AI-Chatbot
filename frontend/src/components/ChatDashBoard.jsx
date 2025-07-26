"use client";
import React, { useState, useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck, IconWaveSquare } from "@tabler/icons-react";
import { io } from "socket.io-client";
import axios from "axios";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000");

const ChatDashBoard = ({ selectedSession, onSessionUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const userId = JSON.parse(localStorage.getItem("user"))?._id;
  const token = localStorage.getItem("token");
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // Speech recognition hook
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // Handle session selection
  useEffect(() => {
    if (selectedSession === 'new') {
      createNewSession();
    } else if (selectedSession) {
      setCurrentSession(selectedSession);
      fetchMessages(selectedSession);
    }
  }, [selectedSession]);

  // Socket connection for current session
  useEffect(() => {
    if (!currentSession) return;

    console.log("🌀 [Socket] Joining session:", currentSession);
    socket.emit("join-session", currentSession);

    socket.on("receive-message", (msg) => {
      console.log("📨 [Socket] Received message:", msg);
      setMessages((prev) => [...prev, msg]);
      setIsTyping(false);
    });

    // Listen for session updates
    socket.on("session-updated", (updatedSession) => {
      console.log("📝 [Socket] Session updated:", updatedSession);
      if (onSessionUpdate) {
        onSessionUpdate(updatedSession);
      }
    });

    return () => {
      socket.off("receive-message");
      socket.off("session-updated");
    };
  }, [currentSession, onSessionUpdate]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update input field with transcript in real-time
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const createNewSession = async () => {
    try {
      console.log("🆕 [ChatDashBoard] Creating new session...");
      
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

      const newSession = res.data.session || res.data;
      console.log("✅ [ChatDashBoard] New session created:", newSession);
      
      setCurrentSession(newSession._id);
      setMessages([]);

      // Notify parent about new session
      if (onSessionUpdate) {
        onSessionUpdate(newSession);
      }
    } catch (err) {
      console.error("❌ [ChatDashBoard] Failed to create session:", err);
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      console.log("📥 [ChatDashBoard] Fetching messages for session:", sessionId);
      
      const res = await axios.get(
        `${backendUrl}/api/chat/messages/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      console.log("📦 [ChatDashBoard] Fetched messages:", res.data);
      setMessages(res.data || []);
    } catch (err) {
      console.error("❌ [ChatDashBoard] Failed to fetch messages:", err);
      setMessages([]);
    }
  };

  const updateSessionTitle = async (sessionId, firstMessage) => {
    try {
      const title = firstMessage.length > 30 
        ? `${firstMessage.substring(0, 30)}...` 
        : firstMessage;

      const res = await axios.patch(
        `${backendUrl}/api/chat/session/${sessionId}`,
        { title },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("✅ [ChatDashBoard] Session title updated:", title);
      
      // Get the updated session from response
      const updatedSession = res.data.session;
      
      // Emit socket event for real-time updates
      socket.emit("session-title-updated", updatedSession);
      
      // Notify parent component
      if (onSessionUpdate) {
        onSessionUpdate(updatedSession);
      }
    } catch (err) {
      console.error("❌ [ChatDashBoard] Failed to update session title:", err);
    }
  };

  // Voice input handlers
  const startListening = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }
    
    resetTranscript();
    SpeechRecognition.startListening({ 
      continuous: true,
      language: 'en-US'
    });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  const handleVoiceInput = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!currentSession) return;

    const originalInput = input;
    let fileUrl = null;
    let fileType = null;

    // Clear form immediately for better UX
    setInput("");
    setFile(null);
    resetTranscript(); // Clear any remaining transcript
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    // Show typing indicator
    setIsTyping(true);

    // Handle file upload
    if (file) {
      try {
        console.log("📤 [Upload] Starting file upload:", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        });

        const formData = new FormData();
        formData.append("file", file);

        const res = await axios.post(`${backendUrl}/api/chat/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        if (res.data.success) {
          fileUrl = res.data.fileUrl || res.data.url;
          fileType = file.type.startsWith("image") ? "image" : "document";
        } else {
          throw new Error(res.data.message || "Upload failed");
        }
      } catch (err) {
        console.error("❌ [Upload Error]:", err);
        alert(`File upload failed: ${err.response?.data?.message || err.message}`);
        setIsTyping(false);
        return;
      }
    }

    // Create message payload
    const messagePayload = {
      sessionId: currentSession,
      senderId: userId,
      message: originalInput,
      type: file ? fileType : "text",
      fileUrl,
      fileType,
      timestamp: new Date().toISOString()
    };

    console.log("📤 [Socket] Sending message:", messagePayload);

    // Send via socket
    socket.emit("send-message", messagePayload);

    // Update session title if this is the first message
    if (messages.length === 0 && originalInput.trim()) {
      updateSessionTitle(currentSession, originalInput.trim());
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {currentSession ? `Chat Session` : 'Select a Chat'}
          </h2>
          {currentSession && (
            <div className="text-sm text-gray-500">
              Session ID: {currentSession.substring(0, 8)}...
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <IconRobot size={48} className="mx-auto text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700">
                {currentSession ? "How can I help you today?" : "No session selected"}
              </h3>
              {currentSession && (
                <p className="text-sm text-gray-500">
                  Start typing your first message or use voice input...
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isUser = msg.sender === userId || msg.senderId === userId;
              return (
                <div
                  key={index}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      isUser
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.type === "text" && <p>{msg.message}</p>}

                    {msg.type === "image" && (
                      <div>
                        {msg.message && <p className="mb-2">{msg.message}</p>}
                        <img
                          src={msg.fileUrl}
                          alt="Uploaded"
                          className="max-w-xs rounded cursor-pointer"
                          onClick={() => window.open(msg.fileUrl, '_blank')}
                        />
                      </div>
                    )}

                    {msg.type === "document" && (
                      <div>
                        {msg.message && <p className="mb-2">{msg.message}</p>}
                        <a
                          href={msg.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 underline text-sm hover:opacity-80"
                        >
                          <span>📎</span>
                          <span>View Document</span>
                        </a>
                      </div>
                    )}

                    <div className="text-xs opacity-70 mt-1">
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
                  <div className="flex items-center space-x-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">Sending...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      {currentSession && (
        <div className="border-t border-gray-200 p-4">
          {/* File Preview */}
          {file && (
            <div className="mb-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
              <span className="text-sm text-gray-600">
                📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
              <button
                onClick={() => {
                  setFile(null);
                  document.getElementById("fileUpload").value = "";
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                ✕ Remove
              </button>
            </div>
          )}

          {/* Voice Recognition Status */}
          {listening && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <IconWaveSquare className="h-4 w-4 text-blue-600 animate-pulse" />
                <span className="text-sm text-blue-600">
                  Listening... Click the checkmark to stop recording
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            {/* File Upload */}
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="fileUpload"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <label
              htmlFor="fileUpload"
              className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Upload file"
            >
              <IconUpload className="text-gray-600" />
            </label>

            {/* Voice Input Button */}
            <div className="relative">
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  listening 
                    ? 'bg-green-100 hover:bg-green-200 border-2 border-green-300' 
                    : 'hover:bg-gray-100'
                }`}
                title={listening ? "Stop Recording (Click ✓)" : "Start Voice Input"}
                disabled={!browserSupportsSpeechRecognition}
              >
                {listening ? (
                  <IconCheck className="text-green-600 h-5 w-5" />
                ) : (
                  <IconMicrophone className={`h-5 w-5 ${
                    browserSupportsSpeechRecognition ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                )}
              </button>

              {/* Voice Visualizer */}
              {listening && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
                  <div className="flex space-x-1 items-end h-8">
                    {[...Array(7)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-full animate-pulse"
                        style={{ 
                          height: `${Math.random() * 24 + 8}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.8s'
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 text-center mt-1">
                    Recording...
                  </div>
                </div>
              )}
            </div>

            {/* Text Input Field */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                listening 
                  ? "Listening to your voice..." 
                  : browserSupportsSpeechRecognition 
                    ? "Type a message or use voice input..."
                    : "Type a message..."
              }
              className={`flex-1 p-2 border rounded-lg focus:outline-none transition-colors ${
                listening 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              disabled={isTyping}
            />

            {/* Send Button */}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              disabled={(!input.trim() && !file) || isTyping}
              title="Send message"
            >
              <IconSend size={20} />
            </button>
          </form>

          {/* Browser Support Warning */}
          {!browserSupportsSpeechRecognition && (
            <div className="mt-2 text-xs text-gray-500">
              Voice input not supported in this browser. Try Chrome or Edge.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatDashBoard;
