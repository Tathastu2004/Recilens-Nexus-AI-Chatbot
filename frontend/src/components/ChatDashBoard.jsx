"use client";
import React, { useState, useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck } from "@tabler/icons-react";
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

  // ✅ State declarations
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [lastProcessedSession, setLastProcessedSession] = useState(null);
  const [aiServiceStatus, setAiServiceStatus] = useState('normal');
  
  // ✅ NEW STATE FOR TRACKING ANIMATIONS AND AI RESPONSE
  const [animatedMessages, setAnimatedMessages] = useState(new Set());
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [aiResponseStatus, setAiResponseStatus] = useState('idle'); // 'idle', 'thinking', 'responding', 'complete'
  const [responseStartTime, setResponseStartTime] = useState(null);
  
  const messagesEndRef = useRef(null);

  // ✅ CHAT CONTEXT SETUP (same as before)
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
    console.log('✅ [CHAT DASHBOARD] ChatContext available:', {
      hasContext: !!chatContext,
      isConnected: chatContext?.isConnected,
      currentSessionId: chatContext?.currentSessionId
    });
  } catch (error) {
    console.log('⚠️ [CHAT DASHBOARD] ChatContext not available, using fallback mode:', error.message);
    chatContextAvailable = false;
  }

  const {
    currentSessionId: contextSessionId,
    setSession,
    sendMessage,
    getCurrentSessionMessages,
    setSessionMessages,
    isConnected: contextIsConnected,
    connectionStatus,
    fetchSessionMessages,
    isSessionStreaming
  } = chatContext || {};

  const actualCurrentSessionId = chatContextAvailable ? contextSessionId : currentSessionId;
  const actualIsConnected = chatContextAvailable ? (contextIsConnected ?? true) : isConnected;
  const actualMessages = chatContextAvailable ? (getCurrentSessionMessages ? getCurrentSessionMessages() : []) : messages;

  const isAITyping = chatContextAvailable ? 
    (isSessionStreaming ? isSessionStreaming(actualCurrentSessionId) : false) : 
    (isTyping || isAiResponding);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);
  const [hasStoppedListening, setHasStoppedListening] = useState(false);

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
      
      // Check if the new message is from AI and update response status
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.sender === 'AI') {
        setAiResponseStatus('complete');
        setIsAiResponding(false);
        console.log('✅ [AI RESPONSE] AI response received, stopping indicators');
      }
      
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
    console.log('🔄 [SESSION CHANGE] Resetting animation tracking for session:', actualCurrentSessionId);
    setAnimatedMessages(new Set());
    setIsInitialLoad(true);
    setLastMessageCount(0);
    setIsAiResponding(false);
    setAiResponseStatus('idle');
    setResponseStartTime(null);
  }, [actualCurrentSessionId]);

  // ✅ ENHANCED USER MESSAGE COMPONENT WITH CONDITIONAL ANIMATION
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

  // ✅ ENHANCED AI RESPONSE WRAPPER WITH CONDITIONAL ANIMATION
  const AiResponseWrapper = ({ message, timestamp, fileUrl, fileType, messageId, shouldAnimate }) => (
    <div className={shouldAnimate ? 'message-enter message-enter-active' : ''}>
      <AiResponse
        isTyping={false}
        message={message}
        animationType="dots"
        showAnimation={true}
        timestamp={timestamp}
        fileUrl={fileUrl}
        fileType={fileType}
        serviceStatus={aiServiceStatus}
        shouldAnimate={shouldAnimate}
      />
    </div>
  );

  // ✅ AI RESPONSE STATUS COMPONENT
  const AiResponseStatusIndicator = () => {
    const getElapsedTime = () => {
      if (!responseStartTime) return 0;
      return Math.floor((Date.now() - responseStartTime) / 1000);
    };

    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
      if (isAiResponding && responseStartTime) {
        const timer = setInterval(() => {
          setElapsedTime(getElapsedTime());
        }, 1000);
        return () => clearInterval(timer);
      }
    }, [isAiResponding, responseStartTime]);

    if (!isAiResponding) return null;

    return (
      <AiResponse
        isTyping={true}
        message=""
        animationType="thinking"
        showAnimation={true}
        customResponseText={
          elapsedTime > 5 
            ? `AI is processing your request... (${elapsedTime}s)`
            : elapsedTime > 3
            ? "AI is thinking deeply..."
            : "AI is responding..."
        }
      />
    );
  };

  // ✅ ALL YOUR EXISTING FUNCTIONS WITH ENHANCED AI RESPONSE TRACKING
  const createNewSession = async () => {
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

        window.dispatchEvent(new CustomEvent('sessionCreated', {
          detail: { 
            session: newSession,
            sessionId: newSession._id,
            timestamp: new Date().toISOString()
          }
        }));

        window.dispatchEvent(new CustomEvent('newSessionCreated', {
          detail: { 
            session: newSession,
            sessionId: newSession._id
          }
        }));

        if (chatContextAvailable && setSession) {
          setSession(newSession._id);
        } else {
          setCurrentSessionId(newSession._id);
          setMessages([]);
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
      
      window.dispatchEvent(new CustomEvent('sessionCreationFailed', {
        detail: { error: error.message }
      }));
      
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const fallbackSendMessage = async (messagePayload) => {
    try {
      // ✅ SET AI RESPONSE TRACKING
      setIsTyping(true);
      setIsAiResponding(true);
      setAiResponseStatus('thinking');
      setResponseStartTime(Date.now());
      console.log('🤖 [AI RESPONSE] Starting AI response tracking');
      
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

      if (response.data.success) {
        console.log('✅ [AI RESPONSE] Received response from backend');
        setAiResponseStatus('responding');
        
        if (response.data.aiServiceStatus) {
          setAiServiceStatus(response.data.aiServiceStatus);
        }

        const aiMessage = {
          _id: `ai-${Date.now()}`,
          message: response.data.response || response.data.message,
          sender: 'AI',
          type: 'text',
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, aiMessage]);
        
        // The useEffect will handle setting isAiResponding to false when new message is added
        return { success: true };
      } else {
        throw new Error(response.data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ [FALLBACK SEND] Error:', error);
      
      // ✅ STOP AI RESPONSE TRACKING ON ERROR
      setIsAiResponding(false);
      setAiResponseStatus('idle');
      setResponseStartTime(null);
      
      if (error.response?.data?.aiServiceStatus) {
        setAiServiceStatus(error.response.data.aiServiceStatus);
      } else if (error.message.includes('503') || error.message.includes('overloaded')) {
        setAiServiceStatus('overloaded');
      } else {
        setAiServiceStatus('error');
      }
      
      return { success: false, error: error.message };
    } finally {
      setIsTyping(false);
    }
  };

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

  const updateSessionTitle = async (sessionId, firstMessage) => {
    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('⚠️ [UPDATE TITLE] Invalid session ID:', sessionId);
      return;
    }

    try {
      const title = firstMessage.length > 30 
        ? `${firstMessage.substring(0, 30)}...` 
        : firstMessage;

      console.log('📝 [UPDATE TITLE] Updating session title immediately:', { sessionId, title });

      window.dispatchEvent(new CustomEvent('sessionTitleUpdated', {
        detail: { sessionId, title, timestamp: new Date().toISOString() }
      }));

      if (chatContextAvailable && chatContext.socket) {
        chatContext.socket.emit('update-session-title', { sessionId, title });
      }

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
      console.log('✅ [UPDATE TITLE] Session title updated in database:', updatedSession);
      
      window.dispatchEvent(new CustomEvent('sessionUpdated', {
        detail: { session: updatedSession }
      }));
      
    } catch (err) {
      console.error('❌ [UPDATE TITLE] Failed to update session title:', err);
      
      window.dispatchEvent(new CustomEvent('sessionTitleUpdateFailed', {
        detail: { sessionId, error: err.message }
      }));
    }
  };

  const handleVoiceInput = () => {
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
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    if (listening) {
      console.log('✏️ [INPUT] User manually editing while listening');
      setIsManuallyEditing(true);
      SpeechRecognition.stopListening();
      setHasStoppedListening(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!actualCurrentSessionId) return;

    setIsManuallyEditing(false);
    setHasStoppedListening(false);
    
    const originalInput = input;
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    
    const isFirstMessage = actualMessages.length === 0;
    
    const optimisticMessage = {
      _id: tempMessageId,
      message: originalInput,
      sender: userId,
      type: file ? (file.type.startsWith("image") ? "image" : "document") : "text",
      timestamp: new Date().toISOString(),
      status: 'sending',
      optimistic: true
    };

    if (chatContextAvailable && setSessionMessages) {
      const currentMessages = getCurrentSessionMessages();
      setSessionMessages(actualCurrentSessionId, [...currentMessages, optimisticMessage]);
    } else {
      setMessages(prev => [...prev, optimisticMessage]);
    }

    setInput("");
    setFile(null);
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    let fileUrl = null;
    let fileType = null;

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
      tempId: tempMessageId
    };

    try {
      let sendResult;
      
      if (chatContextAvailable && sendMessage) {
        sendResult = await sendMessage(messagePayload);
      } else {
        sendResult = await fallbackSendMessage(messagePayload);
      }
      
      if (sendResult.success) {
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

        if (isFirstMessage && originalInput.trim()) {
          console.log('🏷️ [HANDLE SUBMIT] Updating title for first message:', originalInput.trim());
          updateSessionTitle(actualCurrentSessionId, originalInput.trim());
        }
      } else {
        throw new Error(sendResult.error || 'Failed to send message');
      }
    } catch (error) {
      // ✅ STOP AI RESPONSE TRACKING ON ERROR
      setIsAiResponding(false);
      setAiResponseStatus('idle');
      setResponseStartTime(null);
      
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

  // ✅ ALL YOUR EXISTING useEffect HOOKS REMAIN THE SAME...
  useEffect(() => {
    if (chatContextAvailable) {
      console.log('🔌 [CONNECTION STATUS] Context connection status:', {
        contextIsConnected,
        connectionStatus,
        updating: contextIsConnected !== isConnected
      });
      
      if (contextIsConnected !== isConnected) {
        setIsConnected(contextIsConnected ?? true);
      }
    } else {
      if (!isConnected) {
        console.log('🔄 [CONNECTION STATUS] Fallback mode - setting connected');
        setIsConnected(true);
      }
    }
  }, [chatContextAvailable, contextIsConnected, connectionStatus]);

  useEffect(() => {
    if (!chatContextAvailable) {
      const checkFallbackConnection = async () => {
        try {
          const response = await fetch(`${backendUrl}/api/health`, {
            signal: AbortSignal.timeout(3000)
          });
          const connected = response.ok;
          
          if (connected !== isConnected) {
            console.log('🔄 [FALLBACK CONNECTION] Status changed:', { from: isConnected, to: connected });
            setIsConnected(connected);
          }
        } catch (error) {
          console.log('⚠️ [FALLBACK CONNECTION] Check failed:', error.message);
          if (isConnected) {
            setIsConnected(false);
          }
        }
      };

      checkFallbackConnection();
      const interval = setInterval(checkFallbackConnection, 15000);
      return () => clearInterval(interval);
    }
  }, [chatContextAvailable, backendUrl, isConnected]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [actualMessages, isAiResponding]);

  useEffect(() => {
    if (listening && transcript && !isManuallyEditing && !hasStoppedListening) {
      setInput(transcript);
    }
  }, [transcript, listening, isManuallyEditing, hasStoppedListening]);

  useEffect(() => {
    console.log('🔄 [SESSION SELECTION] Effect triggered:', {
      selectedSession,
      lastProcessedSession,
      actualCurrentSessionId
    });

    if (selectedSession === lastProcessedSession) {
      return;
    }

    if (!selectedSession || selectedSession === 'null' || selectedSession === 'undefined') {
      console.log('🧹 [SESSION SELECTION] Clearing session - invalid or empty:', selectedSession);
      setLastProcessedSession(selectedSession);
      
      if (chatContextAvailable && setSession) {
        setSession(null);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
      return;
    }

    if (selectedSession !== actualCurrentSessionId) {
      console.log('🔗 [SESSION SELECTION] Switching to session:', selectedSession);
      
      setLastProcessedSession(selectedSession);
      
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      } else {
        setCurrentSessionId(selectedSession);
      }
      
      if (selectedSession.match(/^[0-9a-fA-F]{24}$/)) {
        fetchMessages(selectedSession);
      } else {
        if (chatContextAvailable && setSessionMessages) {
          setSessionMessages(selectedSession, []);
        } else {
          setMessages([]);
        }
      }
    } else {
      setLastProcessedSession(selectedSession);
    }

  }, [selectedSession]);

  // ✅ UPDATED RETURN WITH CONDITIONAL ANIMATIONS AND AI RESPONSE STATUS
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ✅ HEADER WITH AI RESPONSE STATUS */}
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
            <div className={`text-xs px-2 py-1 rounded-full ${
              chatContextAvailable ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {chatContextAvailable ? '⚡ Enhanced' : '🔧 Basic'}
            </div>
            {isCreatingSession && (
              <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                🔄 Creating...
              </div>
            )}
            {/* ✅ AI RESPONSE STATUS INDICATOR */}
            {isAiResponding && (
              <div className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 animate-pulse">
                🤖 AI Responding...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ ENHANCED MESSAGES AREA WITH CONDITIONAL ANIMATIONS */}
      <div className="flex-1 overflow-y-auto p-4">
        {actualMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 animate-fade-in">
              <IconRobot size={48} className="mx-auto text-gray-400 animate-float" />
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
            {actualMessages.map((msg, index) => {
              // ✅ CHECK IF MESSAGE SHOULD BE ANIMATED
              const shouldAnimate = !animatedMessages.has(msg._id);
              
              return (
                <div key={msg._id || index}>
                  {msg.sender === 'AI' ? (
                    // ✅ AI RESPONSE WITH CONDITIONAL ANIMATION
                    <AiResponseWrapper
                      message={msg.message}
                      timestamp={msg.timestamp}
                      fileUrl={msg.fileUrl}
                      fileType={msg.type}
                      messageId={msg._id}
                      shouldAnimate={shouldAnimate}
                    />
                  ) : (
                    // ✅ USER MESSAGE WITH CONDITIONAL ANIMATION
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

            {/* ✅ ENHANCED AI TYPING INDICATOR WITH STATUS */}
            <AiResponseStatusIndicator />
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ✅ INPUT AREA REMAINS THE SAME */}
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
            className="cursor-pointer p-2 rounded-lg hover:bg-gray-100 smooth-transition"
            title="Upload file"
          >
            <IconUpload className="text-gray-600" />
          </label>

          {/* Voice Input */}
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-2 rounded-lg transition-all duration-200 smooth-transition ${
              listening 
                ? 'bg-green-100 hover:bg-green-200 border-2 border-green-300 animate-pulse-glow' 
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
            value={input}
            onChange={handleInputChange}
            placeholder={
              !actualIsConnected
                ? "Connection lost - messages may not send..."
                : isAiResponding
                  ? "AI is responding... please wait"
                : listening 
                  ? "Listening to your voice... (or type to override)" 
                  : browserSupportsSpeechRecognition 
                    ? "Type a message or use voice input..."
                    : "Type a message..."
            }
            className={`flex-1 p-2 border rounded-lg focus:outline-none transition-colors smooth-transition ${
              !actualIsConnected
                ? 'border-red-300 bg-red-50'
                : isAiResponding
                  ? 'border-purple-300 bg-purple-50'
                : listening 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-300 focus:border-blue-500'
            }`}
            disabled={isAiResponding}
          />

          {/* Send Button */}
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg transition-colors smooth-transition ${
              !actualIsConnected || isAiResponding
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg transform hover:scale-105'
            } disabled:opacity-50`}
            disabled={(!input.trim() && !file) || isUploading || !actualIsConnected || isAiResponding}
            title={
              !actualIsConnected ? "Cannot send - disconnected" : 
              isAiResponding ? "Please wait for AI response" : 
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

        {/* ✅ ENHANCED STATUS MESSAGES WITH AI RESPONSE STATUS */}
        {!actualIsConnected && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded animate-slide-up">
            ⚠️ Connection lost. Messages may not be sent or received.
          </div>
        )}

        {isAiResponding && (
          <div className="mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded animate-slide-up">
            🤖 AI is processing your request...
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
      </div>
    </div>
  );
};

export default ChatDashBoard;