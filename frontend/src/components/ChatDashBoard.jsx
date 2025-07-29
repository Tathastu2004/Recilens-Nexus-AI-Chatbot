"use client";
import React, { useState, useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck } from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useChat } from '../context/ChatContext'; // ✅ MAKE SURE THIS IMPORT IS CORRECT
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

  // ✅ SIMPLIFIED CHAT CONTEXT USAGE WITH BETTER ERROR HANDLING
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
    isSessionStreaming // ✅ ADD THIS
  } = chatContext || {};

  const actualCurrentSessionId = chatContextAvailable ? contextSessionId : currentSessionId;
  const actualIsConnected = chatContextAvailable ? (contextIsConnected ?? true) : isConnected;
  const actualMessages = chatContextAvailable ? (getCurrentSessionMessages ? getCurrentSessionMessages() : []) : messages;

  // ✅ ADD THE MISSING isAITyping VARIABLE
  const isAITyping = chatContextAvailable ? 
    (isSessionStreaming ? isSessionStreaming(actualCurrentSessionId) : false) : 
    isTyping;

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // ✅ IMPROVED CONNECTION STATUS EFFECT
  useEffect(() => {
    if (chatContextAvailable) {
      console.log('🔌 [CONNECTION STATUS] Context connection status:', {
        contextIsConnected,
        connectionStatus,
        updating: contextIsConnected !== isConnected
      });
      
      // ✅ ONLY UPDATE IF DIFFERENT TO AVOID LOOPS
      if (contextIsConnected !== isConnected) {
        setIsConnected(contextIsConnected ?? true);
      }
    } else {
      // ✅ FALLBACK MODE - ASSUME CONNECTED IF NO CONTEXT
      if (!isConnected) {
        console.log('🔄 [CONNECTION STATUS] Fallback mode - setting connected');
        setIsConnected(true);
      }
    }
  }, [chatContextAvailable, contextIsConnected, connectionStatus]);

  // ✅ ADD INDEPENDENT CONNECTION CHECK FOR FALLBACK MODE
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

      // ✅ IMMEDIATE CHECK
      checkFallbackConnection();
      
      // ✅ PERIODIC CHECK EVERY 15 SECONDS
      const interval = setInterval(checkFallbackConnection, 15000);
      return () => clearInterval(interval);
    }
  }, [chatContextAvailable, backendUrl, isConnected]);

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
      actualCurrentSessionId
    });

    // ✅ GUARD: Prevent processing the same session multiple times
    if (selectedSession === lastProcessedSession) {
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

    // ✅ HANDLE EXISTING SESSION SWITCH ONLY
    if (selectedSession !== actualCurrentSessionId) {
      console.log('🔗 [SESSION SELECTION] Switching to session:', selectedSession);
      
      setLastProcessedSession(selectedSession);
      
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      } else {
        setCurrentSessionId(selectedSession);
      }
      
      // ✅ ALWAYS FETCH MESSAGES FOR REAL SESSIONS
      if (selectedSession.match(/^[0-9a-fA-F]{24}$/)) {
        fetchMessages(selectedSession);
      } else {
        // Clear messages for invalid sessions
        if (chatContextAvailable && setSessionMessages) {
          setSessionMessages(selectedSession, []);
        } else {
          setMessages([]);
        }
      }
    } else {
      setLastProcessedSession(selectedSession);
    }

  }, [selectedSession]); // ✅ ONLY selectedSession dependency

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

  // ✅ SIMPLIFIED SESSION TITLE UPDATE
  const updateSessionTitle = async (sessionId, firstMessage) => {
    // ✅ SKIP IF INVALID SESSION
    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('⚠️ [UPDATE TITLE] Invalid session ID:', sessionId);
      return;
    }

    try {
      const title = firstMessage.length > 30 
        ? `${firstMessage.substring(0, 30)}...` 
        : firstMessage;

      console.log('📝 [UPDATE TITLE] Updating session title immediately:', { sessionId, title });

      // ✅ IMMEDIATE SOCKET EMIT FOR REAL-TIME UPDATE
      if (chatContextAvailable && socket) {
        socket.emit('update-session-title', { sessionId, title });
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

  // ✅ REMOVE className FROM ReactMarkdown AND USE A WRAPPER DIV INSTEAD
  const MessageRenderer = ({ message, isAI }) => {
    if (!isAI) {
      // User messages - simple text
      return <div className="whitespace-pre-wrap break-words">{message}</div>;
    }

    // AI messages - full markdown support
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-md !mt-2 !mb-2"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code 
                  className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono" 
                  {...props}
                >
                  {children}
                </code>
              );
            },
            p({ children }) {
              return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
            },
            ul({ children }) {
              return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            h1({ children }) {
              return <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>;
            },
            blockquote({ children }) {
              return <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>;
            },
            strong({ children }) {
              return <strong className="font-semibold">{children}</strong>;
            },
            em({ children }) {
              return <em className="italic">{children}</em>;
            }
          }}
        >
          {message}
        </ReactMarkdown>
      </div>
    );
  };

  // ✅ UPDATE THE HEADER TO SHOW MORE ACCURATE STATUS
  return (
    <div className="flex flex-col h-screen bg-white">
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
            {/* ✅ ADD CONTEXT STATUS INDICATOR */}
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
                <div className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg shadow-sm ${
                  msg.sender === 'AI' 
                    ? 'bg-gray-50 text-gray-800 border border-gray-200' 
                    : msg.status === 'failed'
                      ? 'bg-red-50 text-red-800 border border-red-300'
                      : 'bg-blue-500 text-white'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs font-medium">
                      {msg.sender === 'AI' ? '🤖 AI Assistant' : '👤 You'}
                    </div>
                    {msg.status === 'failed' && <span className="text-red-500">⚠️</span>}
                    {msg.optimistic && <span className="text-gray-400">⏳</span>}
                  </div>
                  
                  {/* ✅ USE NEW MESSAGE RENDERER */}
                  <div className="text-sm">
                    <MessageRenderer 
                      message={msg.message} 
                      isAI={msg.sender === 'AI'} 
                    />
                  </div>
                  
                  {msg.fileUrl && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      {msg.type === 'image' ? (
                        <img 
                          src={msg.fileUrl} 
                          alt="Uploaded" 
                          className="max-w-full h-auto rounded border"
                        />
                      ) : (
                        <a 
                          href={msg.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={`inline-flex items-center gap-1 text-sm hover:underline ${
                            msg.sender === 'AI' ? 'text-blue-600' : 'text-blue-200'
                          }`}
                        >
                          📎 View File
                        </a>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-2 pt-1">
                    <div className={`text-xs opacity-70 ${
                      msg.sender === 'AI' ? 'text-gray-500' : 'text-blue-100'
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                    {msg.status === 'failed' && (
                      <span className="text-xs text-red-600">Failed to send</span>
                    )}
                    {msg.status === 'sending' && (
                      <span className="text-xs text-gray-500">Sending...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isAITyping && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-gray-600">🤖 AI Assistant</div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="text-sm text-gray-600">AI is thinking</div>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
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

// ✅ ADD THE MISSING createNewSession FUNCTION
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

      // Set the new session as current
      if (chatContextAvailable && setSession) {
        setSession(newSession._id);
      } else {
        setCurrentSessionId(newSession._id);
        setMessages([]);
      }

      // Notify parent component to update sidebar
      if (onSessionUpdate) {
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
};

export default ChatDashBoard;
