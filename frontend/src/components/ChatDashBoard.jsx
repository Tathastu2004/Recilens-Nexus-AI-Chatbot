"use client";
import React, { useState, useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck } from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useChat } from '../context/ChatContext';

const ChatDashBoard = ({ selectedSession, onSessionUpdate }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");
  const userId = JSON.parse(localStorage.getItem("user"))?._id;

  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false); // ✅ ADD THIS
  const [lastProcessedSession, setLastProcessedSession] = useState(null); // ✅ ADD THIS
  const messagesEndRef = useRef(null);

  // ✅ SIMPLIFIED CHAT CONTEXT USAGE
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
  } catch (error) {
    chatContextAvailable = false;
  }

  const {
    socket,
    currentSessionId: contextSessionId,
    setSession,
    sendMessage,
    getCurrentSessionMessages,
    setSessionMessages,
    isConnected: contextIsConnected,
  } = chatContext || {};

  const actualCurrentSessionId = chatContextAvailable ? contextSessionId : currentSessionId;
  const actualIsConnected = chatContextAvailable ? (contextIsConnected ?? false) : isConnected;
  const actualMessages = chatContextAvailable ? (getCurrentSessionMessages ? getCurrentSessionMessages() : []) : messages;

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // ✅ CONNECTION STATUS
  useEffect(() => {
    if (chatContextAvailable) {
      setIsConnected(contextIsConnected ?? false);
    } else {
      setIsConnected(true);
    }
  }, [chatContextAvailable, contextIsConnected]);

  // ✅ SCROLL TO BOTTOM
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [actualMessages, isTyping]);

  // ✅ COMPLETELY REWRITTEN SESSION SELECTION LOGIC - NO MORE RECURSION
  useEffect(() => {
    // ✅ GUARD: Prevent processing the same session multiple times
    if (selectedSession === lastProcessedSession) {
      return;
    }

    // ✅ GUARD: Prevent processing during session creation
    if (isCreatingSession) {
      return;
    }

    // ✅ GUARD: Skip empty or invalid sessions
    if (!selectedSession || selectedSession === 'null' || selectedSession === 'undefined') {
      setLastProcessedSession(selectedSession);
      return;
    }

    console.log('🔄 [SESSION SELECTION] Processing session:', {
      selectedSession,
      lastProcessedSession,
      isCreatingSession,
      actualCurrentSessionId
    });

    // ✅ HANDLE NEW SESSION CREATION (only once)
    if (selectedSession.startsWith('new-')) {
      console.log('🆕 [SESSION SELECTION] Creating new session for:', selectedSession);
      setLastProcessedSession(selectedSession); // ✅ Mark as processed IMMEDIATELY
      createNewSession();
      return;
    }

    // ✅ HANDLE EXISTING SESSION SWITCH
    if (selectedSession !== actualCurrentSessionId) {
      console.log('🔗 [SESSION SELECTION] Switching to existing session:', {
        from: actualCurrentSessionId,
        to: selectedSession
      });
      
      setLastProcessedSession(selectedSession); // ✅ Mark as processed IMMEDIATELY
      
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      } else {
        setCurrentSessionId(selectedSession);
      }
      fetchMessages(selectedSession);
    } else {
      // ✅ Same session, just mark as processed
      setLastProcessedSession(selectedSession);
    }

  }, [selectedSession]); // ✅ ONLY selectedSession dependency

  // ✅ COMPLETELY REWRITTEN createNewSession - NO RECURSION
  const createNewSession = async () => {
    // ✅ PREVENT MULTIPLE CONCURRENT CREATIONS
    if (isCreatingSession) {
      console.log('⚠️ [CREATE SESSION] Already creating session, skipping...');
      return;
    }
    
    console.log('🆕 [CREATE SESSION] Starting session creation...');
    setIsCreatingSession(true);
    
    try {
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
      console.log('✅ [CREATE SESSION] Session created:', newSession._id);
      
      // ✅ IMMEDIATELY SET THE SESSION TO PREVENT RECURSION
      if (chatContextAvailable && setSession) {
        setSession(newSession._id);
      } else {
        setCurrentSessionId(newSession._id);
      }
      
      // ✅ UPDATE PARENT COMPONENT
      if (onSessionUpdate) {
        onSessionUpdate(newSession);
      }

      // ✅ CLEAR MESSAGES FOR NEW SESSION
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(newSession._id, []);
      } else {
        setMessages([]);
      }

      // ✅ UPDATE LAST PROCESSED TO PREVENT REPROCESSING
      setLastProcessedSession(newSession._id);
      
    } catch (err) {
      console.error('❌ [CREATE SESSION] Failed:', err);
      alert(`Failed to create new session: ${err.response?.data?.message || err.message}`);
      
      // ✅ RESET LAST PROCESSED ON ERROR
      setLastProcessedSession(null);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const res = await axios.get(
        `${backendUrl}/api/chat/messages/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const fetchedMessages = res.data || [];
      
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(sessionId, fetchedMessages);
      } else {
        setMessages(fetchedMessages);
      }
    } catch (err) {
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(sessionId, []);
      } else {
        setMessages([]);
      }
    }
  };

  const fallbackSendMessage = async (messagePayload) => {
    try {
      setIsConnected(true);
      
      const response = await axios.post(
        `${backendUrl}/api/chat/message`,
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      setIsConnected(true);
      
      if (response.data.success && response.data.data) {
        const { userMessage, aiResponse } = response.data.data;
        const messagesToAdd = [];
        
        if (userMessage) {
          messagesToAdd.push({
            _id: userMessage._id,
            message: userMessage.message,
            sender: typeof userMessage.sender === 'object' ? 'user' : userMessage.sender,
            type: userMessage.type,
            fileUrl: userMessage.fileUrl,
            timestamp: userMessage.timestamp
          });
        }
        
        if (aiResponse) {
          messagesToAdd.push({
            _id: aiResponse._id,
            message: aiResponse.message,
            sender: aiResponse.sender,
            type: aiResponse.type,
            timestamp: aiResponse.timestamp
          });
        }
        
        setMessages(prev => [...prev, ...messagesToAdd]);
      }
      
      return { success: true, latency: 0 };
    } catch (error) {
      setIsConnected(false);
      
      const newMessage = {
        ...messagePayload,
        _id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        sender: 'user',
        status: 'failed'
      };
      
      setMessages(prev => [...prev, newMessage]);
      return { success: false, error: error.message };
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
      
      const updatedSession = res.data.session;
      if (onSessionUpdate) {
        onSessionUpdate(updatedSession);
      }
    } catch (err) {
      // Silent fail for title update
    }
  };

  const handleVoiceInput = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }
    
    if (listening) {
      SpeechRecognition.stopListening();
      if (transcript) {
        setInput(transcript);
      }
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ 
        continuous: true,
        language: 'en-US'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!actualCurrentSessionId) return;

    const originalInput = input;
    let fileUrl = null;
    let fileType = null;

    let actualUserId = null;
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        actualUserId = user._id;
      }
    } catch (parseError) {
      // Handle error silently
    }

    if (!actualUserId) {
      alert('Please log in again to send messages.');
      window.location.href = '/signup';
      return;
    }

    // Clear form
    setInput("");
    setFile(null);
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    setIsTyping(true);

    // Handle file upload
    if (file) {
      setIsUploading(true);
      
      try {
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
        alert(`File upload failed: ${err.response?.data?.message || err.message}`);
        setIsTyping(false);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const messagePayload = {
      sessionId: actualCurrentSessionId,
      senderId: actualUserId,
      message: originalInput,
      type: file ? fileType : "text",
      fileUrl,
      fileType,
      timestamp: new Date().toISOString(),
      metadata: {
        isVoiceInput: !!transcript,
        browserInfo: navigator.userAgent,
        connectionStatus: actualIsConnected
      }
    };

    try {
      let sendResult;
      
      if (chatContextAvailable && sendMessage) {
        sendResult = await sendMessage(messagePayload);
      } else {
        sendResult = await fallbackSendMessage(messagePayload);
      }
      
      if (sendResult.success) {
        // Update session title if first message
        if (actualMessages.length === 0 && originalInput.trim()) {
          updateSessionTitle(actualCurrentSessionId, originalInput.trim());
        }
      } else {
        throw new Error(sendResult.error || 'Failed to send message');
      }
    } catch (error) {
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ✅ SIMPLIFIED HEADER */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Chat Dashboard
          </h2>
          <div className={`text-xs px-2 py-1 rounded-full ${
            actualIsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {actualIsConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {actualMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <IconRobot size={48} className="mx-auto text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700">
                Ready to chat!
              </h3>
              <p className="text-sm text-gray-500">
                Start typing your message or use voice input...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {actualMessages.map((msg, index) => (
              <div 
                key={msg._id || index} 
                className={`flex ${msg.sender === 'AI' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.sender === 'AI' 
                    ? 'bg-gray-100 text-gray-800' 
                    : msg.status === 'failed'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-blue-500 text-white'
                }`}>
                  <div className="text-sm font-medium mb-1">
                    {msg.sender === 'AI' ? '🤖 AI Assistant' : '👤 You'}
                    {msg.status === 'failed' && <span className="ml-1">⚠️</span>}
                  </div>
                  <div className="text-sm">
                    {msg.message}
                  </div>
                  {msg.fileUrl && (
                    <div className="mt-2">
                      {msg.type === 'image' ? (
                        <img src={msg.fileUrl} alt="Uploaded" className="max-w-full h-auto rounded" />
                      ) : (
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">
                          📎 View File
                        </a>
                      )}
                    </div>
                  )}
                  <div className="text-xs mt-1 opacity-70">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                    {msg.status === 'failed' && <span className="ml-1 text-red-600">Failed to send</span>}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <div className="text-sm text-gray-600">AI is typing...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
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
            className="cursor-pointer p-2 rounded-lg hover:bg-gray-100"
            title="Upload file"
          >
            <IconUpload className="text-gray-600" />
          </label>

          {/* Voice Input */}
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-2 rounded-lg transition-all duration-200 ${
              listening 
                ? 'bg-green-100 hover:bg-green-200 border-2 border-green-300' 
                : 'hover:bg-gray-100'
            }`}
            title={listening ? "Stop Recording" : "Start Voice Input"}
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

          {/* Text Input */}
          <input
            type="text"
            value={input || transcript}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              !actualIsConnected
                ? "Connection lost - messages may not send..."
                : listening 
                  ? "Listening to your voice..." 
                  : browserSupportsSpeechRecognition 
                    ? "Type a message or use voice input..."
                    : "Type a message..."
            }
            className={`flex-1 p-2 border rounded-lg focus:outline-none transition-colors ${
              !actualIsConnected
                ? 'border-red-300 bg-red-50'
                : listening 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-300 focus:border-blue-500'
            }`}
          />

          {/* Send Button */}
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg transition-colors ${
              !actualIsConnected
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } disabled:opacity-50`}
            disabled={(!input.trim() && !file) || isUploading || !actualIsConnected}
            title={!actualIsConnected ? "Cannot send - disconnected" : "Send message"}
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <IconSend size={20} />
            )}
          </button>
        </form>

        {/* Status Messages */}
        {!actualIsConnected && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            ⚠️ Connection lost. Messages may not be sent or received.
          </div>
        )}

        {file && (
          <div className="mt-2 text-sm text-gray-600">
            📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        {!browserSupportsSpeechRecognition && (
          <div className="mt-2 text-xs text-gray-500">
            Voice input not supported in this browser. Try Chrome or Edge.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDashBoard;
