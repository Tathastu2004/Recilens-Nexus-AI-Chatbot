"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck, IconPaperclip, IconUser, IconSun, IconMoon } from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '../styles/animations.css';

const ChatDashBoard = ({ selectedSession, onSessionUpdate, onSessionDelete }) => {
  // ✅ Constants and token
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");
  const userId = JSON.parse(localStorage.getItem("user"))?._id;

  // ✅ THEME CONTEXT
  const { theme, isDark, toggleTheme, isTransitioning } = useTheme();

  // ✅ SIMPLIFIED SESSION STATE - Only use prop from parent
  const [lastProcessedSession, setLastProcessedSession] = useState(null);

  // ✅ USE SELECTED SESSION AS PRIMARY SOURCE
  const activeSessionId = selectedSession || lastProcessedSession;

  // ✅ STATE MANAGEMENT
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const messagesEndRef = useRef(null);

  // ✅ CHAT CONTEXT INTEGRATION
  let chatContext = null;
  let chatContextAvailable = false;

  try {
    chatContext = useChat();
    chatContextAvailable = true;
  } catch (error) {
    chatContextAvailable = false;
  }

  // ✅ DESTRUCTURE CONTEXT VALUES
  const {
    currentSessionId,
    setSession,
    sendMessage,
    getCurrentSessionMessages,
    setSessionMessages,
    isConnected,
    fetchSessionMessages,
    isSessionStreaming,
    initializeContext,
    reconnect
  } = chatContext || {};

  // ✅ FALLBACK MESSAGE FETCHING
  const [fallbackMessages, setFallbackMessages] = useState([]);
  const [isFetchingFallback, setIsFetchingFallback] = useState(false);

  // ✅ CONNECTION STATUS
  const actualIsConnected = chatContextAvailable ? (isConnected ?? false) : false;
  const isAIStreaming = chatContextAvailable ? (isSessionStreaming ? isSessionStreaming(lastProcessedSession || currentSessionId) : false) : false;

  // ✅ PERSIST SESSION TO LOCALSTORAGE AND URL
  const persistSession = useCallback((sessionId) => {
    console.log('💾 Persisting session:', sessionId);
    
    if (sessionId && sessionId !== 'null' && sessionId !== 'undefined') {
      localStorage.setItem('currentChatSession', sessionId);
      setLastProcessedSession(sessionId);
      
      // Update URL without refreshing page
      const url = new URL(window.location);
      url.searchParams.set('session', sessionId);
      window.history.replaceState({}, '', url);
      
      console.log('✅ Session persisted:', sessionId);
    } else {
      localStorage.removeItem('currentChatSession');
      setLastProcessedSession(null);
      
      // Remove session from URL
      const url = new URL(window.location);
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url);
      
      console.log('✅ Session cleared');
    }
  }, []);

  // ✅ INITIALIZE SESSION ON MOUNT - FIXED to set context session
  useEffect(() => {
    if (hasInitialized) return;
    
    const initializeSession = async () => {
      console.log('🚀 [DASHBOARD] Initializing with session:', selectedSession);
      
      if (selectedSession && selectedSession !== 'null' && selectedSession !== 'undefined') {
        console.log('🔄 [DASHBOARD] Using session from parent:', selectedSession);
        
        // Sync with context if available
        if (chatContextAvailable && setSession && selectedSession !== currentSessionId) {
          console.log('📡 [DASHBOARD] Setting session in context:', selectedSession);
          setSession(selectedSession);
        }
        
        // Fetch messages for the session
        console.log('📨 [DASHBOARD] Fetching messages for session:', selectedSession);
        await fetchMessagesViaHTTP(selectedSession);
      }
      
      setHasInitialized(true);
    };

    initializeSession();
  }, [selectedSession, chatContextAvailable, setSession, currentSessionId]);

  // ✅ HANDLE BROWSER BACK/FORWARD
  useEffect(() => {
    const handlePopState = () => {
      const urlSession = new URLSearchParams(window.location.search).get('session');
      console.log('🔙 Browser navigation detected:', urlSession);
      
      if (urlSession && urlSession !== lastProcessedSession) {
        setLastProcessedSession(urlSession);
        if (chatContextAvailable && setSession) {
          setSession(urlSession);
        }
        if (onSessionUpdate) {
          onSessionUpdate(urlSession);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [lastProcessedSession, chatContextAvailable, setSession, onSessionUpdate]);

  // ✅ FALLBACK FETCH FUNCTION
  const fetchMessagesViaHTTP = useCallback(async (sessionId) => {
    if (!sessionId || !token) {
      console.log('❌ Cannot fetch messages - missing sessionId or token');
      return;
    }
    
    console.log('📡 Fetching messages via HTTP for session:', sessionId);
    
    try {
      setIsFetchingFallback(true);
      
      const response = await axios.get(`${backendUrl}/api/chat/session/${sessionId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (response.data.success) {
        const messages = response.data.messages || [];
        setFallbackMessages(messages);
        console.log('✅ Fetched messages via HTTP:', messages.length);
        return messages;
      } else {
        console.log('❌ HTTP fetch failed:', response.data.message);
        setFallbackMessages([]);
      }
    } catch (error) {
      console.error('❌ HTTP fetch error:', error);
      setFallbackMessages([]);
    } finally {
      setIsFetchingFallback(false);
    }
  }, [backendUrl, token]);

  // ✅ GET CURRENT MESSAGES
  const actualMessages = useMemo(() => {
    if (chatContextAvailable && actualIsConnected && getCurrentSessionMessages) {
      const contextMessages = getCurrentSessionMessages();
      console.log('📋 Using context messages:', contextMessages.length);
      return contextMessages;
    } else {
      console.log('📋 Using fallback messages:', fallbackMessages.length);
      return fallbackMessages;
    }
  }, [chatContextAvailable, actualIsConnected, getCurrentSessionMessages, fallbackMessages]);

  // ✅ SPEECH RECOGNITION
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);
  const [hasStoppedListening, setHasStoppedListening] = useState(false);

  // ✅ MODERN USER MESSAGE COMPONENT - BETTER SPACING
  const UserMessage = ({ message, timestamp, status, fileUrl, type }) => (
    <div className="flex justify-end mb-4 animate-fade-in px-4">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className={`px-4 py-3 rounded-2xl shadow-sm transition-all duration-300 ${
          status === 'failed'
            ? 'bg-red-500/10 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
            : 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg'
        }`}>
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </div>
          
          {fileUrl && (
            <div className="mt-3 pt-2 border-t border-white/20">
              {type === 'image' ? (
                <img 
                  src={fileUrl} 
                  alt="Uploaded" 
                  className="max-w-full h-auto rounded-lg shadow-md"
                />
              ) : (
                <a 
                  href={fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors"
                >
                  <IconPaperclip size={16} />
                  View attachment
                </a>
              )}
            </div>
          )}
          
          <div className="text-xs text-white/70 mt-2">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
          <IconUser size={14} className="text-white" />
        </div>
      </div>
    </div>
  );

  // ✅ MODERN AI RESPONSE COMPONENT - BETTER SPACING  
  const AiMessage = ({ message, timestamp, fileUrl, fileType, isStreaming = false }) => (
    <div className="flex items-start gap-2 mb-4 animate-fade-in px-4">
      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-md">
        <IconRobot size={14} className="text-white" />
      </div>
      
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700">
          {isStreaming ? (
            <div className="flex items-center gap-3">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">AI is thinking...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
              <ReactMarkdown
                components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg my-3"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                  h1: ({children}) => <h1 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">{children}</h1>,
                  h2: ({children}) => <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
                  h3: ({children}) => <h3 className="text-sm font-bold mb-2 text-gray-900 dark:text-gray-100">{children}</h3>,
                  ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                  blockquote: ({children}) => (
                    <blockquote className="border-l-4 border-emerald-500 pl-3 py-1 my-3 bg-gray-50 dark:bg-gray-700/30 rounded-r-lg">
                      {children}
                    </blockquote>
                  )
                }}
              >
                {message}
              </ReactMarkdown>
            </div>
          )}
          
          {fileUrl && !isStreaming && (
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              {fileType === 'image' ? (
                <img 
                  src={fileUrl} 
                  alt="AI Generated" 
                  className="max-w-full h-auto rounded-lg shadow-md"
                />
              ) : (
                <a 
                  href={fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  <IconPaperclip size={16} />
                  View attachment
                </a>
              )}
            </div>
          )}
        </div>
        
        {!isStreaming && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );

  // ✅ LOAD SESSION MESSAGES
  const loadSessionMessages = useCallback(async (sessionId) => {
    if (!sessionId || !chatContextAvailable || !fetchSessionMessages) return;

    try {
      setIsLoadingMessages(true);
      console.log('📡 Loading messages from context for session:', sessionId);
      await fetchSessionMessages(sessionId);
    } catch (error) {
      console.error('❌ Error loading messages from context:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [chatContextAvailable, fetchSessionMessages]);

  // ✅ UPDATE SESSION TITLE
  const updateSessionTitle = useCallback(async (sessionId, firstMessage) => {
    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{24}$/)) return;

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
      
      window.dispatchEvent(new CustomEvent('sessionUpdated', {
        detail: { session: res.data.session }
      }));
      
    } catch (err) {
      console.error('Failed to update session title:', err);
    }
  }, [backendUrl, token]);

  // ✅ VOICE INPUT HANDLERS
  const handleVoiceInput = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }
    
    if (listening) {
      SpeechRecognition.stopListening();
      setHasStoppedListening(true);
    } else {
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
      setIsManuallyEditing(true);
      SpeechRecognition.stopListening();
      setHasStoppedListening(true);
    }
  }, [listening]);

  // ✅ SUBMIT HANDLER - Use activeSessionId
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    
    // ✅ Use selectedSession as primary source
    const sessionToUse = selectedSession;
    if (!sessionToUse || isAIStreaming) {
      console.log('❌ Cannot submit - no session or AI is streaming');
      return;
    }

    console.log('📤 Submitting message to session:', sessionToUse);
    
    setIsManuallyEditing(false);
    setHasStoppedListening(false);
    
    const originalInput = input;
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const isFirstMessage = actualMessages.length === 0;
    
    // Clear input immediately
    setInput("");
    setFile(null);
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    // Handle file upload
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
        console.error('File upload failed:', err);
      } finally {
        setIsUploading(false);
      }
    }

    // Create user message
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

    // Add user message to session
    if (chatContextAvailable && setSessionMessages) {
      const currentMessages = getCurrentSessionMessages();
      setSessionMessages(sessionToUse, [...currentMessages, userMessage]);
    }

    // Send message
    const messagePayload = {
      sessionId: sessionToUse,
      senderId: userId,
      message: originalInput,
      type: fileType || "text",
      fileUrl,
      fileType,
      tempId: tempMessageId
    };

    try {
      if (chatContextAvailable && sendMessage) {
        const result = await sendMessage(messagePayload);
        
        if (result.success && isFirstMessage && originalInput.trim()) {
          updateSessionTitle(sessionToUse, originalInput.trim());
        }
      }
    } catch (error) {
      console.error('Error during message submission:', error);
    }
  }, [input, file, selectedSession, isAIStreaming, actualMessages.length, userId, resetTranscript, backendUrl, token, chatContextAvailable, setSessionMessages, getCurrentSessionMessages, sendMessage, updateSessionTitle]);

  // ✅ HANDLE SESSION CHANGES FROM PARENT
  useEffect(() => {
    if (!hasInitialized) return;
    if (selectedSession === lastProcessedSession) return;

    console.log('🔄 [DASHBOARD] Processing session change:', { 
      from: lastProcessedSession,
      to: selectedSession
    });

    setLastProcessedSession(selectedSession);

    if (selectedSession && selectedSession !== 'null' && selectedSession !== 'undefined') {
      // Sync with context
      if (chatContextAvailable && setSession && selectedSession !== currentSessionId) {
        setSession(selectedSession);
      }
      
      // Fetch messages if needed
      if (!actualIsConnected || selectedSession !== currentSessionId) {
        fetchMessagesViaHTTP(selectedSession);
      }
    } else {
      // Clear state
      setFallbackMessages([]);
      if (chatContextAvailable && setSession) {
        setSession(null);
      }
    }
  }, [selectedSession, hasInitialized, lastProcessedSession, currentSessionId, actualIsConnected, chatContextAvailable, setSession, fetchMessagesViaHTTP]);

  // ✅ FALLBACK TRIGGER - Only for active sessions without messages
  useEffect(() => {
    const activeSessionId = lastProcessedSession;
    
    if (activeSessionId && 
        !actualIsConnected && 
        actualMessages.length === 0 && 
        !isFetchingFallback && 
        hasInitialized) {
      console.log('🔄 Triggering fallback fetch for:', activeSessionId);
      fetchMessagesViaHTTP(activeSessionId);
    }
  }, [lastProcessedSession, actualIsConnected, actualMessages.length, isFetchingFallback, hasInitialized, fetchMessagesViaHTTP]);

  // ✅ AUTO-SCROLL
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

  // ✅ DEBUG LOGGING
  useEffect(() => {
    console.log('🔍 Session state:', {
      lastProcessedSession,
      currentSessionId,
      selectedSession,
      hasInitialized,
      actualIsConnected,
      messagesCount: actualMessages.length
    });
  }, [lastProcessedSession, currentSessionId, selectedSession, hasInitialized, actualIsConnected, actualMessages.length]);

  // ✅ MAIN RENDER WITH THEME INTEGRATION
  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    } ${isTransitioning ? 'animate-pulse' : ''}`}>
      
      {/* ✅ HEADER WITH THEME TOGGLE */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <IconRobot size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              Nexus AI Assistant
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            {!actualIsConnected && (
              <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Reconnecting...
              </div>
            )}
            
            {/* ✅ THEME TOGGLE BUTTON */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isTransitioning ? 'animate-spin' : ''
              }`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? (
                <IconSun size={18} className="text-yellow-500" />
              ) : (
                <IconMoon size={18} className="text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ✅ MESSAGES AREA - REDUCED PADDING */}
      <div className="flex-1 overflow-y-auto py-4">
        {(isFetchingFallback || isLoadingMessages) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-10 h-10 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-ping opacity-20"></div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading conversation...</p>
            </div>
          </div>
        ) : actualMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center space-y-4 max-w-md">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <IconRobot size={32} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                  Hello! I'm your AI assistant
                </h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                  I'm here to help you with coding, writing, analysis, and much more. 
                  Start a conversation by typing a message below.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                  <div className="text-xl mb-1">💭</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-xs">Ask Questions</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">Get instant answers</div>
                </div>
                
                <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                  <div className="text-xl mb-1">🎤</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-xs">Voice Input</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">Speak naturally</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {actualMessages.map((msg, index) => (
              <div key={msg._id || index}>
                {msg.sender === 'AI' ? (
                  <AiMessage
                    message={msg.message}
                    timestamp={msg.timestamp}
                    fileUrl={msg.fileUrl}
                    fileType={msg.type}
                    isStreaming={msg.isStreaming}
                  />
                ) : (
                  <UserMessage
                    message={msg.message}
                    timestamp={msg.timestamp}
                    status={msg.status}
                    fileUrl={msg.fileUrl}
                    type={msg.type}
                  />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ✅ COMPACT INPUT AREA */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-600/50 px-3 py-2">
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
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer group"
                title="Upload file"
              >
                <IconUpload size={18} className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200 transition-colors" />
              </label>

              {/* Voice Input */}
              {browserSupportsSpeechRecognition && (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    listening 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
                  title={listening ? "Stop recording" : "Start voice input"}
                >
                  {listening ? <IconCheck size={18} /> : <IconMicrophone size={18} />}
                </button>
              )}

              {/* Text Input */}
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder={listening ? "Listening..." : "Ask me anything..."}
                className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 text-sm py-1"
                disabled={isAIStreaming}
              />

              {/* Send Button */}
              <button
                type="submit"
                className={`p-2 rounded-lg transition-all duration-200 ${
                  (!input.trim() && !file) || isUploading || isAIStreaming
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
                }`}
                disabled={(!input.trim() && !file) || isUploading || isAIStreaming}
                title="Send message"
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <IconSend size={18} />
                )}
              </button>
            </div>
          </form>

          {/* ✅ COMPACT STATUS INDICATORS */}
          {(file || listening) && (
            <div className="flex items-center gap-4 mt-2 px-2 text-xs">
              {file && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <IconPaperclip size={12} />
                  <span>{file.name}</span>
                </div>
              )}
              
              {listening && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>Listening...</span>
                </div>
              )}
            </div>
          )}

          {/* AI Status */}
          {isAIStreaming && (
            <div className="text-xs text-blue-500 dark:text-blue-400 mt-2 px-2 flex items-center gap-2">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              AI is responding...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatDashBoard;