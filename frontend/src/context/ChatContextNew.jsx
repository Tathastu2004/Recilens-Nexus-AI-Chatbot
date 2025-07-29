// ✅ STABLE CONNECTION STATUS - NO FLICKERING
export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState({}); 
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(true); // ✅ START TRUE
  const [typingUsers, setTypingUsers] = useState({});
  const [streamingResponses, setStreamingResponses] = useState({});
  const [connectionChecked, setConnectionChecked] = useState(false); // ✅ TRACK INITIAL CHECK

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // ✅ SINGLE CONNECTION CHECK ON MOUNT - NO LOOPS
  useEffect(() => {
    let mounted = true;
    
    const performInitialConnectionCheck = async () => {
      try {
        console.log('🔍 [CHAT CONTEXT] Performing initial connection check...');
        
        const token = localStorage.getItem("token");
        if (!token) {
          if (mounted) {
            setIsConnected(false);
            setConnectionChecked(true);
          }
          return;
        }

        const response = await fetch(`${backendUrl}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        if (mounted) {
          const connected = response.ok;
          setIsConnected(connected);
          setConnectionChecked(true);
          console.log('📊 [CHAT CONTEXT] Initial connection status:', connected);
        }
      } catch (error) {
        if (mounted) {
          console.error('❌ [CHAT CONTEXT] Initial connection check failed:', error.message);
          setIsConnected(false);
          setConnectionChecked(true);
        }
      }
    };

    performInitialConnectionCheck();

    return () => {
      mounted = false;
    };
  }, [backendUrl]);

  // ✅ FIXED SEND MESSAGE WITH PROPER AI RESPONSE HANDLING
  const sendMessage = useCallback(async (messageData) => {
    const startTime = Date.now();
    
    console.log('📤 [CHAT CONTEXT] Sending message:', {
      sessionId: messageData.sessionId,
      tempId: messageData.tempId,
      messageLength: messageData.message?.length || 0,
      connectionStatus: isConnected
    });

    if (!isConnected && connectionChecked) {
      return { success: false, error: 'Not connected to server. Please check your internet connection.' };
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setIsConnected(false);
      return { success: false, error: 'Authentication required. Please log in again.' };
    }

    try {
      // ✅ SET STREAMING STATUS
      setStreamingResponses(prev => ({
        ...prev,
        [messageData.sessionId]: true
      }));

      console.log('🌊 [SEND MESSAGE] Starting SSE stream for AI response...');
      
      const response = await fetch(`${backendUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // ✅ HANDLE STREAMING RESPONSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';
      
      // ✅ CREATE AI MESSAGE IMMEDIATELY
      const aiMessageId = `ai-${Date.now()}-${Math.random()}`;
      const aiMessage = {
        _id: aiMessageId,
        message: '',
        sender: 'AI',
        type: 'text',
        timestamp: new Date().toISOString(),
        streaming: true
      };

      // ✅ ADD AI MESSAGE TO UI
      setMessages(prev => ({
        ...prev,
        [messageData.sessionId]: [...(prev[messageData.sessionId] || []), aiMessage]
      }));

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('✅ [SEND MESSAGE] Stream completed');
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.chunk) {
                  aiResponse += data.chunk;
                  
                  // ✅ UPDATE AI MESSAGE IN REAL-TIME
                  setMessages(prev => ({
                    ...prev,
                    [messageData.sessionId]: (prev[messageData.sessionId] || []).map(msg =>
                      msg._id === aiMessageId
                        ? { ...msg, message: aiResponse }
                        : msg
                    )
                  }));
                }
                
                if (data.isFinal) {
                  console.log('🏁 [SEND MESSAGE] Stream finished');
                  
                  // ✅ MARK AS COMPLETE
                  setMessages(prev => ({
                    ...prev,
                    [messageData.sessionId]: (prev[messageData.sessionId] || []).map(msg =>
                      msg._id === aiMessageId
                        ? { ...msg, streaming: false }
                        : msg
                    )
                  }));
                  break;
                }
                
                if (data.error) {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn('⚠️ [SEND MESSAGE] Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // ✅ UPDATE CONNECTION STATUS ON SUCCESS
      if (!isConnected) {
        setIsConnected(true);
      }

      const latency = Date.now() - startTime;
      console.log('✅ [SEND MESSAGE] Message sent and response received in', latency, 'ms');
      
      return { success: true, latency };
      
    } catch (error) {
      console.error('❌ [SEND MESSAGE] Error:', error);
      
      // ✅ UPDATE CONNECTION STATUS ON NETWORK ERRORS
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        setIsConnected(false);
      }
      
      return { success: false, error: error.message };
    } finally {
      // ✅ CLEAR STREAMING STATUS
      setStreamingResponses(prev => ({
        ...prev,
        [messageData.sessionId]: false
      }));
    }
  }, [backendUrl, isConnected, connectionChecked]);

  // ✅ ADD TYPING INDICATOR BASED ON STREAMING STATUS
  const isSessionStreaming = useCallback((sessionId) => {
    return streamingResponses[sessionId] || false;
  }, [streamingResponses]);

  const contextValue = {
    // Core functionality
    currentSessionId,
    setSession,
    joinSession,
    sendMessage,
    
    // Message management
    getCurrentSessionMessages,
    setSessionMessages,
    addMessageToSession,
    clearSessionMessages,
    fetchSessionMessages,
    allMessages: messages,
    
    // ✅ STABLE CONNECTION STATUS
    isConnected: connectionChecked ? isConnected : true, // Show connected until first check
    connectionStatus: (connectionChecked ? isConnected : true) ? 'connected' : 'disconnected',
    
    // Streaming features
    isSessionStreaming,
    streamingResponses,
    
    // Real-time features (simplified)
    getTypingUsers,
    typingUsers: getTypingUsers(),
    
    // Debug info
    debug: {
      totalSessions: Object.keys(messages).length,
      totalMessages: Object.values(messages).flat().length,
      connectionStatus: isConnected ? 'Connected' : 'Disconnected',
      currentSession: currentSessionId,
      streamingSessions: Object.keys(streamingResponses).filter(id => streamingResponses[id]).length,
      connectionChecked,
      lastActivity: new Date().toLocaleTimeString()
    }
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};