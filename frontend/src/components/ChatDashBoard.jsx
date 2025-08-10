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
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '../styles/animations.css';

const ChatDashBoard = ({ selectedSession, onSessionUpdate, onSessionDelete }) => {
  // Constants and token
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");
  const userId = JSON.parse(localStorage.getItem("user"))?._id;

  // THEME CONTEXT
  const { theme, isDark, toggleTheme, isTransitioning } = useTheme();

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

  // NEW STATE FOR COPY-PASTE FUNCTIONALITY
  const [pastedImage, setPastedImage] = useState(null);
  const [pastePreview, setPastePreview] = useState(null);
  const [showPasteIndicator, setShowPasteIndicator] = useState(false);

  // NEW STATE FOR DOCUMENT SUPPORT
  const [dragOver, setDragOver] = useState(false);
  const [fileValidationError, setFileValidationError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // NEW STATE FOR DEDUPLICATION
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

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

  // DESTRUCTURE CONTEXT VALUES
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
    initializeContext,
    reconnect,
    detectFileType,
    validateFile,
    supportedFileTypes,
    getSessionStats,
    clearSessionCache,
    aiServiceHealth,
    generateFileHash,
    checkDuplicateFile,
    getDuplicateStats,
    cleanupDuplicates
  } = chatContext || {};

  // FALLBACK MESSAGE FETCHING
  const [fallbackMessages, setFallbackMessages] = useState([]);
  const [isFetchingFallback, setIsFetchingFallback] = useState(false);

  // CONNECTION STATUS
  const actualIsConnected = chatContextAvailable ? (isConnected ?? false) : false;
  const activeSessionId = selectedSession || currentSessionId;

  // ENHANCED FILE TYPE DETECTION
  const getFileIcon = useCallback((fileType, fileName) => {
    const type = detectFileType ? detectFileType(null, fileName, fileType) : 'unknown';
    switch (type) {
      case 'image':
        return <IconClipboard size={16} className="text-purple-500" />;
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

  // ENHANCED FILE VALIDATION
  const validateFileBeforeUpload = useCallback(async (file) => {
    if (!file) return { isValid: false, error: 'No file selected' };
    setFileValidationError(null);
    setDuplicateCheck(null);
    setShowDuplicateWarning(false);
    try {
      if (validateFile) {
        const validation = await validateFile(file);
        if (!validation.isValid) {
          setFileValidationError(validation.error);
          return validation;
        }
      }
      if (generateFileHash && checkDuplicateFile) {
        const fileHash = await generateFileHash(file);
        if (fileHash) {
          const duplicateResult = await checkDuplicateFile(fileHash);
          if (duplicateResult.success && duplicateResult.isDuplicate) {
            setDuplicateCheck({
              isDuplicate: true,
              existingFile: duplicateResult.existingFile,
              fileHash
            });
            setShowDuplicateWarning(true);
            return { 
              isValid: true, 
              isDuplicate: true, 
              existingFile: duplicateResult.existingFile,
              warning: 'This file already exists in your uploads. Using existing version will save bandwidth.'
            };
          } else {
            setDuplicateCheck({ isDuplicate: false, fileHash });
          }
        }
      }
      return { isValid: true, detectedType: 'unknown' };
    } catch (error) {
      const errorMsg = `Validation failed: ${error.message}`;
      setFileValidationError(errorMsg);
      return { isValid: false, error: errorMsg };
    }
  }, [validateFile, generateFileHash, checkDuplicateFile]);

  // DRAG AND DROP HANDLERS
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      const validation = await validateFileBeforeUpload(droppedFile);
      if (validation.isValid) {
        setFile(droppedFile);
        if (pastedImage) clearPastedImage();
      }
    }
  }, [validateFileBeforeUpload, pastedImage]);

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
    let imageFound = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        imageFound = true;
        const blob = item.getAsFile();
        if (blob) {
          const imageFile = createFileFromBlob(blob, `pasted-image-${Date.now()}.png`);
          const validation = await validateFileBeforeUpload(imageFile);
          if (!validation.isValid) return;
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
  }, [createImagePreview, validateFileBeforeUpload]);

  // KEYBOARD SHORTCUTS
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {}
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
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      inputElement.removeEventListener('paste', handlePaste);
      inputElement.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste, handleKeyDown, handleDragOver, handleDragLeave, handleDrop]);

  // FALLBACK FETCH FUNCTION
  const fetchMessagesViaHTTP = useCallback(async (sessionId) => {
    if (!sessionId || !token) return [];
    try {
      setIsFetchingFallback(true);
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
      setFallbackMessages([]);
      if (chatContextAvailable && reconnect) reconnect();
      return [];
    } finally {
      setIsFetchingFallback(false);
    }
  }, [backendUrl, token, chatContextAvailable, reconnect, setSessionMessages]);

  // INITIALIZE SESSION ON MOUNT
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
        } catch (error) {}
      }
      setHasInitialized(true);
    };
    if (!hasInitialized) initializeSession();
  }, [selectedSession, hasInitialized, chatContextAvailable, fetchMessagesViaHTTP, setSession, fetchSessionMessages]);

  // WATCH FOR SESSION CHANGES FROM PARENT
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

  // ENHANCED USER MESSAGE COMPONENT WITH TEXT EXTRACTION INFO
  const UserMessage = ({ message, timestamp, status, fileUrl, type, fileType, fileName, isDuplicate, hasTextExtraction, extractedTextLength }) => {
    const detectedType = detectFileType ? detectFileType(fileUrl, fileName, fileType) : 'unknown';
    
    return (
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
                {detectedType === 'document' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-white/10 rounded-lg">
                      {getFileIcon(fileType, fileName)}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/90 font-medium truncate">
                          {fileName || 'Document'}
                        </div>
                        <div className="text-xs text-white/70">
                          {fileType || 'Document file'}
                          {/* ✅ TEXT EXTRACTION STATUS */}
                          {hasTextExtraction && (
                            <span className="ml-2 text-green-300">
                              • {extractedTextLength} chars extracted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1 flex items-center gap-1">
                      📄 <span>
                        {hasTextExtraction 
                          ? 'Text extracted & processed by Llama3' 
                          : 'Document processed by Llama3'
                        }
                      </span>
                      {isDuplicate && <span className="ml-1">• ♻️ Reused existing file</span>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-white/10 rounded-lg">
                      {getFileIcon(fileType, fileName)}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/90 font-medium truncate">
                          {fileName || 'Document'}
                        </div>
                        <div className="text-xs text-white/70">
                          {fileType || 'Document file'}
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
                    <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1 flex items-center gap-1">
                      📄 <span>Document processed by Llama3</span>
                      {isDuplicate && <span className="ml-1">• ♻️ Reused existing file</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-xs text-white/70 mt-2">
              {timestamp && !isNaN(new Date(timestamp).getTime())
                ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ""}
            </div>
          </div>
          
          <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
            <IconUser size={14} className="text-white" />
          </div>
        </div>
      </div>
    );
  };

  // ✅ ENHANCED AI MESSAGE COMPONENT WITH DOCUMENT PROCESSING INDICATORS
  const AiMessage = ({ message, timestamp, fileUrl, fileType, isStreaming = false, type, processingInfo, completedBy, metadata }) => {
    const isImageResponse = type === 'image' || completedBy === 'BLIP' || 
                           (typeof message === 'string' && (message.includes('🖼️') || message.includes('Image')));
    const isDocumentResponse = type === 'document' || (completedBy && completedBy.includes('Document')) ||
                              (typeof message === 'string' && (message.includes('document') || message.includes('Document')));

    // ✅ ENHANCED MESSAGE CLEANING
  const cleanMessage = useCallback((rawMessage) => {
  if (!rawMessage) return '';

  // If it's an object with a .message property, use it
  if (typeof rawMessage === 'object' && rawMessage.message) {
    return rawMessage.message;
  }

  // If it's a JSON string, parse and extract .message or .aiMessage.message
  if (typeof rawMessage === 'string' && rawMessage.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed && typeof parsed.message === 'string') {
        return parsed.message;
      }
      if (parsed && parsed.aiMessage && typeof parsed.aiMessage.message === 'string') {
        return parsed.aiMessage.message;
      }
    } catch (e) {}
  }

  // Otherwise, return as is
  return rawMessage;
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
                  {processingInfo || 
                   (isImageResponse ? 'Analyzing image with BLIP...' : 
                    isDocumentResponse ? 'Processing document...' : 'AI is thinking...')}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {/* ✅ PROCESSING TYPE INDICATOR */}
                {(isImageResponse || isDocumentResponse) && (
                  <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs mb-2 ${
                    isImageResponse 
                      ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400'
                      : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isImageResponse ? 'bg-purple-500' : 'bg-blue-500'
                    }`}></div>
                    {isImageResponse ? 'Image Analysis' : 'Document Analysis'}
                    {/* ✅ TEXT EXTRACTION INFO */}
                    {metadata?.textExtracted && (
                      <span className="text-xs opacity-70">
                        • Text: {metadata.extractedTextLength} chars
                      </span>
                    )}
                    {completedBy && (
                      <span className="text-xs opacity-70">
                        • {completedBy}
                      </span>
                    )}
                  </div>
                )}
                
                <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="mb-1 leading-relaxed">{children}</p>,
                      code: ({node, inline, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
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
              {timestamp && !isNaN(new Date(timestamp).getTime())
                ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ""}
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

  // ENHANCED FILE UPLOAD HANDLER
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsUploading(true);
    setFileValidationError(null);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const response = await axios.post(`${backendUrl}/api/chat/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });
      setUploadResult(response.data);
      // After setUploadResult(response.data);
if (response.data && response.data.extractedText) {
  setActiveFileContext({
    extractedText: response.data.extractedText,
    fileUrl: response.data.fileUrl,
    fileName: response.data.fileName,
  });
}
    } catch (error) {
      setFileValidationError('File upload failed. Please try again.');
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // --- MAIN FIX: HANDLE SUBMIT, OPTIMISTIC UPDATE, AND AI RESPONSE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setInput("");
    let finalInput = input.trim();

    // If no text input but a file is uploaded, set a default message
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

    // --- IMAGE CONTEXT ---
    let fileContext = null;
    let messageType = 'text';
    if (uploadResult && uploadResult.fileUrl) {
      const isImage = uploadResult.fileName?.toLowerCase().match(/\.(png|jpe?g|gif|bmp|webp)$/i);
      const isDocument = uploadResult.fileName?.toLowerCase().match(/\.(pdf|docx?|txt)$/i);
      if (isImage) {
        fileContext = {
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileType: uploadResult.fileType || 'image',
        };
        messageType = 'image';
      } else if (isDocument && uploadResult.extractedText) {
        fileContext = {
          extractedText: uploadResult.extractedText,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
        };
        messageType = 'document';
        setActiveFileContext(fileContext);
      }
    } else if (activeFileContext) {
      fileContext = activeFileContext;
      messageType = 'document';
    }

    // Optimistically add user message
    const optimisticUserMsg = {
      _id: `user-${Date.now()}`,
      sender: userId,
      message: finalInput,
      timestamp: new Date().toISOString(),
      fileUrl: fileContext?.fileUrl || null,
      fileName: fileContext?.fileName || null,
      type: messageType,
      hasTextExtraction: !!fileContext?.extractedText,
      extractedTextLength: fileContext?.extractedText?.length || 0,
      status: 'sending'
    };
    if (addMessageToSession) addMessageToSession(activeSessionId, optimisticUserMsg);

    // Prepare messageData for backend
    const messageData = {
      sessionId: activeSessionId,
      message: finalInput,
      type: messageType,
      fileUrl: fileContext?.fileUrl || null,
      fileName: fileContext?.fileName || null,
      fileType: fileContext?.fileType || null,
      extractedText: fileContext?.extractedText || null,
    };

    setIsAIStreaming(true);

    try {
      let response;
      if (sendMessage) {
        response = await sendMessage(messageData);
      } else {
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
            hasTextExtraction: aiMsg.hasTextExtraction,
            extractedTextLength: aiMsg.textLength,
            metadata: aiMsg.metadata,
            status: 'sent'
          });
        }
      }
    } catch (error) {
      setFileValidationError('Failed to send message. Please try again.');
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

  // DEBUG LOGGING
  useEffect(() => { 
    console.log('🔍 Dashboard state:', {
      selectedSession,
      currentSessionId,
      activeSessionId,
      hasInitialized,
      actualIsConnected,
      messagesCount: actualMessages.length,
      isFetching: isFetchingFallback,
      hasPastedImage: !!pastedImage,
      hasFile: !!file,
      fileValidationError,
      supportedFileTypes: supportedFileTypes ? 'Loaded' : 'Loading...',
      aiServiceHealth: aiServiceHealth?.status || 'Unknown'
    });
  }, [selectedSession, currentSessionId, activeSessionId, hasInitialized, actualIsConnected, actualMessages.length, isFetchingFallback, pastedImage, file, fileValidationError, supportedFileTypes, aiServiceHealth]);

  // ✅ MAIN RENDER WITH DRAG & DROP OVERLAY
  return (
    <div className={`flex flex-col h-screen transition-all duration-300 relative ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    } ${isTransitioning ? 'animate-pulse' : ''}`}>
      
      {/* ✅ DRAG & DROP OVERLAY */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-blue-400">
          <div className="text-center space-y-4 p-8 bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <IconUpload size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Drop your file here
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Supports images and documents
              </p>
              {supportedFileTypes && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {[...supportedFileTypes.images?.extensions || [], ...supportedFileTypes.documents?.extensions || []].join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* ✅ PASTE INDICATOR */}
      {showPasteIndicator && (
        <div className="absolute top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in flex items-center gap-2">
          <IconClipboard size={16} />
          <span className="text-sm font-medium">Image pasted!</span>
        </div>
      )}
      
      {/* ✅ ENHANCED HEADER WITH AI SERVICE STATUS */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <IconRobot size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                Nexus AI Assistant
              </h1>
              {aiServiceHealth && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  BLIP • Document Processor • Llama3
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* ✅ AI SERVICE STATUS */}
            {aiServiceHealth && (
              <div className={`text-xs px-2 py-1 rounded-full ${
                aiServiceHealth.status === 'healthy' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {aiServiceHealth.status === 'healthy' ? '✅ All services online' : '⚠️ Partial services'}
              </div>
            )}
            
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
                  I can analyze images with BLIP, process documents (PDF, DOCX, TXT), and help with general questions using Llama3.
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
                  💡 <strong>Tip:</strong> Paste images with <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+V</kbd> or drag & drop files
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                  <div className="text-xl mb-1">🖼️</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-xs">Image Analysis</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">BLIP model</div>
                </div>
                
                <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                  <div className="text-xl mb-1">📄</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-xs">Document Processing</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">PDF, DOCX, TXT</div>
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
                    fileType={msg.fileType}
                    type={msg.type}
                    isStreaming={msg.isStreaming}
                    processingInfo={msg.processingInfo}
                    completedBy={msg.completedBy}
                    metadata={msg.metadata}
                  />
                ) : (
                  <UserMessage
                    message={msg.message}
                    timestamp={msg.timestamp}
                    status={msg.status}
                    fileUrl={msg.fileUrl}
                    type={msg.type}
                    fileType={msg.fileType}
                    fileName={msg.fileName}
                    hasTextExtraction={msg.hasTextExtraction}
                    extractedTextLength={msg.extractedTextLength}
                  />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* === ACTIVE DOCUMENT CONTEXT BANNER === */}
      {activeFileContext && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 border border-green-200 dark:border-green-700 rounded-xl px-4 py-2 mb-2 mt-2 relative">
            <div className="flex items-center gap-2">
              <IconFileText size={18} className="text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-800 dark:text-green-200 font-medium">
                Chat is referencing:&nbsp;
                <span className="font-semibold">{activeFileContext.fileName}</span>
              </span>
            </div>
            <button
              className="ml-2 p-1 rounded-full bg-blue-600 hover:bg-red-500 hover:text-white transition-colors"
              title="Detach document from chat"
              onClick={() => setActiveFileContext(null)}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ✅ ENHANCED INPUT AREA WITH DOCUMENT SUPPORT */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          
          {/* ✅ FILE VALIDATION ERROR */}
          {fileValidationError && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
              <IconAlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-600 dark:text-red-400">
                {fileValidationError}
              </div>
            </div>
          )}
          
          {/* ✅ DUPLICATE FILE WARNING */}
          {showDuplicateWarning && duplicateCheck?.isDuplicate && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-amber-500 mt-0.5 flex-shrink-0">
                  ♻️
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                    Duplicate File Detected
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                    This file already exists (uploaded {new Date(duplicateCheck.existingFile?.created_at).toLocaleDateString()}). 
                    We'll reuse the existing file and the AI will still analyze it for you.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDuplicateWarning(false)}
                      className="text-xs bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 px-2 py-1 rounded hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
                    >
                      Continue with analysis
                    </button>
                    <button
                      onClick={() => {
                        setShowDuplicateWarning(false);
                        setDuplicateCheck(null);
                        setFile(null);
                        const fileInput = document.getElementById("fileUpload");
                        if (fileInput) fileInput.value = "";
                      }}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* ✅ PASTED IMAGE PREVIEW */}
          {pastedImage && pastePreview && (
            <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <img src={pastePreview} alt="Pasted" className="w-16 h-16 rounded-lg object-cover border-2 border-blue-300 dark:border-blue-600" />
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
                    Will be analyzed by BLIP model
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* ✅ DOCUMENT PREVIEW FOR DRAG & DROP */}
          {file && !pastedImage && detectFileType(null, file.name, file.type) === 'document' && (
            <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-700 relative">
              {/* Place the detach button here */}
              {activeFileContext && (
                <button
                  className="absolute top-2 right-2 p-1 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white transition-colors"
                  title="Detach document from chat"
                  onClick={() => setActiveFileContext(null)}
                >
                  <IconX size={16} />
                </button>
              )}
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                  {getFileIcon(file.type, file.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <IconFileText size={16} className="text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Document Ready for Processing
                    </span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {file.name} • {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <p className="text-xs text-green-500 dark:text-green-500 mt-1">
                    Text will be extracted and processed by Llama3
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* ✅ UPLOAD PROGRESS */}
          {isUploading && uploadProgress > 0 && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-600 dark:text-blue-400">Uploading...</span>
                <span className="text-sm text-blue-600 dark:text-blue-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-600/50 px-3 py-2">
              <input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="fileUpload"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="fileUpload"
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer group"
                title="Upload file (images or documents)"
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
                placeholder={listening ? "Listening..." : 
                           pastedImage ? "Add a message (optional)..." : 
                           "Ask me anything, paste images, or drag & drop documents..."}
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

          {/* ✅ ENHANCED FILE/VOICE STATUS INDICATORS WITH TEXT EXTRACTION */}
          {((file && !pastedImage) || listening) && (
            <div className="flex items-center gap-4 mt-2 px-2 text-xs">
              {file && !pastedImage && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  {getFileIcon(file.type, file.name)}
                  <span>{file.name}</span>
                  <span className="text-gray-400">•</span>
                  <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  {detectFileType && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="capitalize">{detectFileType(null, file.name, file.type)}</span>
                      {/* ✅ TEXT EXTRACTION INDICATOR */}
                      {detectFileType(null, file.name, file.type) === 'document' && (
                        <span className="text-green-600 dark:text-green-400 ml-1">
                          📄 Text extractable
                        </span>
                      )}
                    </>
                  )}
                  {/* ✅ DUPLICATE INDICATOR WITH TEXT REUSE */}
                  {duplicateCheck?.isDuplicate && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        ♻️ Duplicate (will reuse existing + extracted text)
                      </span>
                    </>
                  )}
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

          {/* ✅ AI STREAMING INDICATOR WITH PROCESSING TYPE */}
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

          {/* ✅ SUPPORTED FILE TYPES INFO */}
          {supportedFileTypes && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-2 text-center">
              Supports: Images ({supportedFileTypes.images?.extensions?.join(', ')}) • 
              Documents ({supportedFileTypes.documents?.extensions?.join(', ')})
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatDashBoard;