"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck, IconPaperclip, IconUser, IconSun, IconMoon, IconClipboard, IconX } from "@tabler/icons-react";
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

  // ✅ STATE MANAGEMENT
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  // ✅ NEW STATE FOR COPY-PASTE FUNCTIONALITY
  const [pastedImage, setPastedImage] = useState(null);
  const [pastePreview, setPastePreview] = useState(null);
  const [showPasteIndicator, setShowPasteIndicator] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // ✅ REF FOR INPUT ELEMENT

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
    currentSessionId: contextSessionId,
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
  const activeSessionId = selectedSession || currentSessionId;
  const isAIStreaming = chatContextAvailable ? (isSessionStreaming ? isSessionStreaming(activeSessionId) : false) : false;

  // ✅ IMAGE PASTE UTILITY FUNCTIONS
  const createFileFromBlob = (blob, filename = 'pasted-image.png') => {
    return new File([blob], filename, { type: blob.type });
  };

  const createImagePreview = useCallback((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }, []);

  // ✅ HANDLE CLIPBOARD PASTE
  const handlePaste = useCallback(async (e) => {
    console.log('📋 [PASTE] Paste event triggered');
    
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    let imageFound = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // ✅ CHECK FOR IMAGE TYPES
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // Prevent default paste behavior
        imageFound = true;
        
        console.log('🖼️ [PASTE] Image detected in clipboard:', item.type);
        
        const blob = item.getAsFile();
        if (blob) {
          // ✅ CREATE FILE FROM BLOB
          const imageFile = createFileFromBlob(blob, `pasted-image-${Date.now()}.png`);
          
          // ✅ CREATE PREVIEW
          const previewUrl = await createImagePreview(imageFile);
          
          console.log('✅ [PASTE] Image processed:', {
            size: imageFile.size,
            type: imageFile.type,
            name: imageFile.name
          });
          
          // ✅ SET PASTED IMAGE STATE
          setPastedImage(imageFile);
          setPastePreview(previewUrl);
          setFile(imageFile); // Also set as file for upload
          
          // ✅ SHOW PASTE INDICATOR
          setShowPasteIndicator(true);
          setTimeout(() => setShowPasteIndicator(false), 2000);
          
          break;
        }
      }
    }

    if (!imageFound) {
      console.log('📋 [PASTE] No image found in clipboard');
    }
  }, [createImagePreview]);

  // ✅ KEYBOARD SHORTCUTS
  const handleKeyDown = useCallback((e) => {
    // ✅ CTRL/CMD + V for paste (handled by handlePaste)
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      console.log('📋 [KEYBOARD] Paste shortcut detected');
    }
    
    // ✅ CTRL/CMD + ENTER to send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (input.trim() || file || pastedImage) {
        handleSubmit(e);
      }
    }
    
    // ✅ ESC to clear pasted image
    if (e.key === 'Escape' && pastedImage) {
      clearPastedImage();
    }
  }, [input, file, pastedImage]);

  // ✅ CLEAR PASTED IMAGE
  const clearPastedImage = useCallback(() => {
    console.log('🗑️ [PASTE] Clearing pasted image');
    setPastedImage(null);
    setPastePreview(null);
    setFile(null);
    
    // Clear file input
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";
  }, []);

  // ✅ ATTACH EVENT LISTENERS
  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;

    console.log('📋 [PASTE] Attaching paste event listeners');
    
    inputElement.addEventListener('paste', handlePaste);
    inputElement.addEventListener('keydown', handleKeyDown);
    
    // ✅ ALSO ATTACH TO DOCUMENT FOR GLOBAL PASTE
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      inputElement.removeEventListener('paste', handlePaste);
      inputElement.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste, handleKeyDown]);

  // ✅ FALLBACK FETCH FUNCTION - MOVED BEFORE useEffect
  const fetchMessagesViaHTTP = useCallback(async (sessionId) => {
    if (!sessionId || !token) {
      console.log('❌ Cannot fetch messages - missing sessionId or token');
      return [];
    }
    
    console.log('📡 [HTTP FETCH] Fetching messages for session:', sessionId);
    
    try {
      setIsFetchingFallback(true);
      
      // ✅ UPDATED ENDPOINT PATH
      const response = await axios.get(`${backendUrl}/api/chat/session/${sessionId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 15000 // Increased timeout
      });
      
      console.log('📥 [HTTP FETCH] Response received:', {
        status: response.status,
        success: response.data.success,
        messageCount: response.data.messages?.length || 0
      });
      
      if (response.data.success) {
        const messages = response.data.messages || [];
        console.log('✅ [HTTP FETCH] Messages loaded successfully:', messages.length);
        
        // ✅ SET MESSAGES AND SYNC WITH CONTEXT
        setFallbackMessages(messages);
        
        // ✅ ALSO UPDATE CONTEXT IF AVAILABLE
        if (chatContextAvailable && setSessionMessages) {
          console.log('🔄 [HTTP FETCH] Syncing with context...');
          setSessionMessages(sessionId, messages);
        }
        
        return messages;
      } else {
        console.log('❌ [HTTP FETCH] Failed:', response.data.error || response.data.message);
        setFallbackMessages([]);
        return [];
      }
    } catch (error) {
      console.error('❌ [HTTP FETCH] Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      setFallbackMessages([]);
      
      // If it's a network error, try to reconnect context
      if (chatContextAvailable && reconnect) {
        console.log('🔄 [HTTP FETCH] Attempting context reconnection...');
        reconnect();
      }
      
      return [];
    } finally {
      setIsFetchingFallback(false);
    }
  }, [backendUrl, token, chatContextAvailable, reconnect, setSessionMessages]);

  // ✅ INITIALIZE SESSION ON MOUNT - NOW fetchMessagesViaHTTP IS AVAILABLE
  useEffect(() => {
    const initializeSession = async () => {
      console.log('🚀 [DASHBOARD] Initializing dashboard with session:', selectedSession);
      
      if (selectedSession && selectedSession !== 'null' && selectedSession !== 'undefined') {
        console.log('📍 [DASHBOARD] Setting up session immediately:', selectedSession);
        
        // Set current session state
        setCurrentSessionId(selectedSession);
        
        // Sync with context if available
        if (chatContextAvailable && setSession) {
          console.log('📡 [DASHBOARD] Setting session in context:', selectedSession);
          setSession(selectedSession);
        }
        
        // ✅ FETCH MESSAGES WITH RETRY LOGIC
        console.log('📨 [DASHBOARD] Starting message fetch...');
        try {
          const messages = await fetchMessagesViaHTTP(selectedSession);
          
          // ✅ DOUBLE-CHECK: Also try context fetch if HTTP didn't get messages
          if ((!messages || messages.length === 0) && chatContextAvailable && fetchSessionMessages) {
            console.log('🔄 [DASHBOARD] Trying context fetch as fallback...');
            await fetchSessionMessages(selectedSession);
          }
        } catch (error) {
          console.error('❌ [DASHBOARD] Failed to fetch messages:', error);
        }
      }
      
      setHasInitialized(true);
    };

    // ✅ IMMEDIATE INITIALIZATION - NO DELAYS
    if (!hasInitialized) {
      initializeSession();
    }
  }, [selectedSession, hasInitialized, chatContextAvailable, fetchMessagesViaHTTP, setSession, fetchSessionMessages]);

  // ✅ WATCH FOR SESSION CHANGES FROM PARENT
  useEffect(() => {
    if (selectedSession && selectedSession !== currentSessionId) {
      console.log('🔄 [SESSION CHANGE] New session from parent:', selectedSession);
      
      // Clear old data first
      setFallbackMessages([]);
      setCurrentSessionId(selectedSession);
      
      // ✅ CLEAR PASTED IMAGE ON SESSION CHANGE
      clearPastedImage();
      
      // Sync with context
      if (chatContextAvailable && setSession) {
        setSession(selectedSession);
      }
      
      // ✅ FETCH MESSAGES IMMEDIATELY WITH PROPER ERROR HANDLING
      fetchMessagesViaHTTP(selectedSession).then(messages => {
        console.log('📨 [SESSION CHANGE] Messages fetched:', messages?.length || 0);
      }).catch(error => {
        console.error('❌ [SESSION CHANGE] Failed to fetch messages:', error);
      });
      
      // ✅ ALSO TRY CONTEXT FETCH
      if (chatContextAvailable && fetchSessionMessages) {
        fetchSessionMessages(selectedSession);
      }
    }
  }, [selectedSession, currentSessionId, chatContextAvailable, setSession, fetchMessagesViaHTTP, fetchSessionMessages, clearPastedImage]);

  // ✅ GET CURRENT MESSAGES - PRIORITIZE REAL DATA
  const actualMessages = useMemo(() => {
    if (chatContextAvailable && actualIsConnected && getCurrentSessionMessages) {
      const contextMessages = getCurrentSessionMessages();
      if (contextMessages.length > 0) {
        console.log('📋 [MESSAGES] Using context messages:', contextMessages.length);
        return contextMessages;
      }
    }
    
    // Fallback to HTTP messages
    console.log('📋 [MESSAGES] Using fallback messages:', fallbackMessages.length);
    return fallbackMessages;
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

  // ✅ MODERN USER MESSAGE COMPONENT
  const UserMessage = ({ message, timestamp, status, fileUrl, type, fileType }) => (
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
              {(type === 'image' || fileType?.startsWith('image/')) ? (
                <div className="space-y-2">
                  <img 
                    src={fileUrl} 
                    alt="Uploaded" 
                    className="max-w-full max-h-64 h-auto rounded-lg shadow-md object-cover"
                    // onLoad={}
                    // onError={}
                  />
                  <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
                    🖼️ Image will be analyzed by BLIP model
                  </div>
                </div>
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

  // ✅ AI MESSAGE COMPONENT - UPDATED WITH AGGRESSIVE EMOJI REMOVAL
  const AiMessage = ({ message, timestamp, fileUrl, fileType, isStreaming = false }) => {
    const isBLIPResponse = message.includes('🖼️') || 
                          message.includes('Image') || 
                          message.includes('BLIP') ||
                          (fileUrl && fileType?.startsWith('image/'));

    // ✅ AGGRESSIVE CLEAN UP FUNCTION - REMOVES ALL EMOJIS AND VERBOSE TEXT
    const cleanMessage = useCallback((rawMessage) => {
      if (!rawMessage) return '';
      
      let cleaned = rawMessage;
      
      // ✅ STEP 1: Remove ALL emojis first (most aggressive approach)
      cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      
      // ✅ STEP 2: Remove specific processing patterns
      const processingPatterns = [
        // Loading sequences
        /Loading and analyzing image[^.]*\.*/gi,
        /Downloading image[^.]*\.*/gi,
        /Image loaded successfully[^)]*\)[^.]*\.*/gi,
        /Analyzing image content[^.]*\.*/gi,
        
        // Analysis patterns - MORE COMPREHENSIVE
        /Additional Analysis[:\s]*[^!]*!*/gi,
        /Analysis complete!*/gi,
        
        // Description labels
        /Image Description[:\s]*/gi,
        /Description[:\s]*/gi,
      ];
      
      // Apply all patterns
      processingPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
      
      // ✅ STEP 3: Remove any remaining emoji-like characters and symbols
      cleaned = cleaned
        .replace(/[🖼️📥✅🔍📊🔎📋•\-]/g, '') // Specific problematic emojis
        .replace(/[\u{1F000}-\u{1F9FF}]/gu, '') // Extended emoji range
        .replace(/[\u{2000}-\u{2BFF}]/gu, '') // Symbols and punctuation
        .replace(/[•\-•]/g, '') // Bullet points and dashes
        .replace(/\s+/g, ' ') // Multiple spaces
        .trim();
      
      // ✅ STEP 4: Extract meaningful description if still has processing text
      if (cleaned.includes('pixels') || cleaned.includes('successfully') || cleaned.includes('complete')) {
        // Try to extract just the actual description
        const descriptionPatterns = [
          /(a\s+[^.]*?cat[^.]*?)(?:\s|$)/i,
          /(the\s+[^.]*?)(?:\s|$)/i,
          /(.*?(?:cat|dog|person|animal|scene)[^.]*?)(?:\s|$)/i,
          /([a-z][^.]*?)(?:\s|$)/i
        ];
        
        for (const pattern of descriptionPatterns) {
          const match = cleaned.match(pattern);
          if (match && match[1] && match[1].trim().length > 5) {
            cleaned = match[1].trim();
            break;
          }
        }
      }
      
      // ✅ STEP 5: Final aggressive cleanup
      cleaned = cleaned
        .replace(/^[^\w]*/, '') // Remove non-word chars at start
        .replace(/[^\w\s.!?,]*$/g, '') // Remove non-word chars at end except basic punctuation
        .replace(/\s+/g, ' ') // Multiple spaces again
        .trim();
      
      // ✅ STEP 6: Remove any trailing single characters or symbols
      cleaned = cleaned.replace(/\s+[^\w\s.!?]{1}$/, '');
      
      // ✅ STEP 7: Capitalize first letter
      if (cleaned && cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      
      // ✅ STEP 8: Add period if missing and it's a proper description
      if (cleaned && cleaned.length > 10 && !/[.!?]$/.test(cleaned)) {
        cleaned += '.';
      }
      
      // ✅ STEP 9: Final emoji sweep (just to be absolutely sure)
      cleaned = cleaned.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
      
      // ✅ FALLBACK: Return original if cleaning failed
      if (!cleaned || cleaned.length < 3) {
        // Last resort: try to extract just letters, spaces, and basic punctuation
        const lastResort = rawMessage.replace(/[^\w\s.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
        return lastResort || rawMessage;
      }
      
      return cleaned;
    }, []);

    const displayMessage = cleanMessage(message);

    return (
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
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isBLIPResponse ? 'Analyzing image...' : 'AI is thinking...'}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {isBLIPResponse && (
                  <div className="inline-flex items-center gap-2 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-md text-xs text-purple-600 dark:text-purple-400 mb-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Image Analysis
                  </div>
                )}
                
                <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="mb-1 leading-relaxed">{children}</p>,
                    }}
                  >
                    {displayMessage}
                  </ReactMarkdown>
                </div>
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
  };

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

  // ✅ SUBMIT HANDLER - UPDATED TO HANDLE PASTED IMAGES
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim() && !file && !pastedImage) return;
    
    const sessionToUse = activeSessionId;
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
    const fileToUpload = pastedImage || file; // ✅ PRIORITIZE PASTED IMAGE
    
    // Clear input immediately
    setInput("");
    setFile(null);
    clearPastedImage(); // ✅ CLEAR PASTED IMAGE
    resetTranscript();
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";

    // Handle file upload
    let fileUrl = null;
    let fileType = null;
    let requestType = 'chat';

    if (fileToUpload) {
      try {
        setIsUploading(true);
        
        const isImage = fileToUpload.type.startsWith("image/");
        console.log('📎 [UPLOAD] File detected:', {
          name: fileToUpload.name,
          type: fileToUpload.type,
          size: fileToUpload.size,
          isImage: isImage,
          isPasted: !!pastedImage
        });

        if (isImage) {
          console.log('🖼️ [UPLOAD] Image detected - Will route to BLIP model');
          requestType = 'image';
          fileType = 'image';
        } else {
          console.log('📄 [UPLOAD] Document detected - Will route to Llama3 model');
          requestType = 'chat';
          fileType = 'document';
        }

        const formData = new FormData();
        formData.append("file", fileToUpload);

        console.log('📤 [UPLOAD] Uploading file to backend...');
        const res = await axios.post(`${backendUrl}/api/chat/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        if (res.data.success) {
          fileUrl = res.data.fileUrl || res.data.url;
          console.log('✅ [UPLOAD] File uploaded successfully:', {
            fileUrl: fileUrl,
            type: requestType,
            willUseBLIP: requestType === 'image',
            wasPasted: !!pastedImage
          });
        }
      } catch (err) {
        console.error('❌ [UPLOAD] File upload failed:', err);
        return;
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
      fileType: fileToUpload?.type || null,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    // Add user message to session
    if (chatContextAvailable && setSessionMessages) {
      const currentMessages = getCurrentSessionMessages();
      setSessionMessages(sessionToUse, [...currentMessages, userMessage]);
    } else {
      // Fallback: add to local state
      setFallbackMessages(prev => [...prev, userMessage]);
    }

    const messagePayload = {
      sessionId: sessionToUse,
      senderId: userId,
      message: originalInput,
      type: requestType,
      fileUrl,
      fileType: fileToUpload?.type || null,
      tempId: tempMessageId
    };

    console.log('📤 [AI REQUEST] Sending to AI service:', {
      type: messagePayload.type,
      hasFileUrl: !!messagePayload.fileUrl,
      expectedModel: messagePayload.type === 'image' ? 'BLIP' : 'Llama3',
      wasPasted: !!pastedImage
    });

    try {
      if (chatContextAvailable && sendMessage) {
        console.log('🌊 [STREAMING] Starting AI request...');
        const result = await sendMessage(messagePayload);
        
        if (result.success) {
          console.log('✅ [AI RESPONSE] Message processed successfully');
          
          if (isFirstMessage && originalInput.trim()) {
            updateSessionTitle(sessionToUse, originalInput.trim());
          }
        } else {
          console.error('❌ [AI RESPONSE] Message processing failed:', result.error);
        }
      }
    } catch (error) {
      console.error('❌ [AI ERROR] Error during message submission:', error);
    }
  }, [input, file, pastedImage, activeSessionId, isAIStreaming, actualMessages.length, userId, resetTranscript, backendUrl, token, chatContextAvailable, setSessionMessages, getCurrentSessionMessages, sendMessage, updateSessionTitle, clearPastedImage]);

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
    console.log('🔍 Dashboard state:', {
      selectedSession,
      currentSessionId,
      activeSessionId,
      hasInitialized,
      actualIsConnected,
      messagesCount: actualMessages.length,
      isFetching: isFetchingFallback,
      hasPastedImage: !!pastedImage
    });
  }, [selectedSession, currentSessionId, activeSessionId, hasInitialized, actualIsConnected, actualMessages.length, isFetchingFallback, pastedImage]);

  // ✅ MAIN RENDER
  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    } ${isTransitioning ? 'animate-pulse' : ''}`}>
      
      {/* ✅ PASTE INDICATOR */}
      {showPasteIndicator && (
        <div className="absolute top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in flex items-center gap-2">
          <IconClipboard size={16} />
          <span className="text-sm font-medium">Image pasted!</span>
        </div>
      )}
      
      {/* ✅ HEADER */}
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
            {!actualIsConnected && (
              <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Reconnecting...
              </div>
            )}
            
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

      {/* ✅ MESSAGES AREA */}
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
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
                  💡 <strong>Tip:</strong> You can paste images directly with <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+V</kbd>
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                  <div className="text-xl mb-1">💭</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-xs">Ask Questions</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">Get instant answers</div>
                </div>
                
                <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                  <div className="text-xl mb-1">🖼️</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-xs">Paste Images</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">Ctrl+V to paste</div>
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

      {/* ✅ INPUT AREA - UPDATED WITH PASTE PREVIEW */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          
          {/* ✅ PASTED IMAGE PREVIEW */}
          {pastedImage && pastePreview && (
            <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <img 
                    src={pastePreview} 
                    alt="Pasted" 
                    className="w-16 h-16 rounded-lg object-cover border-2 border-blue-300 dark:border-blue-600"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <IconClipboard size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Pasted Image Ready
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {pastedImage.name} • {(pastedImage.size / 1024).toFixed(1)} KB
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                    Press <kbd className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">Enter</kbd> to send or <kbd className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">Esc</kbd> to cancel
                  </p>
                </div>
                <button
                  onClick={clearPastedImage}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  title="Remove pasted image"
                >
                  <IconX size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-600/50 px-3 py-2">
              <input
                type="file"
                onChange={(e) => {
                  const selectedFile = e.target.files[0];
                  if (selectedFile) {
                    console.log('📎 [FILE SELECT] File selected:', {
                      name: selectedFile.name,
                      type: selectedFile.type,
                      isImage: selectedFile.type.startsWith('image/')
                    });
                    
                    // ✅ CLEAR PASTED IMAGE IF FILE IS SELECTED
                    if (pastedImage) {
                      clearPastedImage();
                    }
                  }
                  setFile(selectedFile);
                }}
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

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder={listening ? "Listening..." : pastedImage ? "Add a message (optional)..." : "Ask me anything or paste an image..."}
                className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 text-sm py-1"
                disabled={isAIStreaming}
              />

              <button
                type="submit"
                className={`p-2 rounded-lg transition-all duration-200 ${
                  (!input.trim() && !file && !pastedImage) || isUploading || isAIStreaming
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
                }`}
                disabled={(!input.trim() && !file && !pastedImage) || isUploading || isAIStreaming}
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

          {/* ✅ FILE/VOICE STATUS INDICATORS */}
          {((file && !pastedImage) || listening) && (
            <div className="flex items-center gap-4 mt-2 px-2 text-xs">
              {file && !pastedImage && (
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

          {/* ✅ AI STREAMING INDICATOR */}
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