"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  IconSend, IconRobot, IconUpload, IconMicrophone, IconCheck, IconPaperclip, IconUser, 
  IconSun, IconMoon, IconClipboard, IconX, IconFileText, IconFile, IconFileWord, 
  IconDownload, IconAlertCircle 
} from "@tabler/icons-react";
import axios from "axios";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const ChatDashBoard = ({ selectedSession, onSessionUpdate, onSessionDelete, onMobileMenuToggle }) => {
  // ✅ CLERK AUTH INTEGRATION
  const { getToken, userId: clerkUserId, isSignedIn } = useAuth();
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // ✅ GET CLERK TOKEN HELPER
  const getAuthToken = useCallback(async () => {
    if (!isSignedIn) {
      console.warn('⚠️ [CHAT DASHBOARD] User not signed in');
      return null;
    }
    try {
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('❌ [CHAT DASHBOARD] Failed to get Clerk token:', error);
      return null;
    }
  }, [getToken, isSignedIn]);

  // THEME CONTEXT
  const { isDark, toggleTheme } = useTheme();

  // STATE MANAGEMENT
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isAIStreaming, setIsAIStreaming] = useState(false);
  const [activeFileContext, setActiveFileContext] = useState(null);
  const [pastedImage, setPastedImage] = useState(null);
  const [pastePreview, setPastePreview] = useState(null);
  const [showPasteIndicator, setShowPasteIndicator] = useState(false);
  const [fileValidationError, setFileValidationError] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // CHAT CONTEXT INTEGRATION
  let chatContext = null;
  let chatContextAvailable = false;
  try {
    chatContext = useChat();
    chatContextAvailable = true;
  } catch (error) {
    chatContextAvailable = false;
  }

  const {
    currentSessionId: contextSessionId,
    setSession,
    sendMessage,
    addMessageToSession,
    getCurrentSessionMessages,
    setSessionMessages,
    isConnected,
    fetchSessionMessages,
    isSessionStreaming,
    detectFileType,
    validateFile
  } = chatContext || {};

  // FALLBACK MESSAGE FETCHING
  const [fallbackMessages, setFallbackMessages] = useState([]);
  const [isFetchingFallback, setIsFetchingFallback] = useState(false);

  const actualIsConnected = chatContextAvailable ? (isConnected ?? false) : false;
  const activeSessionId = selectedSession || currentSessionId;

  // ✅ ENHANCED FILE TYPE DETECTION
  const getFileIcon = useCallback((fileType, fileName) => {
    const type = detectFileType ? detectFileType(null, fileName, fileType) : 'unknown';
    switch (type) {
      case 'image':
        return <IconClipboard size={16} className="text-blue-500" />;
      case 'document':
        if (fileName?.toLowerCase().endsWith('.pdf') || fileType?.includes('pdf')) {
          return <IconFile size={16} className="text-red-500" />;
        } else if (fileName?.toLowerCase().match(/\.(docx?|doc)$/i) || fileType?.includes('word')) {
          return <IconFileWord size={16} className="text-blue-500" />;
        } else {
          return <IconFileText size={16} className="text-gray-500" />;
        }
      default:
        return <IconPaperclip size={16} className="text-gray-500" />;
    }
  }, [detectFileType]);

  // IMAGE PASTE UTILITY FUNCTIONS
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

  // HANDLE CLIPBOARD PASTE
  const handlePaste = useCallback(async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const imageFile = createFileFromBlob(blob, `pasted-image-${Date.now()}.png`);
          const previewUrl = await createImagePreview(imageFile);
          setPastedImage(imageFile);
          setPastePreview(previewUrl);
          setFile(imageFile);
          setShowPasteIndicator(true);
          setTimeout(() => setShowPasteIndicator(false), 2000);
          break;
        }
      }
    }
  }, [createImagePreview]);

  // KEYBOARD SHORTCUTS
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (input.trim() || file || pastedImage) handleSubmit(e);
    }
    if (e.key === 'Escape' && pastedImage) clearPastedImage();
  }, [input, file, pastedImage]);

  // CLEAR PASTED IMAGE
  const clearPastedImage = useCallback(() => {
    setPastedImage(null);
    setPastePreview(null);
    setFile(null);
    setFileValidationError(null);
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) fileInput.value = "";
  }, []);

  // ATTACH EVENT LISTENERS
  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;
    inputElement.addEventListener('paste', handlePaste);
    inputElement.addEventListener('keydown', handleKeyDown);
    
    return () => {
      inputElement.removeEventListener('paste', handlePaste);
      inputElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste, handleKeyDown]);

  // ✅ UPDATED FALLBACK FETCH FUNCTION WITH CLERK TOKEN
  const fetchMessagesViaHTTP = useCallback(async (sessionId) => {
    if (!sessionId) return [];
    
    try {
      setIsFetchingFallback(true);
      const token = await getAuthToken();
      if (!token) {
        console.warn('⚠️ [FETCH] No auth token available');
        return [];
      }

      const response = await axios.get(`${backendUrl}/api/chat/session/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        timeout: 15000
      });
      
      if (response.data.success) {
        const messages = response.data.messages || [];
        setFallbackMessages(messages);
        if (chatContextAvailable && setSessionMessages) setSessionMessages(sessionId, messages);
        return messages;
      } else {
        setFallbackMessages([]);
        return [];
      }
    } catch (error) {
      console.error('❌ [FETCH] Error fetching messages:', error);
      setFallbackMessages([]);
      return [];
    } finally {
      setIsFetchingFallback(false);
    }
  }, [backendUrl, getAuthToken, chatContextAvailable, setSessionMessages]);

  // INITIALIZE SESSION
  useEffect(() => {
    const initializeSession = async () => {
      if (selectedSession && selectedSession !== 'null' && selectedSession !== 'undefined') {
        setCurrentSessionId(selectedSession);
        if (chatContextAvailable && setSession) setSession(selectedSession);
        try {
          const messages = await fetchMessagesViaHTTP(selectedSession);
          if ((!messages || messages.length === 0) && chatContextAvailable && fetchSessionMessages) {
            await fetchSessionMessages(selectedSession);
          }
        } catch (error) {
          console.warn('⚠️ [INIT] Session initialization warning:', error);
        }
      }
      setHasInitialized(true);
    };
    if (!hasInitialized) initializeSession();
  }, [selectedSession, hasInitialized, chatContextAvailable, fetchMessagesViaHTTP, setSession, fetchSessionMessages]);

  // WATCH FOR SESSION CHANGES
  useEffect(() => {
    if (selectedSession && selectedSession !== currentSessionId) {
      setFallbackMessages([]);
      setCurrentSessionId(selectedSession);
      clearPastedImage();
      setFileValidationError(null);
      if (chatContextAvailable && setSession) setSession(selectedSession);
      fetchMessagesViaHTTP(selectedSession);
      if (chatContextAvailable && fetchSessionMessages) fetchSessionMessages(selectedSession);
    }
  }, [selectedSession, currentSessionId, chatContextAvailable, setSession, fetchMessagesViaHTTP, fetchSessionMessages, clearPastedImage]);

  // GET CURRENT MESSAGES
  const actualMessages = useMemo(() => {
    if (chatContextAvailable && actualIsConnected && getCurrentSessionMessages) {
      const contextMessages = getCurrentSessionMessages();
      if (contextMessages.length > 0) return contextMessages;
    }
    return fallbackMessages;
  }, [chatContextAvailable, actualIsConnected, getCurrentSessionMessages, fallbackMessages]);

  // SPEECH RECOGNITION
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);
  const [hasStoppedListening, setHasStoppedListening] = useState(false);

  // ✅ MINIMAL USER MESSAGE COMPONENT
  const UserMessage = ({ message, timestamp, status, fileUrl, fileName, fileType }) => {
    return (
      <div className="flex justify-end mb-4 px-4">
        <div className="flex items-start gap-3 max-w-[70%]">
          <div className="px-4 py-3 rounded-2xl"
               style={{ 
                 backgroundColor: isDark ? '#333333' : '#000000',
                 color: '#ffffff'
               }}>
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </div>
            
            {fileUrl && (
              <div className="mt-3 pt-2 border-t border-white/20">
                <div className="flex items-center gap-2 p-2 bg-white/10 rounded-lg">
                  {getFileIcon(fileType, fileName)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/90 font-medium truncate">
                      {fileName || 'File'}
                    </div>
                    <div className="text-xs text-white/70">
                      {fileType || 'File'}
                    </div>
                  </div>
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Download file"
                  >
                    <IconDownload size={14} className="text-white/70" />
                  </a>
                </div>
              </div>
            )}
            
            {timestamp && (
              <div className="text-xs text-white/70 mt-2">
                {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
               style={{ backgroundColor: isDark ? '#333333' : '#f5f5f5' }}>
            <IconUser size={16} style={{ color: isDark ? '#ffffff' : '#000000' }} />
          </div>
        </div>
      </div>
    );
  };

  // ✅ MINIMAL AI MESSAGE COMPONENT
  const AiMessage = ({ message, timestamp, isStreaming = false }) => {
    const displayMessage = useMemo(() => {
      if (!message) return '';
      if (typeof message === 'object' && message.message) return message.message;
      if (typeof message === 'string' && message.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(message);
          return parsed.message || parsed.aiMessage?.message || message;
        } catch (e) {
          return message;
        }
      }
      return message;
    }, [message]);

    return (
      <div className="flex items-start gap-3 mb-4 px-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
             style={{ backgroundColor: isDark ? '#333333' : '#f5f5f5' }}>
          <IconRobot size={16} style={{ color: isDark ? '#ffffff' : '#000000' }} />
        </div>
        
        <div className="flex-1 max-w-[70%]">
          <div className="rounded-2xl px-4 py-3"
               style={{ 
                 backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                 color: isDark ? '#ffffff' : '#000000'
               }}>
            {isStreaming && (!displayMessage || displayMessage.length === 0) ? (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full animate-pulse"
                       style={{ backgroundColor: isDark ? '#666666' : '#999999' }}></div>
                  <div className="w-2 h-2 rounded-full animate-pulse"
                       style={{ 
                         backgroundColor: isDark ? '#666666' : '#999999',
                         animationDelay: '0.2s'
                       }}></div>
                  <div className="w-2 h-2 rounded-full animate-pulse"
                       style={{ 
                         backgroundColor: isDark ? '#666666' : '#999999',
                         animationDelay: '0.4s'
                       }}></div>
                </div>
                <span className="text-sm">
                  AI is thinking...
                </span>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p className="mb-1 leading-relaxed">{children}</p>,
                    code: ({node, inline, className, children, ...props}) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    }
                  }}
                >
                  {displayMessage}
                </ReactMarkdown>

                {isStreaming && displayMessage && displayMessage.length > 0 && (
                  <span className="animate-pulse ml-0.5">▍</span>
                )}
              </div>
            )}
          </div>
          
          {!isStreaming && timestamp && (
            <div className="text-xs mt-1 px-1"
                 style={{ color: isDark ? '#888888' : '#666666' }}>
              {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // VOICE INPUT HANDLERS
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

  // ✅ FILE UPLOAD HANDLER WITH CLERK TOKEN
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsUploading(true);
    setFileValidationError(null);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        setFileValidationError('Authentication required. Please sign in again.');
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await axios.post(`${backendUrl}/api/chat/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
      });
      
      setUploadResult(response.data);
      
      if (response.data && response.data.extractedText) {
        setActiveFileContext({
          extractedText: response.data.extractedText,
          fileUrl: response.data.fileUrl,
          fileName: response.data.fileName,
        });
      } else if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(response.data.fileName || "")) {
        setActiveFileContext({
          fileUrl: response.data.fileUrl,
          fileName: response.data.fileName,
          fileType: response.data.fileType || 'image',
          imageAnalysis: null
        });
      }
      
    } catch (error) {
      console.error('❌ [FILE UPLOAD] Error:', error);
      if (error.response?.status === 401) {
        setFileValidationError('Session expired. Please sign in again.');
      } else {
        setFileValidationError('File upload failed. Please try again.');
      }
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ HANDLE SUBMIT WITH CLERK TOKEN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setInput("");
    let finalInput = input.trim();

    // Handle pasted image upload
    if (pastedImage) {
      try {
        const token = await getAuthToken();
        if (!token) {
          setFileValidationError('Authentication required. Please sign in again.');
          return;
        }

        const formData = new FormData();
        formData.append('file', pastedImage);
        
        const response = await axios.post(`${backendUrl}/api/chat/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          }
        });
        setUploadResult(response.data);
        setPastedImage(null);
        setPastePreview(null);
        setFile(null);
      } catch (error) {
        console.error('❌ [PASTED IMAGE UPLOAD] Error:', error);
        if (error.response?.status === 401) {
          setFileValidationError('Session expired. Please sign in again.');
        } else {
          setFileValidationError('Failed to upload pasted image. Please try again.');
        }
        return;
      }
    }

    if (!finalInput && uploadResult) {
      if (uploadResult.fileName?.toLowerCase().match(/\.(pdf|docx?|txt)$/i)) {
        finalInput = `Uploaded document: ${uploadResult.fileName}`;
      } else if (uploadResult.fileName?.toLowerCase().match(/\.(png|jpe?g|gif|bmp|webp)$/i)) {
        finalInput = `Uploaded image: ${uploadResult.fileName}`;
      } else {
        finalInput = "Uploaded a file.";
      }
    }

    if (!finalInput && !uploadResult && !activeFileContext) return;
    if (isAIStreaming) return;

    if (!activeSessionId) {
      setFileValidationError("No session selected. Please start or select a chat session.");
      return;
    }

    let fileContext = null;
    let messageType = 'text';
    
    if (uploadResult && uploadResult.fileUrl) {
      const isImage = uploadResult.fileName?.toLowerCase().match(/\.(png|jpe?g|gif|bmp|webp)$/i);
      const isDocument = uploadResult.fileName?.toLowerCase().match(/\.(pdf|docx?|txt)$/i);
      
      if (isImage) {
        fileContext = {
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileType: 'image',
        };
        messageType = 'image';
        setActiveFileContext({
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileType: 'image',
          imageAnalysis: null
        });
      } else if (isDocument && uploadResult.extractedText) {
        fileContext = {
          extractedText: uploadResult.extractedText,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileType: 'document',
        };
        messageType = 'document';
        setActiveFileContext(fileContext);
      }
    } else if (activeFileContext) {
      fileContext = activeFileContext;
      const isImage = activeFileContext.fileType === 'image' || 
                     activeFileContext.fileName?.toLowerCase().match(/\.(png|jpe?g|gif|bmp|webp)$/i);
      const isDocument = activeFileContext.extractedText || 
                        activeFileContext.fileName?.toLowerCase().match(/\.(pdf|docx?|txt)$/i);
      
      if (isImage) {
        messageType = 'image';
      } else if (isDocument) {
        messageType = 'document';
      }
    }

    const optimisticUserMsg = {
      _id: `user-${Date.now()}`,
      sender: clerkUserId,
      message: finalInput,
      timestamp: new Date().toISOString(),
      fileUrl: fileContext?.fileUrl || null,
      fileName: fileContext?.fileName || null,
      type: messageType,
      status: 'sending'
    };
    if (addMessageToSession) addMessageToSession(activeSessionId, optimisticUserMsg);

    const messageData = {
      sessionId: activeSessionId,
      message: finalInput,
      type: messageType,
      fileUrl: fileContext?.fileUrl || null,
      fileName: fileContext?.fileName || null,
      fileType: messageType,
      extractedText: messageType === 'document' ? fileContext?.extractedText : null,
      contextEnabled: true,
      hasActiveContext: !!activeFileContext,
      contextType: activeFileContext?.fileType || null,
      imageAnalysis: activeFileContext?.imageAnalysis || null,
      contextFileUrl: activeFileContext?.fileUrl || null,
      contextFileName: activeFileContext?.fileName || null,
      isFollowUpMessage: !!activeFileContext && !fileContext?.fileUrl
    };

    setIsAIStreaming(true);

    try {
      let response;
      if (sendMessage) {
        response = await sendMessage(messageData);
      } else {
        const token = await getAuthToken();
        if (!token) {
          setFileValidationError('Authentication required. Please sign in again.');
          return;
        }

        response = await axios.post(`${backendUrl}/api/chat/send`, messageData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      let aiMsg = response?.data?.aiMessage || response?.aiMessage;
      if (aiMsg) {
        const aiTimestamp = aiMsg.createdAt || aiMsg.timestamp || new Date().toISOString();
        if (addMessageToSession) {
          addMessageToSession(activeSessionId, {
            _id: aiMsg._id,
            sender: aiMsg.sender || 'AI',
            message: aiMsg.message,
            timestamp: aiTimestamp,
            fileUrl: aiMsg.fileUrl,
            fileName: aiMsg.fileName,
            type: aiMsg.type,
            status: 'sent'
          });
        }
      }

      // Update session title with first message
      const sessionMessages = getCurrentSessionMessages ? getCurrentSessionMessages() : [];
      const userMessages = sessionMessages.filter(msg => msg.sender !== 'AI' && msg.sender !== 'ai');

      if (userMessages.length <= 1) {
        const titleText = finalInput.length > 50 
          ? finalInput.substring(0, 50) + '...' 
          : finalInput;
        
        try {
          const token = await getAuthToken();
          if (token) {
            await axios.patch(`${backendUrl}/api/chat/session/${activeSessionId}`, {
              title: titleText
            }, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            window.dispatchEvent(new CustomEvent('sessionTitleUpdated', {
              detail: { sessionId: activeSessionId, title: titleText }
            }));
          }
        } catch (titleError) {
          console.warn('⚠️ [TITLE UPDATE] Failed to update session title:', titleError);
        }
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Send message error:', error);
      if (error.response?.status === 401) {
        setFileValidationError('Session expired. Please sign in again.');
      } else {
        setFileValidationError('Failed to send message. Please try again.');
      }
    } finally {
      setFile(null);
      setUploadResult(null);
      setIsAIStreaming(false);
    }
  };

  // AUTO-SCROLL
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [actualMessages, isAIStreaming]);

  // VOICE INPUT TRANSCRIPT HANDLING
  useEffect(() => {
    if (listening && transcript && !isManuallyEditing && !hasStoppedListening) {
      setInput(transcript);
    }
  }, [transcript, listening, isManuallyEditing, hasStoppedListening]);

  // ✅ EARLY RETURN IF NOT SIGNED IN
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl mx-auto"
               style={{ backgroundColor: isDark ? '#333333' : '#f5f5f5' }}>
            <IconRobot size={32} style={{ color: isDark ? '#ffffff' : '#000000' }} />
          </div>
          <h2 className="text-xl font-bold"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Authentication Required
          </h2>
          <p style={{ color: isDark ? '#cccccc' : '#666666' }}>
            Please sign in to access the chat dashboard.
          </p>
        </div>
      </div>
    );
  }

  // ✅ MAIN RENDER - MINIMAL CHATGPT/PERPLEXITY STYLE
  return (
    <div className="flex flex-col h-screen"
         style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
      
      {/* PASTE INDICATOR */}
      {showPasteIndicator && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
             style={{ 
               backgroundColor: isDark ? '#333333' : '#000000',
               color: '#ffffff'
             }}>
          <IconClipboard size={16} />
          <span className="text-sm font-medium">
            {pastedImage ? 'Image pasted!' : 'Context cleared!'}
          </span>
        </div>
      )}
      
      {/* ✅ MINIMAL HEADER */}
      <div className="hidden lg:flex justify-end p-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            color: isDark ? '#ffffff' : '#666666'
          }}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
        </button>
      </div>

      {/* ✅ MOBILE HEADER - FIXED POSITION */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-4"
           style={{ 
             backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
             borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
           }}>
        
        <button
          onClick={() => {
            if (onMobileMenuToggle) {
              onMobileMenuToggle();
            } else {
              setIsMobileMenuOpen(true);
            }
          }}
          className="p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            color: isDark ? '#ffffff' : '#000000'
          }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="text-lg font-semibold"
             style={{ color: isDark ? '#ffffff' : '#000000' }}>
          Nexus AI
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            color: isDark ? '#ffffff' : '#000000'
          }}
        >
          {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
        </button>
      </div>

      {/* Add mobile padding top to prevent content overlap */}
      <div className="lg:hidden h-16"></div>

      {/* ✅ MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto">
        {(isFetchingFallback || isLoadingMessages) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 rounded-full animate-spin mx-auto"
                   style={{ 
                     border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                     borderTopColor: isDark ? '#ffffff' : '#000000'
                   }}></div>
              <p className="text-sm font-medium"
                 style={{ color: isDark ? '#cccccc' : '#666666' }}>
                Loading conversation...
              </p>
            </div>
          </div>
        ) : actualMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl mx-auto"
                   style={{ backgroundColor: isDark ? '#333333' : '#f5f5f5' }}>
                <IconRobot size={32} style={{ color: isDark ? '#ffffff' : '#000000' }} />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  How can I help you today?
                </h2>
                <p style={{ color: isDark ? '#cccccc' : '#666666' }}>
                  I can analyze images, process documents, and help with general questions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-4">
            {actualMessages.map((msg, index) => {
              const normalizedSender = (msg.sender || '').toLowerCase();
              const isAI = normalizedSender === 'ai' || normalizedSender === 'assistant' || normalizedSender === 'system';
              return isAI ? (
                <AiMessage key={msg._id || index} {...msg} />
              ) : (
                <UserMessage key={msg._id || index} {...msg} />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ACTIVE FILE CONTEXT BANNER */}
      {activeFileContext && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between px-4 py-2 mb-2 rounded-xl border"
               style={{ 
                 backgroundColor: isDark ? 'rgba(0, 150, 255, 0.1)' : 'rgba(0, 150, 255, 0.1)',
                 borderColor: '#0096ff'
               }}>
            <div className="flex items-center gap-2">
              {(() => {
                const isImage = activeFileContext.fileType?.startsWith('image') ||
                  activeFileContext.fileName?.toLowerCase().match(/\.(png|jpe?g|gif|bmp|webp)$/i);
                if (isImage) {
                  return (
                    <>
                      <IconClipboard size={18} style={{ color: '#0096ff' }} />
                      <span className="text-sm font-medium"
                            style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        Referencing image: {activeFileContext.fileName}
                      </span>
                      {activeFileContext.fileUrl && (
                        <img
                          src={activeFileContext.fileUrl}
                          alt={activeFileContext.fileName}
                          className="ml-2 w-8 h-8 object-cover rounded border"
                          style={{ borderColor: '#0096ff' }}
                        />
                      )}
                    </>
                  );
                }
                return (
                  <>
                    <IconFileText size={18} style={{ color: '#0096ff' }} />
                    <span className="text-sm font-medium"
                          style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      Referencing document: {activeFileContext.fileName}
                    </span>
                  </>
                );
              })()}
            </div>
            <button
              className="p-1 rounded-full transition-colors"
              style={{ 
                backgroundColor: '#0096ff',
                color: '#ffffff'
              }}
              title="Clear context"
              onClick={() => setActiveFileContext(null)}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ✅ INPUT AREA */}
      <div className="border-t p-4"
           style={{ 
             backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
             borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
           }}>
        <div className="max-w-4xl mx-auto">
          
          {/* FILE VALIDATION ERROR */}
          {fileValidationError && (
            <div className="mb-3 p-3 rounded-lg border flex items-start gap-2"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                   borderColor: '#ef4444'
                 }}>
              <IconAlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
              <div className="text-sm"
                   style={{ color: isDark ? '#ffffff' : '#000000' }}>
                {fileValidationError}
              </div>
            </div>
          )}
          
          {/* PASTED IMAGE PREVIEW */}
          {pastedImage && pastePreview && (
            <div className="mb-3 p-3 rounded-xl border relative"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(0, 150, 255, 0.1)' : 'rgba(0, 150, 255, 0.1)',
                   borderColor: '#0096ff'
                 }}>
              <button
                className="absolute top-2 right-2 p-1 rounded-full transition-colors"
                style={{ 
                  backgroundColor: '#ef4444',
                  color: '#ffffff'
                }}
                title="Remove pasted image"
                onClick={clearPastedImage}
              >
                <IconX size={16} />
              </button>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <img src={pastePreview} alt="Pasted" className="w-16 h-16 rounded-lg object-cover border-2"
                       style={{ borderColor: '#0096ff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <IconClipboard size={16} style={{ color: '#0096ff' }} />
                    <span className="text-sm font-medium"
                          style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      Pasted Image Ready
                    </span>
                  </div>
                  <p className="text-xs"
                     style={{ color: isDark ? '#cccccc' : '#666666' }}>
                    {pastedImage.name} • {(pastedImage.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* IMAGE FILE PREVIEW */}
          {file && !pastedImage && detectFileType && detectFileType(null, file.name, file.type) === 'image' && (
            <div className="mb-3 p-3 rounded-xl border relative"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(0, 150, 255, 0.1)' : 'rgba(0, 150, 255, 0.1)',
                   borderColor: '#0096ff'
                 }}>
              <button
                className="absolute top-2 right-2 p-1 rounded-full transition-colors"
                style={{ 
                  backgroundColor: '#ef4444',
                  color: '#ffffff'
                }}
                title="Remove uploaded image"
                onClick={() => setFile(null)}
              >
                <IconX size={16} />
              </button>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <img src={URL.createObjectURL(file)} alt="Uploaded" className="w-16 h-16 rounded-lg object-cover border-2"
                       style={{ borderColor: '#0096ff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <IconClipboard size={16} style={{ color: '#0096ff' }} />
                    <span className="text-sm font-medium"
                          style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      Uploaded Image Ready
                    </span>
                  </div>
                  <p className="text-xs"
                     style={{ color: isDark ? '#cccccc' : '#666666' }}>
                    {file.name} • {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-3 rounded-2xl shadow-sm border px-4 py-3"
                 style={{ 
                   backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                   borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                 }}>
              <input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="fileUpload"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="fileUpload"
                className="p-2 rounded-lg transition-colors cursor-pointer"
                style={{
                  color: isDark ? '#cccccc' : '#666666'
                }}
                title="Upload file"
              >
                <IconUpload size={20} />
              </label>

              {browserSupportsSpeechRecognition && (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: listening ? '#22c55e' : 'transparent',
                    color: listening ? '#ffffff' : isDark ? '#cccccc' : '#666666'
                  }}
                  title={listening ? "Stop recording" : "Start voice input"}
                >
                  {listening ? <IconCheck size={20} /> : <IconMicrophone size={20} />}
                </button>
              )}

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder={listening ? "Listening..." : 
                           pastedImage ? "Add a message (optional)..." : 
                           "Message Nexus AI..."}
                className="flex-1 bg-transparent border-none outline-none text-sm py-1"
                style={{ 
                  color: isDark ? '#ffffff' : '#000000'
                }}
                disabled={isAIStreaming}
              />

              <button
                type="submit"
                className="p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: (!input.trim() && !file && !pastedImage) || isUploading || isAIStreaming
                    ? isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    : isDark ? '#ffffff' : '#000000',
                  color: (!input.trim() && !file && !pastedImage) || isUploading || isAIStreaming
                    ? isDark ? '#666666' : '#999999'
                    : isDark ? '#000000' : '#ffffff'
                }}
                disabled={(!input.trim() && !file && !pastedImage) || isUploading || isAIStreaming}
                title="Send message"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <IconSend size={20} />
                )}
              </button>
            </div>
          </form>

          {/* AI STREAMING INDICATOR */}
          {isAIStreaming && (
            <div className="text-xs mt-2 px-2 flex items-center gap-2"
                 style={{ color: isDark ? '#cccccc' : '#666666' }}>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full animate-pulse"
                     style={{ backgroundColor: isDark ? '#666666' : '#999999' }}></div>
                <div className="w-1 h-1 rounded-full animate-pulse"
                     style={{ 
                       backgroundColor: isDark ? '#666666' : '#999999',
                       animationDelay: '0.2s'
                     }}></div>
                <div className="w-1 h-1 rounded-full animate-pulse"
                     style={{ 
                       backgroundColor: isDark ? '#666666' : '#999999',
                       animationDelay: '0.4s'
                     }}></div>
              </div>
              <span>AI is responding...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatDashBoard;
