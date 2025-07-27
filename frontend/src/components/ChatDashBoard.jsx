"use client";
import React, { useState, useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck } from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useChat } from '../context/ChatContext';

const ChatDashBoard = ({ selectedSession, onSessionUpdate, onSessionDelete }) => {
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
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [lastProcessedSession, setLastProcessedSession] = useState(null);
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

  // ✅ SINGLE SESSION SELECTION LOGIC - REMOVE DUPLICATE useEffect
  useEffect(() => {
    console.log('🔄 [SESSION SELECTION] Effect triggered:', {
      selectedSession,
      lastProcessedSession,
      isCreatingSession,
      actualCurrentSessionId
    });

    // ✅ GUARD: Prevent processing the same session multiple times
    if (selectedSession === lastProcessedSession) {
      console.log('⚠️ [SESSION SELECTION] Session already processed, skipping');
      return;
    }

    // ✅ GUARD: Prevent processing during session creation
    if (isCreatingSession) {
      console.log('⚠️ [SESSION SELECTION] Session creation in progress, skipping');
      return;
    }

    // ✅ GUARD: Handle empty or invalid sessions
    if (!selectedSession || selectedSession === 'null' || selectedSession === 'undefined') {
      console.log('🧹 [SESSION SELECTION] Clearing session');
      setLastProcessedSession(selectedSession);
      
      // ✅ CLEAR CURRENT SESSION AND MESSAGES
      if (chatContextAvailable && setSession) {
        setSession(null);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
      return;
    }

    // ✅ HANDLE NEW SESSION CREATION (only once)
    if (selectedSession.startsWith('new-')) {
      console.log('🆕 [SESSION SELECTION] Creating new session for:', selectedSession);
      setLastProcessedSession(selectedSession); // ✅ Mark as processed IMMEDIATELY
      createNewSession();
      return;
    }

    // ✅ HANDLE TEMP SESSION (already in progress)
    if (selectedSession.startsWith('temp-')) {
      console.log('⏳ [SESSION SELECTION] Temp session detected:', selectedSession);
      setLastProcessedSession(selectedSession);
      
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      } else {
        setCurrentSessionId(selectedSession);
      }
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
      
      // ✅ LOAD MESSAGES ONLY IF NOT CACHED
      const cachedMessages = chatContextAvailable ? 
        (chatContext.allMessages && chatContext.allMessages[selectedSession] ? chatContext.allMessages[selectedSession] : []) : 
        [];
      
      if (cachedMessages.length === 0) {
        fetchMessages(selectedSession);
      }
    } else {
      // ✅ Same session, just mark as processed
      setLastProcessedSession(selectedSession);
    }

  }, [selectedSession]); // ✅ ONLY selectedSession dependency

  // ✅ IMPROVED createNewSession
  const createNewSession = async () => {
    if (isCreatingSession) {
      console.log('⚠️ [CREATE SESSION] Already creating session, skipping...');
      return;
    }
    
    console.log('🆕 [CREATE SESSION] Starting instant session creation...');
    setIsCreatingSession(true);
    
    // ✅ CREATE TEMPORARY SESSION ID FOR IMMEDIATE USE
    const tempSessionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // ✅ IMMEDIATELY SWITCH TO TEMP SESSION
    if (chatContextAvailable && setSession) {
      setSession(tempSessionId);
      setSessionMessages(tempSessionId, []);
    } else {
      setCurrentSessionId(tempSessionId);
      setMessages([]);
    }
    
    try {
      // ✅ CREATE REAL SESSION IN BACKGROUND
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

      const realSession = res.data.session || res.data;
      console.log('✅ [CREATE SESSION] Real session created:', realSession._id);
      
      // ✅ MIGRATE FROM TEMP TO REAL SESSION
      const tempMessages = chatContextAvailable ? 
        (getCurrentSessionMessages ? getCurrentSessionMessages() : []) : 
        messages;
      
      if (chatContextAvailable && setSession) {
        setSession(realSession._id);
        setSessionMessages(realSession._id, tempMessages);
        // Clean up temp session
        if (chatContext.allMessages) {
          delete chatContext.allMessages[tempSessionId];
        }
      } else {
        setCurrentSessionId(realSession._id);
      }
      
      // ✅ UPDATE PARENT COMPONENT WITH REAL SESSION
      if (onSessionUpdate) {
        onSessionUpdate(realSession);
      }

      setLastProcessedSession(realSession._id);

      // ✅ UPDATE SESSION IN PARENT (for localStorage)
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sessionCreated', { 
          detail: { oldId: selectedSession, newId: realSession._id, session: realSession }
        }));
      }
      
    } catch (err) {
      console.error('❌ [CREATE SESSION] Failed:', err);
      setLastProcessedSession(null); // ✅ Reset on error
      alert(`Failed to create session: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // ✅ IMPROVED fetchMessages with proper error handling
  const fetchMessages = async (sessionId) => {
    if (!sessionId || sessionId.startsWith('temp-') || sessionId.startsWith('new-')) {
      console.log('⚠️ [FETCH MESSAGES] Skipping fetch for temp/new session:', sessionId);
      return;
    }

    console.log('📤 [FETCH MESSAGES] Fetching messages for session:', sessionId);
    
    try {
      const res = await axios.get(
        `${backendUrl}/api/chat/messages/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const fetchedMessages = res.data || [];
      console.log('✅ [FETCH MESSAGES] Fetched', fetchedMessages.length, 'messages');
      
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(sessionId, fetchedMessages);
      } else {
        setMessages(fetchedMessages);
      }
    } catch (err) {
      console.error('❌ [FETCH MESSAGES] Failed:', err);
      
      if (chatContextAvailable && setSessionMessages) {
        setSessionMessages(sessionId, []);
      } else {
        setMessages([]);
      }
    }
  };

  // ✅ IMPROVED updateSessionTitle
  const updateSessionTitle = async (sessionId, firstMessage) => {
    // ✅ SKIP IF TEMP SESSION OR INVALID
    if (!sessionId || sessionId.startsWith('temp-') || sessionId.startsWith('new-')) {
      console.log('⚠️ [UPDATE TITLE] Skipping temp/new session:', sessionId);
      return;
    }

    try {
      const title = firstMessage.length > 30 
        ? `${firstMessage.substring(0, 30)}...` 
        : firstMessage;

      console.log('📝 [UPDATE TITLE] Updating session title:', { sessionId, title });

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
      console.log('✅ [UPDATE TITLE] Session title updated successfully:', updatedSession);
      
      if (onSessionUpdate) {
        onSessionUpdate(updatedSession);
      }

      // ✅ TRIGGER SESSION LIST REFRESH
      window.dispatchEvent(new CustomEvent('sessionUpdated', { 
        detail: updatedSession 
      }));

    } catch (err) {
      console.error('❌ [UPDATE TITLE] Failed to update session title:', err);
    }
  };

  // ✅ IMPROVED VOICE INPUT WITH INSTANT VISUAL FEEDBACK
  const handleVoiceInput = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }
    
    if (listening) {
      SpeechRecognition.stopListening();
      // ✅ INSTANTLY SET INPUT FROM TRANSCRIPT
      if (transcript) {
        setInput(transcript);
      }
    } else {
      resetTranscript();
      setInput(""); // Clear input when starting to listen
      SpeechRecognition.startListening({ 
        continuous: true,
        language: 'en-US'
      });
    }
  };

  // ✅ REAL-TIME TRANSCRIPT UPDATE
  useEffect(() => {
    if (listening && transcript) {
      setInput(transcript);
    }
  }, [transcript, listening]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!actualCurrentSessionId) return;

    const originalInput = input;
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    
    // ✅ CHECK IF THIS IS THE FIRST MESSAGE BEFORE ADDING OPTIMISTIC MESSAGE
    const isFirstMessage = actualMessages.length === 0;
    
    // ✅ IMMEDIATE UI UPDATE - NO DELAY
    const optimisticMessage = {
      _id: tempMessageId,
      message: originalInput,
      sender: userId,
      type: file ? (file.type.startsWith("image") ? "image" : "document") : "text",
      timestamp: new Date().toISOString(),
      status: 'sending',
      optimistic: true
    };

    // ✅ ADD MESSAGE TO UI IMMEDIATELY
    if (chatContextAvailable && setSessionMessages) {
      const currentMessages = getCurrentSessionMessages();
      setSessionMessages(actualCurrentSessionId, [...currentMessages, optimisticMessage]);
    } else {
      setMessages(prev => [...prev, optimisticMessage]);
    }

    // Clear form immediately
    setInput("");
    setFile(null);
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    let fileUrl = null;
    let fileType = null;

    // Handle file upload in background
    if (file) {
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
        }
      } catch (err) {
        // ✅ UPDATE OPTIMISTIC MESSAGE TO FAILED STATE
        const updateMessage = (messages) => messages.map(msg => 
          msg._id === tempMessageId 
            ? { ...msg, status: 'failed', error: 'File upload failed' }
            : msg
        );

        if (chatContextAvailable) {
          const currentMessages = getCurrentSessionMessages();
          setSessionMessages(actualCurrentSessionId, updateMessage(currentMessages));
        } else {
          setMessages(updateMessage);
        }
        return;
      }
    }

    const messagePayload = {
      sessionId: actualCurrentSessionId,
      senderId: userId,
      message: originalInput,
      type: file ? fileType : "text",
      fileUrl,
      fileType,
      timestamp: new Date().toISOString(),
      tempId: tempMessageId // ✅ Track optimistic message
    };

    try {
      let sendResult;
      
      if (chatContextAvailable && sendMessage) {
        sendResult = await sendMessage(messagePayload);
      } else {
        sendResult = await fallbackSendMessage(messagePayload);
      }
      
      if (sendResult.success) {
        // ✅ UPDATE OPTIMISTIC MESSAGE TO CONFIRMED
        const updateMessage = (messages) => messages.map(msg => 
          msg._id === tempMessageId 
            ? { ...msg, status: 'sent', optimistic: false }
            : msg
        );

        if (chatContextAvailable) {
          const currentMessages = getCurrentSessionMessages();
          setSessionMessages(actualCurrentSessionId, updateMessage(currentMessages));
        } else {
          setMessages(updateMessage);
        }

        // ✅ UPDATE SESSION TITLE IF FIRST MESSAGE (using the flag we set earlier)
        if (isFirstMessage && originalInput.trim()) {
          console.log('🏷️ [HANDLE SUBMIT] Updating title for first message:', originalInput.trim());
          updateSessionTitle(actualCurrentSessionId, originalInput.trim());
        }
      } else {
        throw new Error(sendResult.error || 'Failed to send message');
      }
    } catch (error) {
      // ✅ UPDATE OPTIMISTIC MESSAGE TO FAILED STATE
      const updateMessage = (messages) => messages.map(msg => 
        msg._id === tempMessageId 
          ? { ...msg, status: 'failed', error: error.message }
          : msg
      );

      if (chatContextAvailable) {
        const currentMessages = getCurrentSessionMessages();
        setSessionMessages(actualCurrentSessionId, updateMessage(currentMessages));
      } else {
        setMessages(updateMessage);
      }
    }
  };

  // ✅ INSTANT SESSION SWITCHING
  useEffect(() => {
    if (selectedSession === lastProcessedSession) return;
    if (isCreatingSession) return;
    if (!selectedSession || selectedSession === 'null' || selectedSession === 'undefined') {
      setLastProcessedSession(selectedSession);
      return;
    }

    console.log('⚡ [SESSION SELECTION] Instant switch to:', selectedSession);

    if (selectedSession.startsWith('new-')) {
      setLastProcessedSession(selectedSession);
      createNewSession();
      return;
    }

    // ✅ INSTANT SWITCH TO EXISTING SESSION
    if (selectedSession !== actualCurrentSessionId) {
      setLastProcessedSession(selectedSession);
      
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      } else {
        setCurrentSessionId(selectedSession);
      }
      
      // ✅ LOAD MESSAGES ONLY IF NOT CACHED
      const cachedMessages = chatContextAvailable ? 
        (chatContext.allMessages && chatContext.allMessages[selectedSession] ? chatContext.allMessages[selectedSession] : []) : 
        [];
      
      if (cachedMessages.length === 0) {
        fetchMessages(selectedSession);
      }
    } else {
      setLastProcessedSession(selectedSession);
    }

  }, [selectedSession]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ✅ IMPROVED HEADER WITH SESSION INFO */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {actualCurrentSessionId ? (
              actualCurrentSessionId.startsWith('temp-') ? 'New Chat (Creating...)' :
              actualCurrentSessionId.startsWith('new-') ? 'New Chat (Preparing...)' :
              'Chat Dashboard'
            ) : 'Chat Dashboard'}
          </h2>
          <div className="flex items-center gap-2">
            <div className={`text-xs px-2 py-1 rounded-full ${
              actualIsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {actualIsConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            {isCreatingSession && (
              <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                🔄 Creating...
              </div>
            )}
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
                {isCreatingSession ? 'Setting up your new chat...' : 'Ready to chat!'}
              </h3>
              <p className="text-sm text-gray-500">
                {isCreatingSession ? 'Please wait a moment...' : 'Start typing your message or use voice input...'}
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
