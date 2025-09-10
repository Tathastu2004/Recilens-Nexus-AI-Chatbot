import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { getToken, isSignedIn } = useAuth(); // ✅ Use Clerk auth
  const [messages, setMessages] = useState({}); 
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingStates, setStreamingStates] = useState({});
  const [activeStreams, setActiveStreams] = useState({});
  const [supportedFileTypes, setSupportedFileTypes] = useState(null);
  const [aiServiceHealth, setAiServiceHealth] = useState(null);
  const [contextStats, setContextStats] = useState({});
  const [contextEnabled, setContextEnabled] = useState(true);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const fastapiUrl = import.meta.env.VITE_FASTAPI_URL || "http://127.0.0.1:8000";

  // ✅ GET CLERK TOKEN HELPER
  const getAuthToken = useCallback(async () => {
    if (!isSignedIn) return null;
    try {
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('❌ [CHAT CONTEXT] Failed to get Clerk token:', error);
      return null;
    }
  }, [getToken, isSignedIn]);

  // ✅ DETECT FILE TYPE HELPER
  const detectFileType = useCallback((fileUrl, fileName, mimeType) => {
    if (!fileUrl && !fileName && !mimeType) return 'text';
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const documentExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    
    // Check by URL patterns
    if (fileUrl) {
      if (fileUrl.includes('/image/') || fileUrl.includes('upload/v')) return 'image';
      if (fileUrl.includes('/raw/') || fileUrl.includes('/document/')) return 'document';
    }
    
    // Check by file extension
    if (fileName) {
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      if (imageExtensions.includes(ext)) return 'image';
      if (documentExtensions.includes(ext)) return 'document';
    }
    
    // Check by MIME type
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
    }
    
    return 'text';
  }, []);

  // ✅ ENHANCED CONNECTION CHECK WITH CLERK AUTH
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // First try basic health check (no auth required)
        const basicResponse = await fetch(`${backendUrl}/api/chat/health`, {
          signal: AbortSignal.timeout(5000)
        });
        
        if (basicResponse.ok) {
          setIsConnected(true);
          
          // Then try authenticated health check if signed in
          if (isSignedIn) {
            const token = await getAuthToken();
            if (token) {
              const authResponse = await fetch(`${backendUrl}/api/chat/health/auth`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000)
              });
              
              if (authResponse.ok) {
                const healthData = await authResponse.json();
                setAiServiceHealth(healthData);
                console.log('📊 [CONNECTION] Authenticated health check successful:', {
                  user: healthData.user?.email,
                  services: healthData.services
                });
              }
            }
          }
        } else {
          setIsConnected(false);
          setAiServiceHealth(null);
        }
      } catch (error) {
        console.log('⚠️ [CONNECTION] Health check failed:', error.message);
        setIsConnected(false);
        setAiServiceHealth(null);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [backendUrl, isSignedIn, getAuthToken]);

  // ✅ FETCH SUPPORTED FILE TYPES
  useEffect(() => {
    const fetchSupportedTypes = async () => {
      try {
        const token = await getAuthToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const response = await fetch(`${backendUrl}/api/chat/supported-types`, { headers });
        if (response.ok) {
          const data = await response.json();
          setSupportedFileTypes(data.supportedTypes);
          console.log('📁 [FILE TYPES] Loaded supported file types:', data.supportedTypes);
        }
      } catch (error) {
        console.warn('⚠️ [FILE TYPES] Failed to load supported file types:', error.message);
      }
    };

    if (isSignedIn) {
      fetchSupportedTypes();
    }
  }, [backendUrl, isSignedIn, getAuthToken]);

  // ✅ FETCH CONTEXT STATS FOR SESSION
  const fetchContextStats = useCallback(async (sessionId) => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await axios.get(
        `${backendUrl}/api/chat/session/${sessionId}/context`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );
      if (response.data.success) {
        const stats = response.data.stats;
        setContextStats(prev => ({
          ...prev,
          [sessionId]: stats
        }));
        console.log('📊 [CONTEXT STATS] Updated for session:', {
          sessionId: sessionId.substring(0, 8) + '...',
          messageCount: stats.messageCount,
          maxSize: stats.maxSize,
          storageType: stats.storageType
        });
        return stats;
      }
    } catch (error) {
      console.warn('⚠️ [CONTEXT STATS] Failed to fetch:', error.message);
      return null;
    }
  }, [backendUrl, getAuthToken]);

  // ✅ CLEAR CONTEXT FOR SESSION
  const clearSessionContext = useCallback(async (sessionId) => {
    try {
      const token = await getAuthToken();
      if (!token) return false;

      const response = await axios.delete(
        `${backendUrl}/api/chat/session/${sessionId}/context`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (response.data.success) {
        setContextStats(prev => {
          const updated = { ...prev };
          delete updated[sessionId];
          return updated;
        });
        console.log('🗑️ [CONTEXT] Cleared context for session:', sessionId.substring(0, 8) + '...');
        return true;
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Failed to clear context:', error.message);
      return false;
    }
  }, [backendUrl, getAuthToken]);

  // ✅ CLEAR CONTEXT HANDLER
  const handleClearContext = useCallback(async (sessionId) => {
    if (!clearSessionContext) {
      console.warn('⚠️ [CONTEXT] clearSessionContext not available');
      return;
    }

    try {
      const success = await clearSessionContext(sessionId);
      if (success) {
        console.log('✅ [CONTEXT] Context cleared successfully');
        // Refresh context stats
        if (fetchContextStats) {
          await fetchContextStats(sessionId);
        }
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Error clearing context:', error);
    }
  }, [clearSessionContext, fetchContextStats]);

  // ✅ ENHANCED STREAMING SEND MESSAGE WITH CONTEXT WINDOW (FIXED SCOPE ISSUE)
  const sendMessage = useCallback(async (messageData) => {
    const { sessionId, message, file, extractedText } = messageData;

    if (!sessionId || (!message?.trim() && !file && !extractedText)) {
      console.error('❌ [STREAMING] Missing required fields');
      return { success: false, error: 'A message or a file is required to start.' };
    }

    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required. Please sign in.' };
    }

    setStreamingStates(prev => ({ ...prev, [sessionId]: true }));
    const abortController = new AbortController();
    setActiveStreams(prev => ({ ...prev, [sessionId]: abortController }));

    // ✅ DECLARE aiMessageId OUTSIDE TRY BLOCK TO FIX SCOPE ISSUE
    const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Add placeholder message
      setMessages(prev => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), { 
          _id: aiMessageId, 
          message: '', 
          sender: 'AI', 
          isStreaming: true,
          timestamp: new Date().toISOString(),
          type: messageData.type || 'text',
          renderKey: 0
        }]
      }));

      console.log('🆕 [CONTEXT] Sending message with context support');

      // ✅ PROPER STREAMING REQUEST WITH CLERK TOKEN
      const response = await fetch(`${backendUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/plain',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(messageData),
        signal: abortController.signal
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        }
        if (response.status === 500) {
          // ✅ TRY TO GET ERROR DETAILS FROM RESPONSE
          let errorDetails = 'Internal server error';
          try {
            const errorText = await response.text();
            const errorData = JSON.parse(errorText);
            errorDetails = errorData.error || errorData.message || errorDetails;
          } catch {
            errorDetails = `Server error (${response.status})`;
          }
          throw new Error(errorDetails);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // ✅ STREAMING READER WITH PROPER BUFFERING
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let chunkCount = 0;
      let wordBuffer = '';

      console.log('🌊 [STREAMING] Starting enhanced stream reading...');

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('✅ [STREAMING] Stream completed');
            break;
          }

          // ✅ PROPER CHUNK DECODING
          const chunk = decoder.decode(value, { stream: true });
          wordBuffer += chunk;
          chunkCount++;

          console.log(`📦 [CHUNK ${chunkCount}] Received: "${chunk}" (${chunk.length} chars)`);

          // ✅ WORD-BY-WORD PROCESSING
          const words = wordBuffer.split(' ');
          if (words.length > 1) {
            // Process complete words
            const completeWords = words.slice(0, -1);
            for (const word of completeWords) {
              accumulatedText += word + ' ';
              
              // ✅ IMMEDIATE UI UPDATE PER WORD
              setMessages(prev => ({
                ...prev,
                [sessionId]: (prev[sessionId] || []).map(msg => 
                  msg._id === aiMessageId ? { 
                    ...msg,
                    message: accumulatedText,
                    isStreaming: true,
                    renderKey: chunkCount,
                    lastChunk: word + ' '
                  } : msg
                )
              }));

              // ✅ ALLOW REACT TO RENDER
              await new Promise(resolve => {
                requestAnimationFrame(() => {
                  setTimeout(resolve, 5); // Faster updates
                });
              });
            }
            
            // Keep incomplete word in buffer
            wordBuffer = words[words.length - 1];
          }
        }

        // ✅ PROCESS REMAINING BUFFER
        if (wordBuffer.trim()) {
          accumulatedText += wordBuffer;
        }

      } finally {
        reader.releaseLock();
      }

      // ✅ FINALIZE MESSAGE
      setMessages(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).map(msg => 
          msg._id === aiMessageId ? { 
            ...msg, 
            message: accumulatedText.trim(),
            isStreaming: false, 
            timestamp: new Date().toISOString(),
            renderKey: chunkCount + 1
          } : msg
        )
      }));

      console.log('✅ [STREAMING] Final result:', {
        totalChunks: chunkCount,
        finalLength: accumulatedText.length,
        preview: accumulatedText.substring(0, 200) + '...'
      });

      // Update context stats
      await fetchContextStats(sessionId);

      return { success: true, message: accumulatedText.trim() };

    } catch (error) {
      console.error('❌ [STREAMING] Error:', error);
      
      // ✅ NOW aiMessageId IS IN SCOPE - UPDATE ERROR MESSAGE  
      setMessages(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).map(msg => 
          msg._id === aiMessageId ? { 
            ...msg, 
            message: `❌ Error: ${error.message}`,
            isStreaming: false,
            error: true
          } : msg
        )
      }));
      
      return { success: false, error: error.message };
    } finally {
      setStreamingStates(prev => ({ ...prev, [sessionId]: false }));
      setActiveStreams(prev => {
        const updated = { ...prev };
        delete updated[sessionId];
        return updated;
      });
    }
  }, [backendUrl, getAuthToken, fetchContextStats]);

  // ✅ FETCH SESSION MESSAGES WITH CLERK AUTH
  const fetchSessionMessages = useCallback(async (sessionId) => {
    if (!sessionId) {
      console.log('⚠️ [FETCH] No session ID provided');
      return [];
    }

    console.log('📤 [FETCH] Loading messages with text extraction info for session:', sessionId);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('⚠️ [FETCH] No auth token available');
        return [];
      }

      const response = await axios.get(
        `${backendUrl}/api/chat/session/${sessionId}/messages?includeExtractedText=false`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        }
      );

      console.log('📥 [FETCH] Response received:', {
        status: response.status,
        success: response.data.success,
        messageCount: response.data.messages?.length || 0,
        fileCount: response.data.fileCount || 0,
        imageCount: response.data.imageCount || 0,
        documentCount: response.data.documentCount || 0,
        textExtractionStats: response.data.textExtractionStats
      });

      if (response.data.success) {
        const fetchedMessages = response.data.messages || [];
        
        // ✅ ENHANCE MESSAGES WITH FILE TYPE AND TEXT EXTRACTION INFO
        const enhancedMessages = fetchedMessages.map(msg => ({
          ...msg,
          detectedType: msg.detectedType || detectFileType(msg.fileUrl, msg.fileName, msg.fileType),
          hasFile: !!msg.fileUrl,
          fileInfo: msg.fileUrl ? {
            type: msg.detectedType || detectFileType(msg.fileUrl, msg.fileName, msg.fileType),
            url: msg.fileUrl,
            mimeType: msg.fileType,
            hasTextExtraction: msg.hasTextExtraction || false,
            textLength: msg.textLength || 0,
            extractionStatus: msg.extractionStatus || 'not_applicable'
          } : null
        }));
        
        console.log('✅ [FETCH] Loaded', enhancedMessages.length, 'messages for session:', sessionId, {
          images: enhancedMessages.filter(m => m.detectedType === 'image').length,
          documents: enhancedMessages.filter(m => m.detectedType === 'document').length,
          text: enhancedMessages.filter(m => m.detectedType === 'text').length,
          withTextExtraction: enhancedMessages.filter(m => m.fileInfo?.hasTextExtraction).length
        });
        
        // ✅ UPDATE MESSAGES STATE
        setMessages(prev => ({
          ...prev,
          [sessionId]: enhancedMessages
        }));
        
        return enhancedMessages;
      } else {
        console.log('❌ [FETCH] API returned error:', response.data.error);
        setMessages(prev => ({
          ...prev,
          [sessionId]: []
        }));
        return [];
      }
    } catch (error) {
      console.error('❌ [FETCH] Failed to load messages:', {
        sessionId,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      setMessages(prev => ({
        ...prev,
        [sessionId]: []
      }));
      
      return [];
    }
  }, [backendUrl, getAuthToken, detectFileType]);

  // ✅ VALIDATE FILE BEFORE UPLOAD
  const validateFile = useCallback(async (file) => {
    try {
      const detectedType = detectFileType(null, file.name, file.type);
      
      if (!supportedFileTypes) {
        return { 
          isValid: true, 
          detectedType, 
          warning: 'File type validation unavailable - assuming valid'
        };
      }

      const isImage = supportedFileTypes.images?.extensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      const isDocument = supportedFileTypes.documents?.extensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );

      if (!isImage && !isDocument) {
        return {
          isValid: false,
          detectedType,
          error: `Unsupported file type "${file.name.split('.').pop()}". Supported: ${[
            ...supportedFileTypes.images?.extensions || [],
            ...supportedFileTypes.documents?.extensions || []
          ].join(', ')}`
        };
      }

      // Check file size limits
      const maxSize = isImage ? 
        (10 * 1024 * 1024) : // 10MB for images
        (50 * 1024 * 1024);  // 50MB for documents

      if (file.size > maxSize) {
        const limit = isImage ? '10MB' : '50MB';
        return {
          isValid: false,
          detectedType,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size for ${detectedType} files is ${limit}`
        };
      }

      return {
        isValid: true,
        detectedType,
        fileSize: file.size,
        maxSize,
        canExtractText: isDocument && supportedFileTypes.documents?.textExtractable,
        processingInfo: isImage ? 'Will be analyzed by BLIP model' : 
                       isDocument ? 'Will extract text and process with Llama3' : 
                       'Will be processed by AI'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }, [supportedFileTypes, detectFileType]);

  // ✅ GENERATE FILE HASH FOR DEDUPLICATION
  const generateFileHash = useCallback(async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('⚠️ [HASH] Failed to generate file hash:', error.message);
      return null;
    }
  }, []);

  // ✅ CHECK FOR DUPLICATE FILES BEFORE UPLOAD
  const checkDuplicateFile = useCallback(async (fileHash) => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, isDuplicate: false };

      const response = await axios.post(
        `${backendUrl}/api/chat/check-duplicate`,
        { fileHash },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ [DUPLICATE CHECK] Failed:', error.message);
      return { success: false, isDuplicate: false };
    }
  }, [backendUrl, getAuthToken]);

  // ✅ GET DUPLICATE STATISTICS
  const getDuplicateStats = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await axios.get(
        `${backendUrl}/api/chat/duplicates/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ [DUPLICATE STATS] Failed:', error.message);
      return null;
    }
  }, [backendUrl, getAuthToken]);

  // ✅ CLEANUP DUPLICATE FILES
  const cleanupDuplicates = useCallback(async (dryRun = true) => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await axios.delete(
        `${backendUrl}/api/chat/duplicates/cleanup?dryRun=${dryRun}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ [CLEANUP DUPLICATES] Failed:', error.message);
      return null;
    }
  }, [backendUrl, getAuthToken]);

  // ✅ GET SESSION STATISTICS INCLUDING TEXT EXTRACTION
  const getSessionStats = useCallback(async (sessionId) => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await axios.get(
        `${backendUrl}/api/chat/session/${sessionId}/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );
      
      console.log('📊 [STATS] Session statistics:', {
        sessionId: sessionId.substring(0, 8),
        stats: response.data
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ [STATS] Failed to get session stats:', error.message);
      return null;
    }
  }, [backendUrl, getAuthToken]);

  // ✅ CLEAR SESSION CACHE
  const clearSessionCache = useCallback(async (sessionId) => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await axios.delete(
        `${backendUrl}/api/chat/session/${sessionId}/cache`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('🗑️ [CACHE] Session cache cleared:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [CACHE] Failed to clear session cache:', error.message);
      return null;
    }
  }, [backendUrl, getAuthToken]);

  // ✅ CANCEL STREAMING FOR SESSION
  const cancelStream = useCallback((sessionId) => {
    console.log('🛑 [STREAMING] Cancelling stream for session:', sessionId);
    
    const controller = activeStreams[sessionId];
    if (controller) {
      controller.abort();
      console.log('✅ [STREAMING] Stream cancelled successfully');
    }
  }, [activeStreams]);

  // ✅ CHECK IF SESSION IS STREAMING
  const isSessionStreaming = useCallback((sessionId) => {
    return streamingStates[sessionId] || false;
  }, [streamingStates]);

  // ✅ SET CURRENT SESSION
  const setSession = useCallback((sessionId) => {
    console.log('🎯 [SESSION] Setting current session:', {
      from: currentSessionId,
      to: sessionId,
      hasMessages: sessionId ? (messages[sessionId]?.length || 0) : 0
    });
    
    // Cancel any active streams for the current session
    if (currentSessionId && activeStreams[currentSessionId]) {
      console.log('🛑 [SESSION] Cancelling active stream for previous session');
      cancelStream(currentSessionId);
    }
    
    setCurrentSessionId(sessionId);
    
    // ✅ AUTOMATICALLY LOAD MESSAGES IF SWITCHING TO A SESSION WE DON'T HAVE CACHED
    if (sessionId && sessionId.match(/^[0-9a-fA-F]{24}$/) && !messages[sessionId]) {
      console.log('📤 [SESSION] Auto-loading messages for new session:', sessionId);
      fetchSessionMessages(sessionId);
    }
  }, [currentSessionId, activeStreams, cancelStream, fetchSessionMessages, messages]);

  // ✅ GET CURRENT SESSION MESSAGES
  const getCurrentSessionMessages = useCallback(() => {
    if (!currentSessionId) {
      console.log('📋 [MESSAGES] No current session');
      return [];
    }

    const sessionMessages = messages[currentSessionId] || [];
    console.log('📋 [MESSAGES] Current session messages:', {
      sessionId: currentSessionId,
      count: sessionMessages.length,
      streaming: streamingStates[currentSessionId] || false,
      lastMessage: sessionMessages[sessionMessages.length - 1]?._id,
      fileTypes: {
        images: sessionMessages.filter(m => m.detectedType === 'image').length,
        documents: sessionMessages.filter(m => m.detectedType === 'document').length,
        text: sessionMessages.filter(m => m.detectedType === 'text').length,
        withTextExtraction: sessionMessages.filter(m => m.fileInfo?.hasTextExtraction).length
      }
    });
    
    return sessionMessages;
  }, [messages, currentSessionId, streamingStates]);

  // ✅ MANUALLY SET SESSION MESSAGES
  const setSessionMessages = useCallback((sessionId, msgs) => {
    console.log('📝 [MESSAGES] Setting messages for session:', {
      sessionId,
      count: msgs?.length || 0,
      isCurrent: sessionId === currentSessionId,
      withTextExtraction: msgs?.filter(m => m.fileInfo?.hasTextExtraction).length || 0
    });

    if (!Array.isArray(msgs)) {
      console.warn('⚠️ [MESSAGES] Invalid messages array provided:', typeof msgs);
      return;
    }

    setMessages(prev => ({
      ...prev,
      [sessionId]: msgs
    }));
  }, [currentSessionId]);

  // ✅ ADD MESSAGE TO SPECIFIC SESSION
  const addMessageToSession = useCallback((sessionId, message) => {
    if (!sessionId || !message) {
      console.warn('⚠️ [MESSAGES] Invalid parameters for addMessageToSession:', { sessionId, message });
      return;
    }

    console.log('➕ [MESSAGES] Adding message to session:', {
      sessionId,
      messageId: message._id,
      sender: message.sender,
      type: message.type || 'text',
      hasTextExtraction: message.fileInfo?.hasTextExtraction || false,
      isCurrent: sessionId === currentSessionId
    });

    setMessages(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), message]
    }));
  }, [currentSessionId]);

  // ✅ UPDATE MESSAGE IN SESSION
  const updateMessageInSession = useCallback((sessionId, messageId, updates) => {
    console.log('🔄 [MESSAGES] Updating message in session:', {
      sessionId,
      messageId,
      updates: Object.keys(updates)
    });

    setMessages(prev => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).map(msg => 
        msg._id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  // ✅ REMOVE MESSAGE FROM SESSION
  const removeMessageFromSession = useCallback((sessionId, messageId) => {
    console.log('🗑️ [MESSAGES] Removing message from session:', { sessionId, messageId });

    setMessages(prev => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).filter(msg => msg._id !== messageId)
    }));
  }, []);

  // ✅ CLEAR SESSION MESSAGES
  const clearSessionMessages = useCallback((sessionId) => {
    console.log('🧹 [MESSAGES] Clearing messages for session:', sessionId);

    setMessages(prev => ({
      ...prev,
      [sessionId]: []
    }));
  }, []);

  // ✅ CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      console.log('🧹 [CHAT CONTEXT] Cleaning up on unmount...');
      // Cancel all active streams on unmount
      Object.values(activeStreams).forEach(controller => {
        if (controller) {
          controller.abort();
        }
      });
    };
  }, [activeStreams]);

  // ✅ ENHANCED CONTEXT VALUE WITH BACKEND TEXT EXTRACTION
  const contextValue = {
    // Core functionality
    currentSessionId,
    setSession,
    sendMessage,
    
    // Message management
    getCurrentSessionMessages,
    setSessionMessages,
    addMessageToSession,
    updateMessageInSession,
    removeMessageFromSession,
    clearSessionMessages,
    fetchSessionMessages,
    allMessages: messages,
    
    // Streaming features
    isConnected,
    isSessionStreaming,
    cancelStream,
    streamingStates,
    activeStreams: Object.keys(activeStreams),
    
    // File and document support with text extraction
    detectFileType,
    validateFile,
    supportedFileTypes,
    getSessionStats,
    clearSessionCache,
    
    // ✅ File deduplication features
    generateFileHash,
    checkDuplicateFile,
    getDuplicateStats,
    cleanupDuplicates,
    
    // AI service info with text extraction capabilities
    aiServiceHealth,
    
    // Connection status
    connectionStatus: isConnected ? 'connected' : 'disconnected',
    
    // ✅ Enhanced URLs for debugging
    urls: {
      backend: backendUrl,
      fastapi: fastapiUrl
    },
    
    // Utility functions
    hasSession: (sessionId) => !!messages[sessionId],
    getSessionMessageCount: (sessionId) => messages[sessionId]?.length || 0,
    getFileTypeCounts: (sessionId) => {
      const sessionMessages = messages[sessionId] || [];
      return {
        images: sessionMessages.filter(m => m.detectedType === 'image').length,
        documents: sessionMessages.filter(m => m.detectedType === 'document').length,
        text: sessionMessages.filter(m => m.detectedType === 'text').length,
        withTextExtraction: sessionMessages.filter(m => m.fileInfo?.hasTextExtraction).length
      };
    },
    
    // ✅ Context window features
    contextStats,
    contextEnabled,
    fetchContextStats,
    clearSessionContext,
    handleClearContext,
    getContextStats: (sessionId) => contextStats[sessionId] || null,
    
    // ✅ Enhanced debug info with text extraction
    debug: {
      totalSessions: Object.keys(messages).length,
      totalMessages: Object.values(messages).flat().length,
      connectionStatus: isConnected ? 'Connected' : 'Disconnected',
      currentSession: currentSessionId,
      activeStreams: Object.keys(activeStreams).length,
      streamingSessions: Object.keys(streamingStates).filter(id => streamingStates[id]).length,
      lastActivity: new Date().toLocaleTimeString(),
      supportedFileTypes: supportedFileTypes ? 'Loaded' : 'Not loaded',
      aiServiceHealth: aiServiceHealth?.status || 'Unknown',
      textExtractionSupported: aiServiceHealth?.features?.textExtraction || false,
      backendTextProcessing: true,
      urls: {
        backend: backendUrl,
        fastapi: fastapiUrl
      },
      messagesPreview: Object.entries(messages).reduce((acc, [sessionId, msgs]) => {
        acc[sessionId] = {
          count: msgs.length,
          images: msgs.filter(m => m.detectedType === 'image').length,
          documents: msgs.filter(m => m.detectedType === 'document').length,
          withTextExtraction: msgs.filter(m => m.fileInfo?.hasTextExtraction).length,
          lastMessage: msgs[msgs.length - 1]?.message?.substring(0, 50) || 'No messages'
        };
        return acc;
      }, {})
    }
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;
