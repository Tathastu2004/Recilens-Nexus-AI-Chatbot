// /services/aiService.js
import axios from 'axios';

console.log('🚀 [AI SERVICE] Initializing AI Service...');

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

// ✅ SIMPLE IN-MEMORY SESSION CACHE
const sessionImageCache = new Map();

export const getAIResponse = async ({ message, type = 'chat', fileUrl, fileType, sessionId, conversationContext = [] }) => {
  try {
    console.log('🚀 [AI SERVICE] Processing request:', { 
      sessionId, 
      type, 
      contextMessages: conversationContext.length,
      messagePreview: message.substring(0, 50)
    });
    
    // ✅ ENHANCED DEBUG LOGGING
    console.log('🔍 [AI SERVICE] Full context analysis:', {
      conversationContextLength: conversationContext.length,
      cacheHasSession: sessionImageCache.has(sessionId),
      cacheSize: sessionImageCache.size,
      allCachedSessions: Array.from(sessionImageCache.keys())
    });
    
    if (conversationContext.length > 0) {
      console.log('📚 [AI SERVICE] Context messages breakdown:');
      conversationContext.forEach((msg, index) => {
        console.log(`  ${index}: ${msg.role} | type: ${msg.type || 'text'} | hasFileUrl: ${!!msg.fileUrl} | content: "${msg.content?.substring(0, 60)}..."`);
      });
    }
    
    let enhancedMessage = message;
    
    // ✅ SMART CONTEXT ENHANCEMENT - USING YOUR EXISTING CONTEXT
    if (type === 'chat' && !fileUrl) {
      const isAskingAboutPrevious = [
        'again', 'analysis', 'repeat', 'previous', 'detail', 'describe again',
        'what did you see', 'tell me again', 'give analysis', 'analyze again', 'discribe'
      ].some(keyword => message.toLowerCase().includes(keyword));
      
      console.log('🎯 [AI SERVICE] Keyword analysis:', {
        userMessage: message,
        isAskingAboutPrevious,
        detectedKeywords: ['again', 'analysis', 'repeat', 'previous', 'detail', 'describe again', 'discribe'].filter(keyword => 
          message.toLowerCase().includes(keyword)
        )
      });
      
      if (isAskingAboutPrevious) {
        console.log('🔍 [AI SERVICE] User asking about previous content, checking context...');
        
        let lastImageAnalysis = null;
        
        // ✅ FIRST: Check conversation context (if available)
        if (conversationContext.length > 0) {
          // Search through context in reverse order
          for (let i = conversationContext.length - 1; i >= 0; i--) {
            const msg = conversationContext[i];
            
            // Look for user message with image
            if (msg.role === 'user' && (msg.fileUrl || msg.type === 'image')) {
              console.log(`🖼️ [AI SERVICE] Found user image message at index ${i}:`, {
                fileUrl: msg.fileUrl,
                type: msg.type,
                content: msg.content?.substring(0, 100)
              });
              
              // Look for the assistant response right after this
              if (i + 1 < conversationContext.length) {
                const nextMsg = conversationContext[i + 1];
                if (nextMsg.role === 'assistant') {
                  lastImageAnalysis = nextMsg;
                  console.log(`✅ [AI SERVICE] Found assistant response after image at index ${i + 1}:`, {
                    content: nextMsg.content?.substring(0, 100)
                  });
                  break;
                }
              }
            }
            
            // Also look for assistant messages that mention image analysis
            if (msg.role === 'assistant' && (
              msg.content?.toLowerCase().includes('image') || 
              msg.content?.toLowerCase().includes('analysis') ||
              msg.content?.toLowerCase().includes('picture')
            )) {
              lastImageAnalysis = msg;
              console.log(`🔍 [AI SERVICE] Found assistant message mentioning image at index ${i}:`, {
                content: msg.content?.substring(0, 100)
              });
            }
          }
        }
        
        // ✅ FALLBACK: Check in-memory cache (THIS IS YOUR WORKING SOLUTION)
        if (!lastImageAnalysis && sessionImageCache.has(sessionId)) {
          const cachedAnalysis = sessionImageCache.get(sessionId);
          console.log('💾 [AI SERVICE] Using cached image analysis:', {
            cacheLength: cachedAnalysis?.length,
            cachePreview: cachedAnalysis?.substring(0, 100)
          });
          
          enhancedMessage = `CONTEXT: Previous image analysis: "${cachedAnalysis}"

Current user request: "${message}"

Instructions: Respond based on the previous image analysis. The user is asking you to describe or provide details about a previously analyzed image.`;
          
          console.log('📝 [AI SERVICE] Enhanced message with cache:', {
            originalLength: message.length,
            enhancedLength: enhancedMessage.length
          });
        }
        else if (lastImageAnalysis) {
          console.log('✅ [AI SERVICE] Found previous image analysis, enhancing message');
          
          enhancedMessage = `CONTEXT: The user previously uploaded an image and received this analysis: "${lastImageAnalysis.content}"

Current user request: "${message}"

Instructions: Respond based on the previous image analysis. If they're asking for the analysis again or more details, provide information from the previous analysis.`;
        }
        else {
          console.log('❌ [AI SERVICE] No previous image analysis found in context or cache');
        }
      }
    }
    
    const payload = {
      message: enhancedMessage,
      type,
      fileUrl,
      fileType,
      sessionId
    };

    console.log('📤 [AI SERVICE] Sending payload to FastAPI:', {
      messageLength: enhancedMessage.length,
      type,
      sessionId,
      isEnhanced: enhancedMessage !== message,
      payloadPreview: enhancedMessage.substring(0, 150) + '...'
    });

    if (type === 'image') {
      console.log('🖼️ [AI SERVICE] Image analysis request - routing to BLIP');
    } else if (enhancedMessage !== message) {
      console.log('🔄 [AI SERVICE] Enhanced message with image context for Llama3');
    }

    const response = await axios.post(`${FASTAPI_BASE_URL}/chat`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    // ✅ CACHE IMAGE ANALYSIS RESPONSES FOR FUTURE REFERENCE
    if (type === 'image' && response.data) {
      sessionImageCache.set(sessionId, response.data);
      console.log('💾 [AI SERVICE] Cached image analysis for session:', {
        sessionId,
        responseLength: response.data?.length,
        responsePreview: response.data?.substring(0, 100)
      });
      
      // Cleanup old sessions (keep only last 100)
      if (sessionImageCache.size > 100) {
        const firstKey = sessionImageCache.keys().next().value;
        sessionImageCache.delete(firstKey);
      }
    }

    console.log('✅ [AI SERVICE] FastAPI response received:', {
      status: response.status,
      dataLength: response.data?.length,
      processedBy: type === 'image' ? 'BLIP' : 'Llama3',
      usedContext: enhancedMessage !== message,
      responsePreview: response.data?.substring(0, 100)
    });

    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] FastAPI request failed:', {
      error: error.message,
      status: error.response?.status
    });

    if (error.response?.status === 500 && type === 'image') {
      throw new Error('BLIP image analysis failed. Please try with a different image.');
    }

    throw new Error(`AI service error: ${error.message}`);
  }
};

// ✅ HEALTH CHECK FUNCTION
export const checkAIHealth = async () => {
  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/health`, {
      timeout: 5000
    });
    return {
      status: 'healthy',
      services: response.data.services || {},
      fastapi: true
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      fastapi: false
    };
  }
};

// ✅ OPTIONAL: CLEAR SESSION CACHE FUNCTION
export const clearSessionCache = (sessionId) => {
  if (sessionImageCache.has(sessionId)) {
    sessionImageCache.delete(sessionId);
    console.log(`🗑️ [AI SERVICE] Cleared cache for session: ${sessionId}`);
  }
};

// ✅ OPTIONAL: GET CACHE STATS
export const getCacheStats = () => {
  return {
    totalSessions: sessionImageCache.size,
    sessions: Array.from(sessionImageCache.keys())
  };
};
