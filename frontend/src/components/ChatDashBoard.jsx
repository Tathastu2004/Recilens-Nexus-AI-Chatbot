"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck, IconRefresh } from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useChat } from '../context/ChatContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import AiResponse from './AiResponse';
import '../styles/animations.css';

const ChatDashBoard = ({ selectedSession, onSessionUpdate, onSessionDelete }) => {
  // ✅ Constants and token
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");
  const userId = JSON.parse(localStorage.getItem("user"))?._id;

  // ✅ SIMPLIFIED STATE - Most state is now in ChatContext
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [lastProcessedSession, setLastProcessedSession] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // ✅ ANIMATION AND UI STATE
  const [animatedMessages, setAnimatedMessages] = useState(new Set());
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const messagesEndRef = useRef(null);

  // ✅ CHAT CONTEXT INTEGRATION
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
    console.log('✅ [CHAT DASHBOARD] ChatContext available:', {
      hasContext: !!chatContext,
      isConnected: chatContext?.isConnected,
      currentSessionId: chatContext?.currentSessionId,
      connectionStatus: chatContext?.connectionStatus
    });
  } catch (error) {
    console.log('⚠️ [CHAT DASHBOARD] ChatContext not available, using fallback mode:', error.message);
    chatContextAvailable = false;
  }

  // ✅ DESTRUCTURE CONTEXT VALUES WITH FALLBACKS
  const {
    currentSessionId,
    setSession,
    sendMessage,
    getCurrentSessionMessages,
    setSessionMessages,
    isConnected,
    connectionStatus,
    fetchSessionMessages,
    isSessionStreaming,
    cancelStream,
    streamingStates,
    initializeContext,
    reconnect,
    debug
  } = chatContext || {};

  // ✅ FALLBACK MESSAGE FETCHING (when ChatContext is disconnected)
  const [fallbackMessages, setFallbackMessages] = useState([]);
  const [isFetchingFallback, setIsFetchingFallback] = useState(false);

  // ✅ CALCULATE CONNECTION STATUS AND STREAMING STATE FIRST
  const actualIsConnected = chatContextAvailable ? (isConnected ?? false) : false;
  const isAIStreaming = chatContextAvailable ? (isSessionStreaming ? isSessionStreaming(currentSessionId) : false) : false;

  // ✅ FALLBACK FETCH FUNCTION
  const fetchMessagesViaHTTP = useCallback(async (sessionId) => {
    if (!sessionId || !token) return;
    
    try {
      setIsFetchingFallback(true);
      console.log('📥 [FALLBACK] Fetching messages via HTTP for session:', sessionId);
      
      const response = await axios.get(`${backendUrl}/api/chat/session/${sessionId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (response.data.success) {
        const messages = response.data.messages || [];
        console.log('✅ [FALLBACK] Messages fetched via HTTP:', messages.length);
        setFallbackMessages(messages);
        return messages;
      } else {
        console.error('❌ [FALLBACK] Failed to fetch messages:', response.data.message);
        setFallbackMessages([]);
      }
    } catch (error) {
      console.error('❌ [FALLBACK] Error fetching messages via HTTP:', error);
      setFallbackMessages([]);
    } finally {
      setIsFetchingFallback(false);
    }
  }, [backendUrl, token]);

  // ✅ GET CURRENT MESSAGES (NOW actualIsConnected IS DEFINED)
  const actualMessages = useMemo(() => {
    if (chatContextAvailable && actualIsConnected && getCurrentSessionMessages) {
      // Use ChatContext when connected
      const contextMessages = getCurrentSessionMessages();
      console.log('📋 [MESSAGES] Using ChatContext messages:', contextMessages.length);
      return contextMessages;
    } else {
      // Use HTTP fallback when disconnected
      console.log('📋 [MESSAGES] Using HTTP fallback messages:', fallbackMessages.length);
      return fallbackMessages;
    }
  }, [chatContextAvailable, actualIsConnected, getCurrentSessionMessages, fallbackMessages]);

  console.log('📋 [CHAT DASHBOARD] Current state:', {
    selectedSession,
    currentSessionId,
    messagesCount: actualMessages.length,
    isConnected: actualIsConnected,
    connectionStatus,
    isStreaming: isAIStreaming
  });

  // ✅ SPEECH RECOGNITION
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);
  const [hasStoppedListening, setHasStoppedListening] = useState(false);

  // ✅ CONNECTION RECOVERY
  const handleReconnect = useCallback(async () => {
    console.log('🔄 [RECONNECT] Attempting to reconnect...');
    setConnectionError(null);
    
    if (chatContextAvailable && reconnect) {
      try {
        await reconnect();
        console.log('✅ [RECONNECT] Reconnection successful');
      } catch (error) {
        console.error('❌ [RECONNECT] Reconnection failed:', error);
        setConnectionError('Failed to reconnect. Please refresh the page.');
      }
    } else if (chatContextAvailable && initializeContext) {
      try {
        await initializeContext();
        console.log('✅ [RECONNECT] Context reinitialized');
      } catch (error) {
        console.error('❌ [RECONNECT] Context reinitialization failed:', error);
        setConnectionError('Failed to initialize. Please refresh the page.');
      }
    }
  }, [chatContextAvailable, reconnect, initializeContext]);

  // ✅ LOAD SESSION MESSAGES
  const loadSessionMessages = useCallback(async (sessionId) => {
    if (!sessionId || !chatContextAvailable || !fetchSessionMessages) {
      console.log('⚠️ [LOAD MESSAGES] Cannot load - missing requirements:', {
        sessionId: !!sessionId,
        contextAvailable: chatContextAvailable,
        fetchFunction: !!fetchSessionMessages
      });
      return;
    }

    try {
      setIsLoadingMessages(true);
      console.log('📥 [LOAD MESSAGES] Loading messages for session:', sessionId);
      
      const result = await fetchSessionMessages(sessionId);
      
      if (result.success) {
        console.log('✅ [LOAD MESSAGES] Messages loaded successfully:', result.messages?.length || 0);
      } else {
        console.error('❌ [LOAD MESSAGES] Failed to load messages:', result.error);
      }
    } catch (error) {
      console.error('❌ [LOAD MESSAGES] Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [chatContextAvailable, fetchSessionMessages]);

  // ✅ TRACK NEW MESSAGES FOR ANIMATION
  useEffect(() => {
    const currentMessageCount = actualMessages.length;
    
    // If this is initial load (refresh), don't animate existing messages
    if (isInitialLoad) {
      console.log('🔄 [ANIMATION] Initial load - marking all messages as non-animated');
      const allMessageIds = new Set(actualMessages.map(msg => msg._id));
      setAnimatedMessages(allMessageIds);
      setIsInitialLoad(false);
      setLastMessageCount(currentMessageCount);
      return;
    }

    // Only animate new messages (when count increases)
    if (currentMessageCount > lastMessageCount) {
      console.log('📝 [ANIMATION] New messages detected:', {
        previous: lastMessageCount,
        current: currentMessageCount,
        newMessages: currentMessageCount - lastMessageCount
      });
      
      // Get the new messages (ones that should be animated)
      const newMessages = actualMessages.slice(lastMessageCount);
      console.log('✨ [ANIMATION] Animating new messages:', newMessages.map(m => m._id));
      
      // Don't add them to animated set immediately - let them animate first
      setTimeout(() => {
        setAnimatedMessages(prev => {
          const updated = new Set(prev);
          newMessages.forEach(msg => updated.add(msg._id));
          return updated;
        });
      }, 500); // After animation completes
    }
    
    setLastMessageCount(currentMessageCount);
  }, [actualMessages.length, isInitialLoad]);

  // ✅ RESET ANIMATION TRACKING WHEN SESSION CHANGES
  useEffect(() => {
    console.log('🔄 [SESSION CHANGE] Resetting animation tracking for session:', currentSessionId);
    setAnimatedMessages(new Set());
    setIsInitialLoad(true);
    setLastMessageCount(0);
  }, [currentSessionId]);

  // ✅ ENHANCED USER MESSAGE COMPONENT
  const UserMessage = ({ message, timestamp, status, optimistic, fileUrl, type, messageId, shouldAnimate }) => (
    <div className="flex justify-end mb-4">
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-2xl shadow-sm transition-all duration-300 ${
        shouldAnimate ? 'message-enter message-enter-active' : ''
      } ${
        status === 'failed'
          ? 'bg-red-50 text-red-800 border border-red-300'
          : 'bg-blue-500 text-white'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-medium">👤 You</div>
          {status === 'failed' && <span className="text-red-500">⚠️</span>}
          {optimistic && <span className="text-blue-200">⏳</span>}
        </div>
        
        <div className="text-sm whitespace-pre-wrap break-words">
          {message}
        </div>
        
        {fileUrl && (
          <div className="mt-3 pt-2 border-t border-blue-400">
            {type === 'image' ? (
              <img 
                src={fileUrl} 
                alt="Uploaded" 
                className={`max-w-full h-auto rounded border ${shouldAnimate ? 'animate-fade-in' : ''}`}
              />
            ) : (
              <a 
                href={fileUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-1 text-sm text-blue-200 hover:underline"
              >
                📎 View File
              </a>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2 pt-1">
          <div className="text-xs opacity-70 text-blue-100">
            {new Date(timestamp).toLocaleTimeString()}
          </div>
          {status === 'failed' && (
            <span className="text-xs text-red-200">Failed to send</span>
          )}
          {status === 'sending' && (
            <span className="text-xs text-blue-200">Sending...</span>
          )}
        </div>
      </div>
    </div>
  );

  // ✅ AI RESPONSE WRAPPER WITH STREAMING SUPPORT
  const AiResponseWrapper = ({ message, timestamp, fileUrl, fileType, messageId, shouldAnimate, isStreaming = false }) => (
    <div className={shouldAnimate ? 'message-enter message-enter-active' : ''}>
      <AiResponse
        isTyping={isStreaming}
        message={message}
        animationType={isStreaming ? "thinking" : "dots"}
        showAnimation={true}
        timestamp={timestamp}
        fileUrl={fileUrl}
        fileType={fileType}
        shouldAnimate={shouldAnimate}
        customResponseText={isStreaming ? "AI is streaming response..." : null}
      />
    </div>
  );

  // ✅ CREATE NEW SESSION
  const createNewSession = useCallback(async () => {
    if (isCreatingSession) {
      console.log('⚠️ [CREATE SESSION] Already creating a session, skipping...');
      return;
    }

    try {
      setIsCreatingSession(true);
      console.log('🆕 [CREATE SESSION] Creating new chat session...');

      const response = await axios.post(
        `${backendUrl}/api/chat/session`,
        {
          title: 'New Chat',
          userId: userId
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.data.success) {
        const newSession = response.data.session;
        console.log('✅ [CREATE SESSION] New session created:', newSession._id);

        // ✅ NOTIFY COMPONENTS
        window.dispatchEvent(new CustomEvent('sessionCreated', {
          detail: { 
            session: newSession,
            sessionId: newSession._id,
            timestamp: new Date().toISOString()
          }
        }));

        // ✅ SET SESSION IN CONTEXT
        if (chatContextAvailable && setSession) {
          setSession(newSession._id);
        }

        if (onSessionUpdate) {
          console.log('📢 [CREATE SESSION] Notifying parent component');
          onSessionUpdate(newSession);
        }

        return newSession;
      } else {
        throw new Error(response.data.message || 'Failed to create session');
      }
    } catch (error) {
      console.error('❌ [CREATE SESSION] Failed:', error);
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession, backendUrl, userId, token, chatContextAvailable, setSession, onSessionUpdate]);

  // ✅ UPDATE SESSION TITLE
  const updateSessionTitle = useCallback(async (sessionId, firstMessage) => {
    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('⚠️ [UPDATE TITLE] Invalid session ID:', sessionId);
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
      console.log('✅ [UPDATE TITLE] Session title updated:', updatedSession);
      
      // ✅ NOTIFY COMPONENTS
      window.dispatchEvent(new CustomEvent('sessionUpdated', {
        detail: { session: updatedSession }
      }));
      
    } catch (err) {
      console.error('❌ [UPDATE TITLE] Failed to update session title:', err);
    }
  }, [backendUrl, token]);

  // ✅ VOICE INPUT HANDLERS
  const handleVoiceInput = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }
    
    if (listening) {
      console.log('🎤 [VOICE] Stopping voice input');
      SpeechRecognition.stopListening();
      setHasStoppedListening(true);
    } else {
      console.log('🎤 [VOICE] Starting voice input');
      resetTranscript();
      setInput("");
      setIsManuallyEditing(false);
      setHasStoppedListening(false);
      SpeechRecognition.startListening({ 
        continuous: true,
        language: 'en-US'
      });
    }
  }, [listening, browserSupportsSpeechRecognition, resetTranscript]);

  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    if (listening) {
      console.log('✏️ [INPUT] User manually editing while listening');
      setIsManuallyEditing(true);
      SpeechRecognition.stopListening();
      setHasStoppedListening(true);
    }
  }, [listening]);

  // ✅ ENHANCED SUBMIT HANDLER WITH STREAMING SUPPORT
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!currentSessionId) return;
    if (isAIStreaming) {
      console.log('⚠️ [SUBMIT] AI is currently streaming, blocking new message');
      return;
    }

    console.log('📤 [SUBMIT] Starting message submission:', {
      sessionId: currentSessionId,
      messageLength: input.trim().length,
      hasFile: !!file,
      isStreaming: isAIStreaming
    });

    setIsManuallyEditing(false);
    setHasStoppedListening(false);
    
    const originalInput = input;
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const isFirstMessage = actualMessages.length === 0;
    
    // ✅ CLEAR INPUT IMMEDIATELY
    setInput("");
    setFile(null);
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    // ✅ HANDLE FILE UPLOAD FIRST
    let fileUrl = null;
    let fileType = null;

    if (file) {
      try {
        setIsUploading(true);
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
        console.error('❌ [SUBMIT] File upload failed:', err);
        // Continue without file
      } finally {
        setIsUploading(false);
      }
    }

    // ✅ CREATE USER MESSAGE AND ADD TO CONTEXT
    const userMessage = {
      _id: tempMessageId,
      message: originalInput,
      sender: userId,
      type: fileType || "text",
      fileUrl,
      fileType,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    // ✅ ADD USER MESSAGE TO SESSION
    if (chatContextAvailable && setSessionMessages) {
      const currentMessages = getCurrentSessionMessages();
      setSessionMessages(currentSessionId, [...currentMessages, userMessage]);
    }

    // ✅ PREPARE MESSAGE PAYLOAD FOR CONTEXT
    const messagePayload = {
      sessionId: currentSessionId,
      senderId: userId,
      message: originalInput,
      type: fileType || "text",
      fileUrl,
      fileType,
      tempId: tempMessageId
    };

    try {
      // ✅ SEND MESSAGE THROUGH CONTEXT (HANDLES STREAMING)
      if (chatContextAvailable && sendMessage) {
        console.log('🌊 [SUBMIT] Sending message through streaming context...');
        const result = await sendMessage(messagePayload);
        
        if (result.success) {
          console.log('✅ [SUBMIT] Message sent successfully:', result);
          
          // ✅ UPDATE SESSION TITLE FOR FIRST MESSAGE
          if (isFirstMessage && originalInput.trim()) {
            updateSessionTitle(currentSessionId, originalInput.trim());
          }
        } else {
          console.error('❌ [SUBMIT] Failed to send message:', result.error);
        }
      } else {
        console.log('⚠️ [SUBMIT] ChatContext not available, cannot send message');
      }
    } catch (error) {
      console.error('❌ [SUBMIT] Error during message submission:', error);
    }
  }, [input, file, currentSessionId, isAIStreaming, actualMessages.length, userId, resetTranscript, backendUrl, token, chatContextAvailable, setSessionMessages, getCurrentSessionMessages, sendMessage, updateSessionTitle]);

  // ✅ HANDLE SESSION SELECTION
  useEffect(() => {
    console.log('🔄 [SESSION SELECTION] Effect triggered:', {
      selectedSession,
      lastProcessedSession,
      currentSessionId,
      isConnected: actualIsConnected
    });

    if (selectedSession === lastProcessedSession) {
      return;
    }

    if (!selectedSession || selectedSession === 'null' || selectedSession === 'undefined') {
      console.log('🧹 [SESSION SELECTION] Clearing session - invalid or empty:', selectedSession);
      setLastProcessedSession(selectedSession);
      setFallbackMessages([]); // Clear fallback messages
    
      if (chatContextAvailable && setSession) {
        setSession(null);
      }
      return;
    }

    setLastProcessedSession(selectedSession);

    // ✅ SET SESSION IN CONTEXT FIRST
    if (chatContextAvailable && setSession) {
      setSession(selectedSession);
    }
    
    // ✅ ALWAYS FETCH VIA HTTP FALLBACK WHEN NOT CONNECTED OR DIFFERENT SESSION
    if (!actualIsConnected || selectedSession !== currentSessionId) {
      console.log('🔗 [SESSION SELECTION] Fetching messages via HTTP fallback for session:', selectedSession);
      fetchMessagesViaHTTP(selectedSession);
    }

    // ✅ ALSO TRY CHATCONTEXT IF AVAILABLE AND CONNECTED
    if (chatContextAvailable && fetchSessionMessages && actualIsConnected) {
      console.log('🌊 [SESSION SELECTION] Also trying ChatContext fetch...');
      loadSessionMessages(selectedSession);
    }
  }, [selectedSession, currentSessionId, lastProcessedSession, actualIsConnected, chatContextAvailable, setSession, fetchMessagesViaHTTP, loadSessionMessages, fetchSessionMessages]);

  // ✅ ADD A SEPARATE EFFECT TO TRIGGER FALLBACK WHEN SESSION CHANGES BUT NO MESSAGES
  useEffect(() => {
    // If we have a session, context is disconnected, and no messages - trigger fallback
    if (currentSessionId && !actualIsConnected && actualMessages.length === 0 && !isFetchingFallback) {
      console.log('🚨 [FALLBACK TRIGGER] No messages and disconnected, fetching via HTTP:', currentSessionId);
      fetchMessagesViaHTTP(currentSessionId);
    }
  }, [currentSessionId, actualIsConnected, actualMessages.length, isFetchingFallback, fetchMessagesViaHTTP]);

  // ✅ AUTO-SCROLL WHEN MESSAGES CHANGE
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [actualMessages, isAIStreaming]);

  // ✅ VOICE INPUT TRANSCRIPT HANDLING
  useEffect(() => {
    if (listening && transcript && !isManuallyEditing && !hasStoppedListening) {
      setInput(transcript);
    }
  }, [transcript, listening, isManuallyEditing, hasStoppedListening]);

  // ✅ CONNECTION STATUS MONITORING
  useEffect(() => {
    if (!actualIsConnected && chatContextAvailable) {
      setConnectionError('Connection lost. Some features may not work properly.');
    } else {
      setConnectionError(null);
    }
  }, [actualIsConnected, chatContextAvailable]);

  // ✅ MAIN RENDER
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ✅ ENHANCED HEADER WITH STREAMING STATUS */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {currentSessionId ? (
              currentSessionId.startsWith('temp-') ? 'New Chat (Creating...)' :
              currentSessionId.startsWith('new-') ? 'New Chat (Preparing...)' :
              'Chat Dashboard'
            ) : 'Chat Dashboard'}
          </h2>
          <div className="flex items-center gap-2">
            <div className={`text-xs px-2 py-1 rounded-full ${
              actualIsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {actualIsConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${
              chatContextAvailable ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {chatContextAvailable ? '⚡ Streaming' : '🔧 Basic'}
            </div>
            {isCreatingSession && (
              <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                🔄 Creating...
              </div>
            )}
            {isLoadingMessages && (
              <div className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                📥 Loading...
              </div>
            )}
            {isAIStreaming && (
              <div className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 animate-pulse">
                🌊 AI Streaming...
              </div>
            )}
            {/* ✅ RECONNECT BUTTON */}
            {!actualIsConnected && chatContextAvailable && (
              <button
                onClick={handleReconnect}
                className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
                title="Reconnect"
              >
                <IconRefresh size={12} className="inline mr-1" />
                Reconnect
              </button>
            )}
            {/* ✅ DEBUG INFO */}
            {debug && (
              <div className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                📊 {debug.totalMessages} msgs
              </div>
            )}
          </div>
        </div>
        
        {/* ✅ CONNECTION ERROR DISPLAY */}
        {connectionError && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            ⚠️ {connectionError}
          </div>
        )}
      </div>

      {/* ✅ ENHANCED MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 animate-fade-in">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500">
                {isFetchingFallback ? 'Loading messages via HTTP...' : 'Loading messages...'}
              </p>
            </div>
          </div>
        ) : actualMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 animate-fade-in">
              <IconRobot size={48} className="mx-auto text-gray-400 animate-float" />
              <h3 className="text-lg font-semibold text-gray-700">
                {isCreatingSession ? 'Setting up your new chat...' : 
                 !actualIsConnected ? 'Connection lost...' :
                 'Ready to chat!'}
              </h3>
              <p className="text-sm text-gray-500">
                {isCreatingSession ? 'Please wait a moment...' : 
                 !actualIsConnected ? 'Please reconnect to start chatting.' :
                 'Start typing your message or use voice input...'}
              </p>
              {chatContextAvailable && actualIsConnected && (
                <p className="text-xs text-blue-600">
                  ✨ Streaming enabled for real-time responses
                </p>
              )}
              {!actualIsConnected && (
                <button
                  onClick={handleReconnect}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <IconRefresh size={16} className="inline mr-2" />
                  Reconnect
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {actualMessages.map((msg, index) => {
              // ✅ CHECK IF MESSAGE SHOULD BE ANIMATED
              const shouldAnimate = !animatedMessages.has(msg._id);
              
              return (
                <div key={msg._id || index}>
                  {msg.sender === 'AI' ? (
                    // ✅ AI RESPONSE WITH STREAMING SUPPORT
                    <AiResponseWrapper
                      message={msg.message}
                      timestamp={msg.timestamp}
                      fileUrl={msg.fileUrl}
                      fileType={msg.type}
                      messageId={msg._id}
                      shouldAnimate={shouldAnimate}
                      isStreaming={msg.isStreaming}
                    />
                  ) : (
                    // ✅ USER MESSAGE
                    <UserMessage
                      message={msg.message}
                      timestamp={msg.timestamp}
                      status={msg.status}
                      optimistic={msg.optimistic}
                      fileUrl={msg.fileUrl}
                      type={msg.type}
                      messageId={msg._id}
                      shouldAnimate={shouldAnimate}
                    />
                  )}
                </div>
              );
            })}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ✅ ENHANCED INPUT AREA */}
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
            className={`cursor-pointer p-2 rounded-lg transition-colors smooth-transition ${
              !actualIsConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
            }`}
            title={!actualIsConnected ? "Cannot upload - disconnected" : "Upload file"}
          >
            <IconUpload className="text-gray-600" />
          </label>

          {/* Voice Input */}
          <button
            type="button"
            onClick={handleVoiceInput}
            disabled={!browserSupportsSpeechRecognition || !actualIsConnected}
            className={`p-2 rounded-lg transition-all duration-200 smooth-transition ${
              listening 
                ? 'bg-green-100 hover:bg-green-200 border-2 border-green-300 animate-pulse-glow' 
                : !actualIsConnected || !browserSupportsSpeechRecognition
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100'
            }`}
            title={
              !actualIsConnected ? "Cannot use voice - disconnected" :
              !browserSupportsSpeechRecognition ? "Voice not supported" :
              listening ? "Stop Recording" : "Start Voice Input"
            }
          >
            {listening ? (
              <IconCheck className="text-green-600 h-5 w-5" />
            ) : (
              <IconMicrophone className={`h-5 w-5 ${
                browserSupportsSpeechRecognition && actualIsConnected ? 'text-gray-600' : 'text-gray-400'
              }`} />
            )}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={
              !actualIsConnected
                ? "Connection lost - messages may not send..."
                : isAIStreaming
                  ? "AI is streaming response... please wait"
                : listening 
                  ? "Listening to your voice... (or type to override)" 
                  : browserSupportsSpeechRecognition 
                    ? "Type a message or use voice input..."
                    : "Type a message..."
            }
            className={`flex-1 p-2 border rounded-lg focus:outline-none transition-colors smooth-transition ${
              !actualIsConnected
                ? 'border-red-300 bg-red-50'
                : isAIStreaming
                  ? 'border-purple-300 bg-purple-50'
                : listening 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-300 focus:border-blue-500'
            }`}
            disabled={isAIStreaming}
          />

          {/* Send Button */}
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg transition-colors smooth-transition ${
              !actualIsConnected || isAIStreaming
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg transform hover:scale-105'
            } disabled:opacity-50`}
            disabled={(!input.trim() && !file) || isUploading || !actualIsConnected || isAIStreaming}
            title={
              !actualIsConnected ? "Cannot send - disconnected" : 
              isAIStreaming ? "Please wait for AI response" : 
              "Send message"
            }
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <IconSend size={20} />
            )}
          </button>
        </form>

        {/* ✅ ENHANCED STATUS MESSAGES */}
        {!actualIsConnected && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded animate-slide-up flex items-center justify-between">
            <span>⚠️ Connection lost. Messages may not be sent or received.</span>
            <button
              onClick={handleReconnect}
              className="ml-2 text-xs underline hover:no-underline"
            >
              Reconnect
            </button>
          </div>
        )}

        {isAIStreaming && (
          <div className="mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded animate-slide-up">
            🌊 AI is streaming response in real-time...
            <div className="typing-dots ml-2 inline-flex">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        {file && (
          <div className="mt-2 text-sm text-gray-600 animate-slide-up">
            📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        {!browserSupportsSpeechRecognition && (
          <div className="mt-2 text-xs text-gray-500 animate-slide-up">
            Voice input not supported in this browser. Try Chrome or Edge.
          </div>
        )}

        {listening && (
          <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded animate-slide-up">
            🎤 Listening... (Tap the microphone to stop)
            <div className="typing-dots ml-2 inline-flex">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        {/* ✅ DEBUG INFO (DEV MODE) */}
        {debug && process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
            🐛 Debug: {debug.totalSessions} sessions, {debug.totalMessages} messages, {debug.activeStreams} active streams
            <br />
            Session: {currentSessionId || 'none'}, Messages: {actualMessages.length}, Connected: {actualIsConnected ? 'yes' : 'no'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDashBoard;