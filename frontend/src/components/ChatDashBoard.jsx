"use client";
import React, { useState, useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck, IconWaveSquare } from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { debugAuth } from '../utils/authDebug';
import { useChat } from '../context/ChatContext'; // ✅ Direct import

const ChatDashBoard = ({ selectedSession, onSessionUpdate }) => {
  // ✅ MOVE THESE DECLARATIONS TO THE TOP
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
  const messagesEndRef = useRef(null);

  // ✅ DIRECTLY USE CHAT CONTEXT - NO COMPLEX DETECTION
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
    console.log('✅ [CHAT DASHBOARD] ChatContext available - using real-time mode');
  } catch (error) {
    console.warn('⚠️ [CHAT DASHBOARD] ChatContext not available, using fallback mode:', error.message);
    chatContextAvailable = false;
  }

  // ✅ USE CHAT CONTEXT IF AVAILABLE, OTHERWISE USE LOCAL STATE
  const {
    socket,
    currentSessionId: contextSessionId,
    setSession,
    sendMessage,
    getCurrentSessionMessages,
    setSessionMessages,
    isConnected: contextIsConnected,
    debug
  } = chatContext || {};

  // ✅ IMPROVED FALLBACK VALUES
  const actualCurrentSessionId = chatContextAvailable ? contextSessionId : currentSessionId;
  const actualIsConnected = chatContextAvailable ? (contextIsConnected ?? false) : isConnected;
  const actualMessages = chatContextAvailable ? (getCurrentSessionMessages ? getCurrentSessionMessages() : []) : messages;

  // Speech recognition hook
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // ✅ SET CONNECTION STATUS BASED ON CONTEXT AVAILABILITY
  useEffect(() => {
    if (chatContextAvailable) {
      console.log('✅ [CHAT DASHBOARD] Using ChatContext connection status:', contextIsConnected);
      setIsConnected(contextIsConnected ?? false);
    } else {
      console.log('📡 [CHAT DASHBOARD] Fallback mode - setting connected to true');
      setIsConnected(true);
    }
  }, [chatContextAvailable, contextIsConnected]);

  // Debug auth state on mount
  useEffect(() => {
    console.log('🔍 [CHAT DASHBOARD] Debug auth state on mount:');
    debugAuth();
    
    console.log('🔍 [CHAT DASHBOARD] Component state:', {
      chatContextAvailable,
      hasSocket: !!socket,
      actualCurrentSessionId,
      actualIsConnected,
      messageCount: actualMessages.length,
      connectionMode: chatContextAvailable ? 'Real-time (Socket)' : 'API Mode'
    });
  }, [chatContextAvailable, actualIsConnected]);

  // ✅ SCROLL TO BOTTOM WHEN MESSAGES CHANGE
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [actualMessages]);

  // Handle session selection
  useEffect(() => {
    console.log('🔄 [CHAT DASHBOARD] Session selection changed:', {
      selectedSession,
      actualCurrentSessionId,
      chatContextAvailable,
      action: selectedSession === 'new' ? 'Create New' : selectedSession ? 'Switch Session' : 'No Session'
    });

    if (selectedSession && selectedSession.startsWith('new-')) {
      createNewSession();
    } else if (selectedSession && selectedSession !== actualCurrentSessionId) {
      console.log('🔗 [CHAT DASHBOARD] Switching to existing session:', selectedSession);
      
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      } else {
        setCurrentSessionId(selectedSession);
      }
      
      fetchMessages(selectedSession);
    }
  }, [selectedSession, actualCurrentSessionId, chatContextAvailable]);

  // Create a new session
  const createNewSession = async () => {
    const startTime = Date.now();
    try {
      console.log("🆕 [CHAT DASHBOARD] Creating new session...");
      
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
      const creationTime = Date.now() - startTime;
      
      console.log("✅ [CHAT DASHBOARD] New session created in", creationTime, "ms:", {
        sessionId: newSession._id,
        title: newSession.title,
        createdAt: newSession.createdAt
      });
      
      // ✅ SET SESSION USING APPROPRIATE METHOD
      if (chatContextAvailable && setSession) {
        setSession(newSession._id);
      } else {
        setCurrentSessionId(newSession._id);
      }
      
      if (onSessionUpdate) {
        onSessionUpdate(newSession);
      }
    } catch (err) {
      const errorTime = Date.now() - startTime;
      console.error("❌ [CHAT DASHBOARD] Failed to create session after", errorTime, "ms:", {
        error: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      alert(`Failed to create new session: ${err.response?.data?.message || err.message}`);
    }
  };

  // Fetch messages for the current session
  const fetchMessages = async (sessionId) => {
    const startTime = Date.now();
    try {
      console.log("📥 [CHAT DASHBOARD] Fetching messages for session:", sessionId);
      
      const res = await axios.get(
        `${backendUrl}/api/chat/messages/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const fetchTime = Date.now() - startTime;
      const fetchedMessages = res.data || [];
      
      console.log("📦 [CHAT DASHBOARD] Fetched messages in", fetchTime, "ms:", {
        sessionId,
        messageCount: fetchedMessages.length,
        messageSenders: fetchedMessages.map(m => m.sender).filter((sender, index, arr) => arr.indexOf(sender) === index),
        hasAIResponses: fetchedMessages.some(m => m.sender === 'AI'),
        lastMessageTime: fetchedMessages.length > 0 ? new Date(fetchedMessages[fetchedMessages.length - 1].timestamp).toLocaleTimeString() : 'N/A'
      });
      
      // ✅ SET MESSAGES USING APPROPRIATE METHOD
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(sessionId, fetchedMessages);
      } else {
        setMessages(fetchedMessages);
      }
    } catch (err) {
      const errorTime = Date.now() - startTime;
      console.error("❌ [CHAT DASHBOARD] Failed to fetch messages after", errorTime, "ms:", {
        error: err.message,
        sessionId,
        status: err.response?.status
      });
      
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(sessionId, []);
      } else {
        setMessages([]);
      }
    }
  };

  // ✅ UPDATED FALLBACK SEND MESSAGE FUNCTION
  const fallbackSendMessage = async (messagePayload) => {
    console.log('📤 [CHAT DASHBOARD] Using fallback send message method');
    
    try {
      // ✅ TEST CONNECTION BEFORE SENDING
      setIsConnected(true); // Assume connected while sending
      
      // Send via API instead of socket
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
      
      console.log('✅ [CHAT DASHBOARD] Message sent via API:', response.data);
      
      // ✅ CONFIRM CONNECTION SUCCESS
      setIsConnected(true);
      
      // Handle the response which now includes both user message and AI response
      if (response.data.success && response.data.data) {
        const { userMessage, aiResponse } = response.data.data;
        
        // Add both messages to local state
        const messagesToAdd = [];
        
        if (userMessage) {
          messagesToAdd.push({
            _id: userMessage._id,
            message: userMessage.message,
            sender: typeof userMessage.sender === 'object' ? 'user' : userMessage.sender, // ✅ Handle ObjectId
            type: userMessage.type,
            fileUrl: userMessage.fileUrl,
            timestamp: userMessage.timestamp
          });
        }
        
        if (aiResponse) {
          messagesToAdd.push({
            _id: aiResponse._id,
            message: aiResponse.message,
            sender: aiResponse.sender, // ✅ AI sender is already a string
            type: aiResponse.type,
            timestamp: aiResponse.timestamp
          });
        }
        
        setMessages(prev => [...prev, ...messagesToAdd]);
        
        console.log('✅ [CHAT DASHBOARD] Added messages to local state:', {
          userMessageId: userMessage?._id,
          aiResponseId: aiResponse?._id,
          totalMessages: messagesToAdd.length
        });
      } else {
        // Fallback: just add the original message
        const newMessage = {
          ...messagePayload,
          _id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          sender: 'user'
        };
        
        setMessages(prev => [...prev, newMessage]);
      }
      
      return { success: true, latency: 0 };
    } catch (error) {
      console.error('❌ [CHAT DASHBOARD] Fallback send failed:', error);
      
      // ✅ MARK AS DISCONNECTED ON ERROR
      setIsConnected(false);
      
      // Still add the message locally even if API fails
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

  // Update session title based on the first message
  const updateSessionTitle = async (sessionId, firstMessage) => {
    const startTime = Date.now();
    try {
      const title = firstMessage.length > 30 
        ? `${firstMessage.substring(0, 30)}...` 
        : firstMessage;

      console.log("📝 [CHAT DASHBOARD] Updating session title:", {
        sessionId,
        oldTitle: 'New Chat',
        newTitle: title,
        messageLength: firstMessage.length
      });

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

      const updateTime = Date.now() - startTime;
      console.log("✅ [CHAT DASHBOARD] Session title updated in", updateTime, "ms");
      
      const updatedSession = res.data.session;
      
      if (onSessionUpdate) {
        onSessionUpdate(updatedSession);
      }
    } catch (err) {
      const errorTime = Date.now() - startTime;
      console.error("❌ [CHAT DASHBOARD] Failed to update session title after", errorTime, "ms:", {
        error: err.message,
        sessionId,
        status: err.response?.status
      });
    }
  };

  // Voice input handlers
  const handleVoiceInput = () => {
    if (!browserSupportsSpeechRecognition) {
      console.warn('⚠️ [VOICE] Browser does not support speech recognition');
      alert("Browser doesn't support speech recognition.");
      return;
    }
    
    if (listening) {
      console.log('🛑 [VOICE] Stopping speech recognition, final transcript:', transcript);
      SpeechRecognition.stopListening();
      if (transcript) {
        setInput(transcript);
      }
    } else {
      console.log('🎤 [VOICE] Starting speech recognition...');
      resetTranscript();
      SpeechRecognition.startListening({ 
        continuous: true,
        language: 'en-US'
      });
    }
  };

  // ✅ UPDATED SUBMIT HANDLER WITH FALLBACK SUPPORT
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) {
      console.warn('⚠️ [CHAT DASHBOARD] Submit attempted with empty input and no file');
      return;
    }
    if (!actualCurrentSessionId) {
      console.warn('⚠️ [CHAT DASHBOARD] Submit attempted without current session');
      return;
    }

    const submitStartTime = Date.now();
    const originalInput = input;
    let fileUrl = null;
    let fileType = null;

    // ✅ DEBUG AUTH BEFORE SENDING
    console.log('🔍 [CHAT DASHBOARD] Debugging auth before message send:');
    const authState = debugAuth();

    // Get user data with debug
    let actualUserId = null;
    let user = null;

    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        user = JSON.parse(storedUser);
        actualUserId = user._id;
        console.log('👤 [CHAT DASHBOARD] User from localStorage:', { userId: actualUserId, userName: user.name });
      }
    } catch (parseError) {
      console.error('❌ [CHAT DASHBOARD] Error parsing user from localStorage:', parseError);
    }

    if (!actualUserId) {
      console.error('❌ [CHAT DASHBOARD] No user ID found');
      console.error('❌ [CHAT DASHBOARD] Auth debug state:', authState);
      alert('Please log in again to send messages. Your session may have expired.');
      window.location.href = '/login';
      return;
    }

    console.log('📤 [CHAT DASHBOARD] Starting message submission:', {
      sessionId: actualCurrentSessionId,
      userId: actualUserId,
      userFound: !!user,
      messageLength: originalInput.length,
      hasFile: !!file,
      isVoiceInput: !!transcript,
      chatContextAvailable
    });

    // Clear form immediately for better UX
    setInput("");
    setFile(null);
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    // Show typing indicator
    setIsTyping(true);

    // Handle file upload
    if (file) {
      const uploadStartTime = Date.now();
      setIsUploading(true);
      
      try {
        console.log("📤 [UPLOAD] Starting file upload:", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
        });

        const formData = new FormData();
        formData.append("file", file);

        const res = await axios.post(`${backendUrl}/api/chat/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        const uploadTime = Date.now() - uploadStartTime;
        
        if (res.data.success) {
          fileUrl = res.data.fileUrl || res.data.url;
          fileType = file.type.startsWith("image") ? "image" : "document";
          
          console.log("✅ [UPLOAD] File uploaded successfully in", uploadTime, "ms:", {
            fileUrl,
            fileType,
            publicId: res.data.publicId,
            cloudinaryInfo: res.data.cloudinaryInfo
          });
        } else {
          throw new Error(res.data.message || "Upload failed");
        }
      } catch (err) {
        const uploadErrorTime = Date.now() - uploadStartTime;
        console.error("❌ [UPLOAD] File upload failed after", uploadErrorTime, "ms:", {
          error: err.message,
          fileName: file.name,
          status: err.response?.status,
          responseData: err.response?.data
        });
        
        alert(`File upload failed: ${err.response?.data?.message || err.message}`);
        setIsTyping(false);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    // ✅ CREATE MESSAGE PAYLOAD
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

    console.log("📤 [CHAT DASHBOARD] Sending message:", {
      messagePayload: {
        sessionId: messagePayload.sessionId,
        senderId: messagePayload.senderId,
        messageLength: messagePayload.message?.length || 0,
        type: messagePayload.type,
        hasFile: !!messagePayload.fileUrl
      },
      method: chatContextAvailable ? 'ChatContext' : 'Fallback API',
      processingTime: Date.now() - submitStartTime
    });

    // ✅ SEND VIA CHAT CONTEXT OR FALLBACK
    try {
      let sendResult;
      
      if (chatContextAvailable && sendMessage) {
        sendResult = await sendMessage(messagePayload);
      } else {
        sendResult = await fallbackSendMessage(messagePayload);
      }
      
      const totalSubmitTime = Date.now() - submitStartTime;
      
      if (sendResult.success) {
        console.log("✅ [CHAT DASHBOARD] Message sent successfully in", totalSubmitTime, "ms:", {
          latency: sendResult.latency,
          totalTime: totalSubmitTime,
          messageId: messagePayload.sessionId,
          method: chatContextAvailable ? 'ChatContext' : 'Fallback API'
        });

        // Update session title if this is the first message
        if (actualMessages.length === 0 && originalInput.trim()) {
          console.log("📝 [CHAT DASHBOARD] Updating session title for first message");
          updateSessionTitle(actualCurrentSessionId, originalInput.trim());
        }
      } else {
        throw new Error(sendResult.error || 'Failed to send message');
      }
    } catch (error) {
      const errorTime = Date.now() - submitStartTime;
      console.error("❌ [CHAT DASHBOARD] Failed to send message after", errorTime, "ms:", {
        error: error.message,
        messagePayload: messagePayload.sessionId,
        method: chatContextAvailable ? 'ChatContext' : 'Fallback API'
      });
      
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Chat Dashboard
          </h2>
          <div className="flex items-center space-x-4">
            {/* ✅ IMPROVED CONNECTION STATUS */}
            <div className={`text-xs px-2 py-1 rounded-full ${
              actualIsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {actualIsConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="text-xs text-gray-400">
              Messages: {actualMessages.length}
            </div>
            {/* ✅ SHOW CONTEXT STATUS WITH MORE DETAIL */}
            <div className={`text-xs px-2 py-1 rounded-full ${
              chatContextAvailable ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {chatContextAvailable ? '⚡ Real-time' : '📡 API Mode'}
            </div>
            {/* ✅ ADD CONNECTION TYPE INDICATOR */}
            <div className="text-xs text-gray-500">
              {chatContextAvailable ? 'Socket' : 'HTTP API'}
            </div>
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
                Start typing your first message or use voice input...
              </p>
              {!chatContextAvailable && (
                <p className="text-xs text-yellow-600 mt-2">
                  Running in API mode - real-time features limited
                </p>
              )}
              {/* ✅ SHOW CONNECTION STATUS IN WELCOME */}
              <p className={`text-xs mt-2 ${actualIsConnected ? 'text-green-600' : 'text-red-600'}`}>
                {actualIsConnected ? '✅ Connected to server' : '❌ Connection issues detected'}
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

        {/* Connection Status Message */}
        {!actualIsConnected && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            ⚠️ Connection lost. Messages may not be sent or received.
          </div>
        )}

        {/* File upload status */}
        {file && (
          <div className="mt-2 text-sm text-gray-600">
            📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        {/* Voice Recognition Status */}
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
