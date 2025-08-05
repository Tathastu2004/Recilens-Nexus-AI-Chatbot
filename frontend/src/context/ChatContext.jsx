import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from 'axios';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState({}); // sessionId -> messages array
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingStates, setStreamingStates] = useState({}); // sessionId -> streaming status
  const [activeStreams, setActiveStreams] = useState({}); // sessionId -> AbortController

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const token = localStorage.getItem("token");

  console.log('🚀 [CHAT CONTEXT] Initializing streaming-based ChatProvider...');

  // ✅ CHECK CONNECTION STATUS
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/health`, {
          signal: AbortSignal.timeout(3000)
        });
        const connected = response.ok;
        setIsConnected(connected);
        console.log('📊 [CONNECTION] Status:', connected ? 'Connected' : 'Disconnected');
      } catch (error) {
        console.log('⚠️ [CONNECTION] Check failed:', error.message);
        setIsConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30s
    
    return () => clearInterval(interval);
  }, [backendUrl]);

  // ✅ ENHANCED STREAMING SEND MESSAGE
  const sendMessage = useCallback(async (messageData) => {
    const startTime = Date.now();
    const { sessionId, message, tempId, senderId, fileUrl, fileType, type } = messageData;
    
    console.log('📤 [STREAMING] Starting message send:', {
      sessionId,
      tempId,
      messageLength: message?.length,
      hasFile: !!fileUrl,
      senderId
    });

    if (!sessionId || !message) {
      console.error('❌ [STREAMING] Missing required fields:', { sessionId: !!sessionId, message: !!message });
      return { success: false, error: 'Session ID and message are required' };
    }

    // ✅ MARK SESSION AS STREAMING
    setStreamingStates(prev => ({
      ...prev,
      [sessionId]: true
    }));

    // ✅ CREATE ABORT CONTROLLER FOR CANCELLATION
    const abortController = new AbortController();
    setActiveStreams(prev => ({
      ...prev,
      [sessionId]: abortController
    }));

    try {
      // ✅ PREPARE AI MESSAGE PLACEHOLDER (no user message here - handled by ChatDashboard)
      const aiMessageId = `ai-${Date.now()}-${Math.random()}`;
      const aiMessage = {
        _id: aiMessageId,
        message: '',
        sender: 'AI',
        type: 'text',
        timestamp: new Date().toISOString(),
        isStreaming: true
      };

      // ✅ ADD AI MESSAGE PLACEHOLDER TO EXISTING MESSAGES
      setMessages(prev => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), aiMessage]
      }));

      console.log('🌊 [STREAMING] Starting streaming request to backend...');

      // ✅ START STREAMING REQUEST
      const response = await fetch(`${backendUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/plain' // ✅ REQUEST STREAMING RESPONSE
        },
        body: JSON.stringify({
          sessionId,
          message,
          type: type || 'text',
          fileUrl,
          fileType,
          tempId
        }),
        signal: abortController.signal
      });

      console.log('📥 [STREAMING] Response received:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [STREAMING] HTTP Error:', { status: response.status, body: errorText });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // ✅ CHECK IF RESPONSE IS STREAMABLE
      const contentType = response.headers.get('content-type');
      const isStreamable = contentType?.includes('text/plain') && response.body;

      if (isStreamable) {
        console.log('🌊 [STREAMING] Reading stream...');
        
        // ✅ HANDLE STREAMING RESPONSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('✅ [STREAMING] Stream completed after', chunkCount, 'chunks');
            break;
          }

          // ✅ DECODE AND ACCUMULATE TEXT
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          chunkCount++;

          console.log(`📝 [STREAMING] Chunk ${chunkCount}:`, {
            chunkLength: chunk.length,
            totalLength: accumulatedText.length,
            preview: chunk.substring(0, 50) + (chunk.length > 50 ? '...' : '')
          });

          // ✅ UPDATE AI MESSAGE WITH STREAMED CONTENT
          setMessages(prev => ({
            ...prev,
            [sessionId]: (prev[sessionId] || []).map(msg => 
              msg._id === aiMessageId 
                ? { ...msg, message: accumulatedText, isStreaming: true }
                : msg
            )
          }));
        }

        // ✅ FINALIZE AI MESSAGE
        setMessages(prev => ({
          ...prev,
          [sessionId]: (prev[sessionId] || []).map(msg => 
            msg._id === aiMessageId 
              ? { ...msg, message: accumulatedText, isStreaming: false, timestamp: new Date().toISOString() }
              : msg
          )
        }));

        console.log('✅ [STREAMING] Message completed in', Date.now() - startTime, 'ms');
        return { success: true, aiMessageId, responseLength: accumulatedText.length };

      } else {
        // ✅ FALLBACK TO JSON RESPONSE
        console.log('📋 [STREAMING] Falling back to JSON response...');
        
        const responseData = await response.json();
        const aiText = responseData.response || responseData.message || 'No response received';
        
        // ✅ UPDATE AI MESSAGE WITH COMPLETE RESPONSE
        setMessages(prev => ({
          ...prev,
          [sessionId]: (prev[sessionId] || []).map(msg => 
            msg._id === aiMessageId 
              ? { ...msg, message: aiText, isStreaming: false, timestamp: new Date().toISOString() }
              : msg
          )
        }));

        console.log('✅ [STREAMING] JSON response completed:', { responseLength: aiText.length });
        return { success: true, aiMessageId, responseLength: aiText.length };
      }

    } catch (error) {
      console.error('❌ [STREAMING] Error occurred:', {
        name: error.name,
        message: error.message,
        sessionId,
        elapsed: Date.now() - startTime
      });

      // ✅ HANDLE DIFFERENT ERROR TYPES
      let errorMessage = 'Failed to send message';
      let errorType = 'unknown';

      if (error.name === 'AbortError') {
        errorMessage = 'Request was cancelled';
        errorType = 'cancelled';
      } else if (error.message.includes('429')) {
        errorMessage = 'AI service is overloaded. Please try again later.';
        errorType = 'rate_limit';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication required. Please log in again.';
        errorType = 'auth';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Please check your permissions.';
        errorType = 'permission';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
        errorType = 'server';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
        errorType = 'network';
      }

      // ✅ REMOVE AI PLACEHOLDER AND ADD ERROR MESSAGE
      const errorMessageObj = {
        _id: `error-${Date.now()}`,
        message: `❌ ${errorMessage}`,
        sender: 'AI',
        type: 'error',
        timestamp: new Date().toISOString(),
        isError: true,
        errorType
      };

      setMessages(prev => ({
        ...prev,
        [sessionId]: [
          ...(prev[sessionId] || []).filter(msg => !msg.isStreaming), 
          errorMessageObj
        ]
      }));

      return { success: false, error: errorMessage, errorType };

    } finally {
      // ✅ CLEANUP STREAMING STATE
      setStreamingStates(prev => ({
        ...prev,
        [sessionId]: false
      }));
      
      setActiveStreams(prev => {
        const updated = { ...prev };
        delete updated[sessionId];
        return updated;
      });

      console.log('🧹 [STREAMING] Cleanup completed for session:', sessionId);
    }
  }, [backendUrl, token]);

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

  // ✅ FETCH MESSAGES FROM SERVER
  const fetchSessionMessages = useCallback(async (sessionId) => {
    if (!sessionId) {
      console.log('⚠️ [FETCH] No session ID provided');
      return [];
    }

    console.log('📤 [FETCH] Loading messages for session:', sessionId);
    
    try {
      const response = await axios.get(
        `${backendUrl}/api/chat/session/${sessionId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000 // 15 second timeout
        }
      );

      console.log('📥 [FETCH] Response received:', {
        status: response.status,
        success: response.data.success,
        messageCount: response.data.messages?.length || 0
      });

      if (response.data.success) {
        const fetchedMessages = response.data.messages || [];
        console.log('✅ [FETCH] Loaded', fetchedMessages.length, 'messages for session:', sessionId);
        
        // ✅ UPDATE MESSAGES STATE
        setMessages(prev => ({
          ...prev,
          [sessionId]: fetchedMessages
        }));
        
        return fetchedMessages;
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
      
      // ✅ SET EMPTY ARRAY ON ERROR
      setMessages(prev => ({
        ...prev,
        [sessionId]: []
      }));
      
      return [];
    }
  }, [backendUrl, token]);

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
      lastMessage: sessionMessages[sessionMessages.length - 1]?._id
    });
    
    return sessionMessages;
  }, [messages, currentSessionId, streamingStates]);

  // ✅ MANUALLY SET SESSION MESSAGES
  const setSessionMessages = useCallback((sessionId, msgs) => {
    console.log('📝 [MESSAGES] Setting messages for session:', {
      sessionId,
      count: msgs?.length || 0,
      isCurrent: sessionId === currentSessionId
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

  // ✅ ENHANCED CONTEXT VALUE
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
    
    // Connection status
    connectionStatus: isConnected ? 'connected' : 'disconnected',
    
    // Utility functions
    hasSession: (sessionId) => !!messages[sessionId],
    getSessionMessageCount: (sessionId) => messages[sessionId]?.length || 0,
    
    // Debug info
    debug: {
      totalSessions: Object.keys(messages).length,
      totalMessages: Object.values(messages).flat().length,
      connectionStatus: isConnected ? 'Connected' : 'Disconnected',
      currentSession: currentSessionId,
      activeStreams: Object.keys(activeStreams).length,
      streamingSessions: Object.keys(streamingStates).filter(id => streamingStates[id]).length,
      lastActivity: new Date().toLocaleTimeString(),
      messagesPreview: Object.entries(messages).reduce((acc, [sessionId, msgs]) => {
        acc[sessionId] = {
          count: msgs.length,
          lastMessage: msgs[msgs.length - 1]?.message?.substring(0, 50) || 'No messages'
        };
        return acc;
      }, {})
    }
  };

  // ✅ DEBUG LOGGING
  console.log('🎯 [CHAT CONTEXT] Context updated:', {
    currentSessionId,
    isConnected,
    totalSessions: Object.keys(messages).length,
    totalMessages: Object.values(messages).flat().length,
    activeStreams: Object.keys(activeStreams).length,
    streamingSessions: Object.keys(streamingStates).filter(id => streamingStates[id]).length
  });

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
