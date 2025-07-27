import { createContext, useContext, useEffect, useState, useCallback } from "react";
import socket from "../socket.js";
import { debugAuth } from '../utils/authDebug';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState({}); // sessionId -> messages array
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});

  // Debug connection status
  useEffect(() => {
    console.log('🚀 [CHAT CONTEXT] Initializing ChatProvider...');
    
    const handleConnect = () => {
      console.log('✅ [SOCKET] Connected to server');
      setIsConnected(true);
    };

    const handleDisconnect = (reason) => {
      console.log('❌ [SOCKET] Disconnected from server:', reason);
      setIsConnected(false);
    };

    const handleConnectError = (error) => {
      console.error('🔥 [SOCKET] Connection error:', error);
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Initial connection status
    setIsConnected(socket.connected);
    console.log('📊 [SOCKET] Initial connection status:', socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  // Handle incoming messages with real-time optimization
  useEffect(() => {
    console.log('🔗 [CHAT CONTEXT] Setting up message listeners...');

    const handleReceiveMessage = (msg) => {
      const timestamp = Date.now();
      console.log('📩 [SOCKET] Message received at', new Date(timestamp).toLocaleTimeString(), ':', {
        messageId: msg._id,
        sessionId: msg.session,
        sender: msg.sender,
        type: msg.type,
        messageLength: msg.message?.length || 0,
        hasFile: !!msg.fileUrl,
        latency: timestamp - (msg.timestamp ? new Date(msg.timestamp).getTime() : timestamp)
      });

      if (!msg.session) {
        console.warn('⚠️ [SOCKET] No sessionId in message:', msg);
        return;
      }

      setMessages((prev) => {
        const sessionMessages = prev[msg.session] || [];
        
        // ✅ CHECK FOR OPTIMISTIC MESSAGE TO REPLACE
        const optimisticIndex = sessionMessages.findIndex(m => 
          m.optimistic && m.message === msg.message && m.sender === msg.sender
        );

        if (optimisticIndex !== -1) {
          // ✅ REPLACE OPTIMISTIC MESSAGE WITH REAL ONE
          const updatedMessages = [...sessionMessages];
          updatedMessages[optimisticIndex] = {
            ...msg,
            optimistic: false,
            status: 'confirmed'
          };
          
          return {
            ...prev,
            [msg.session]: updatedMessages,
          };
        }

        // ✅ CHECK FOR DUPLICATE REAL MESSAGES
        const isDuplicate = sessionMessages.some(existingMsg => 
          existingMsg._id === msg._id && !existingMsg.optimistic
        );

        if (isDuplicate) {
          return prev;
        }

        // ✅ ADD NEW MESSAGE
        return {
          ...prev,
          [msg.session]: [...sessionMessages, msg],
        };
      });
    };

    const handleError = (error) => {
      console.error('❌ [SOCKET] Socket error:', error);
    };

    const handleTypingStart = (data) => {
      console.log('⌨️ [SOCKET] User started typing:', data);
      setTypingUsers(prev => ({
        ...prev,
        [data.sessionId]: {
          ...prev[data.sessionId],
          [data.userId]: true
        }
      }));
    };

    const handleTypingStop = (data) => {
      console.log('⏹️ [SOCKET] User stopped typing:', data);
      setTypingUsers(prev => {
        const sessionTyping = { ...prev[data.sessionId] };
        delete sessionTyping[data.userId];
        return {
          ...prev,
          [data.sessionId]: sessionTyping
        };
      });
    };

    // Register event listeners
    socket.on("receive-message", handleReceiveMessage);
    socket.on("error", handleError);
    socket.on("user-typing", handleTypingStart);
    socket.on("user-stop-typing", handleTypingStop);

    console.log('✅ [CHAT CONTEXT] Message listeners registered');

    return () => {
      console.log('🧹 [CHAT CONTEXT] Cleaning up message listeners...');
      socket.off("receive-message", handleReceiveMessage);
      socket.off("error", handleError);
      socket.off("user-typing", handleTypingStart);
      socket.off("user-stop-typing", handleTypingStop);
    };
  }, []);

  // Join session for real-time updates
  const joinSession = useCallback((sessionId) => {
    if (!sessionId) {
      console.warn('⚠️ [CHAT CONTEXT] Cannot join session: no sessionId provided');
      return;
    }

    console.log('🔗 [CHAT CONTEXT] Joining session:', sessionId);
    socket.emit("join-session", sessionId);
    setCurrentSessionId(sessionId);
    
    // Clear typing indicators for new session
    setTypingUsers(prev => ({
      ...prev,
      [sessionId]: {}
    }));
  }, []);

  // ✅ OPTIMIZED SEND MESSAGE WITH IMMEDIATE RESPONSE
  const sendMessage = useCallback(async (messageData) => {
    const startTime = Date.now();
    
    console.log('📤 [CHAT CONTEXT] Instant message send:', {
      sessionId: messageData.sessionId,
      tempId: messageData.tempId
    });

    if (!messageData.senderId) {
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          messageData.senderId = user._id;
        }
      } catch (parseError) {
        console.error('❌ [CHAT CONTEXT] Error parsing user:', parseError);
      }
    }

    if (!messageData.senderId) {
      return { success: false, error: 'User authentication required. Please log in again.' };
    }

    try {
      // ✅ EMIT SOCKET MESSAGE FOR INSTANT DELIVERY
      socket.emit("send-message", {
        ...messageData,
        timestamp: new Date().toISOString()
      });

      const latency = Date.now() - startTime;
      console.log('✅ [CHAT CONTEXT] Message sent instantly in', latency, 'ms');
      
      return { success: true, latency };
    } catch (error) {
      console.error('❌ [CHAT CONTEXT] Failed to send message:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Optimized message retrieval
  const getCurrentSessionMessages = useCallback(() => {
    const sessionMessages = messages[currentSessionId] || [];
    console.log('📋 [CHAT CONTEXT] Getting messages for session', currentSessionId, ':', {
      messageCount: sessionMessages.length,
      hasMessages: sessionMessages.length > 0,
      lastMessageTime: sessionMessages.length > 0 ? 
        new Date(sessionMessages[sessionMessages.length - 1].timestamp).toLocaleTimeString() : 'N/A'
    });
    return sessionMessages;
  }, [messages, currentSessionId]);

  // Set current session with debugging
  const setSession = useCallback((sessionId) => {
    console.log('🎯 [CHAT CONTEXT] Setting current session:', {
      from: currentSessionId,
      to: sessionId,
      messagesAvailable: sessionId ? (messages[sessionId]?.length || 0) : 0
    });
    
    if (sessionId) {
      joinSession(sessionId);
    } else {
      setCurrentSessionId(null);
    }
  }, [currentSessionId, messages, joinSession]);

  // Manually set all messages with optimization
  const setSessionMessages = useCallback((sessionId, msgs) => {
    console.log('📝 [CHAT CONTEXT] Setting messages for session', sessionId, ':', {
      messageCount: msgs.length,
      isCurrentSession: sessionId === currentSessionId,
      messageSenders: msgs.map(m => m.sender).filter((sender, index, arr) => arr.indexOf(sender) === index)
    });

    setMessages((prev) => ({
      ...prev,
      [sessionId]: msgs,
    }));
  }, [currentSessionId]);

  // Add message to specific session (for immediate UI updates)
  const addMessageToSession = useCallback((sessionId, message) => {
    console.log('➕ [CHAT CONTEXT] Adding message to session', sessionId, ':', {
      messageId: message._id,
      sender: message.sender,
      type: message.type,
      timestamp: new Date().toLocaleTimeString()
    });

    setMessages((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), message],
    }));
  }, []);

  // Get typing status for current session
  const getTypingUsers = useCallback(() => {
    const sessionTyping = typingUsers[currentSessionId] || {};
    const typingUserIds = Object.keys(sessionTyping).filter(userId => sessionTyping[userId]);
    
    if (typingUserIds.length > 0) {
      console.log('⌨️ [CHAT CONTEXT] Users typing in current session:', typingUserIds);
    }
    
    return typingUserIds;
  }, [typingUsers, currentSessionId]);

  const contextValue = {
    // Core functionality
    socket,
    currentSessionId,
    setSession,
    joinSession,
    sendMessage,
    
    // Message management
    getCurrentSessionMessages,
    setSessionMessages,
    addMessageToSession,
    allMessages: messages,
    
    // Real-time features
    isConnected,
    getTypingUsers,
    typingUsers: getTypingUsers(),
    
    // Debug info
    debug: {
      totalSessions: Object.keys(messages).length,
      totalMessages: Object.values(messages).flat().length,
      connectionStatus: isConnected ? 'Connected' : 'Disconnected',
      currentSession: currentSessionId,
      lastActivity: new Date().toLocaleTimeString()
    }
  };

  console.log('🎯 [CHAT CONTEXT] Context value updated:', {
    currentSessionId,
    isConnected,
    totalSessions: Object.keys(messages).length,
    totalMessages: Object.values(messages).flat().length,
    typingUsers: Object.keys(typingUsers).length
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
