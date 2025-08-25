// /services/aiService.js
// ✅ MAKE SURE THESE IMPORTS ARE CORRECT:
import axios from 'axios';

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

console.log('🚀 [AI SERVICE] Initializing Enhanced AI Service with Streaming Support...');

// ✅ ENHANCED AI RESPONSE FUNCTION - NOW SUPPORTS STREAMING
export const getAIResponse = async ({ 
  message, 
  extractedText, 
  conversationContext,
  fileUrl,
  type,
  sessionId,
  fileType,
  fileName
}) => {
  console.log('🚀 [AI SERVICE] ==================== STARTING STREAMING AI SERVICE CALL ====================');
  console.log('📥 [AI SERVICE] Input parameters received:');
  console.log('   Message length:', message?.length || 0);
  console.log('   Has extracted text:', !!extractedText);
  console.log('   Extracted text length:', extractedText?.length || 0);
  console.log('   Type:', type);
  console.log('   File name:', fileName);
  
  console.log('🔍 [AI SERVICE] CRITICAL CHECK - What will be sent to FastAPI:');
  console.log('   extractedText value:', extractedText === null ? 'NULL' : extractedText === undefined ? 'UNDEFINED' : `TEXT(${extractedText.length} chars)`);

  console.log('📥 [AI SERVICE] Input parameters:', {
    messageLength: message?.length,
    hasExtractedText: !!extractedText,
    extractedTextLength: extractedText?.length || 0,
    type,
    fileUrl: fileUrl?.substring(0, 50) + (fileUrl?.length > 50 ? '...' : ''),
    fileType,
    fileName,
    sessionId: sessionId?.substring(0, 8) + '...',
    fastApiUrl: `${FASTAPI_BASE_URL}/chat`
  });

  try {
    // ✅ BUILD REQUEST PAYLOAD FOR FASTAPI
    const payload = {
      message: message || '',
      extractedText: extractedText || null,
      type: type || 'text', 
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      conversationContext: conversationContext || [],
      sessionId: sessionId || null
    };

    console.log('📤 [AI SERVICE] Sending payload to FastAPI:', {
      ...payload,
      extractedText: payload.extractedText ? `${payload.extractedText.length} characters - Preview: ${payload.extractedText.substring(0, 100)}...` : null,
      payloadSize: JSON.stringify(payload).length + ' bytes'
    });

    console.log('🌐 [AI SERVICE] Making STREAMING HTTP request to:', `${FASTAPI_BASE_URL}/chat`);

    // ✅ RETURN STREAMING RESPONSE INSTEAD OF WAITING FOR COMPLETION
    return new Promise((resolve, reject) => {
      axios.post(`${FASTAPI_BASE_URL}/chat`, payload, {
        timeout: 300000, // 5 minute timeout for streaming
        headers: {
          'Content-Type': 'application/json',
        },
        responseType: 'stream' // ✅ IMPORTANT: Set to stream
      })
      .then(response => {
        console.log('📥 [AI SERVICE] FastAPI streaming response started:', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });

        let streamedContent = '';

        // ✅ HANDLE STREAMING DATA
        response.data.on('data', (chunk) => {
          const text = chunk.toString();
          streamedContent += text;
          console.log('🌊 [AI SERVICE] Received chunk:', text.length, 'chars');
        });

        response.data.on('end', () => {
          console.log('✅ [AI SERVICE] Streaming completed:', {
            totalLength: streamedContent.length,
            preview: streamedContent.substring(0, 200) + '...'
          });
          console.log('🏁 [AI SERVICE] ==================== AI SERVICE STREAMING COMPLETED ====================');
          resolve(streamedContent);
        });

        response.data.on('error', (error) => {
          console.error('❌ [AI SERVICE] Stream error:', error);
          reject(new Error(`Streaming error: ${error.message}`));
        });
      })
      .catch(error => {
        console.error('❌ [AI SERVICE] ==================== AI SERVICE ERROR ====================');
        console.error('❌ [AI SERVICE] Error name:', error.name);
        console.error('❌ [AI SERVICE] Error message:', error.message);
        
        if (error.response) {
          console.error('❌ [AI SERVICE] FastAPI Error Response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers
          });
          reject(new Error(`FastAPI error: ${error.response.status} - ${error.response.data || 'Unknown error'}`));
        } else if (error.request) {
          console.error('❌ [AI SERVICE] Network Error - FastAPI not responding');
          console.error('❌ [AI SERVICE] Request details:', error.request);
          reject(new Error('Network error: FastAPI server is not responding. Make sure it\'s running on port 8000.'));
        } else {
          console.error('❌ [AI SERVICE] Unexpected error:', error);
          reject(new Error(`AI processing failed: ${error.message}`));
        }
      });
    });

  } catch (error) {
    console.error('❌ [AI SERVICE] Unexpected sync error:', error);
    throw new Error(`AI processing failed: ${error.message}`);
  }
};

// ✅ ALTERNATIVE: STREAMING FUNCTION FOR DIRECT USE IN CONTROLLER
export const getAIResponseStream = async ({ 
  message, 
  extractedText, 
  conversationContext,
  fileUrl,
  type,
  sessionId,
  fileType,
  fileName
}, responseStream) => {
  console.log('🌊 [AI SERVICE] Starting direct streaming to response...');

  try {
    const payload = {
      message: message || '',
      extractedText: extractedText || null,
      type: type || 'text', 
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      conversationContext: conversationContext || [],
      sessionId: sessionId || null
    };

    console.log('📤 [AI SERVICE] Streaming payload to FastAPI...');

    const response = await axios.post(`${FASTAPI_BASE_URL}/chat`, payload, {
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'stream'
    });

    // ✅ PIPE FASTAPI STREAM DIRECTLY TO RESPONSE
    response.data.pipe(responseStream);

    return new Promise((resolve, reject) => {
      response.data.on('end', () => {
        console.log('✅ [AI SERVICE] Direct streaming completed');
        resolve();
      });

      response.data.on('error', (error) => {
        console.error('❌ [AI SERVICE] Direct streaming error:', error);
        reject(error);
      });
    });

  } catch (error) {
    console.error('❌ [AI SERVICE] Direct streaming failed:', error);
    responseStream.write(`❌ Streaming Error: ${error.message}`);
    throw error;
  }
};

// ✅ HEALTH CHECK FOR FASTAPI (UNCHANGED - STILL GOOD)
export const checkAIHealth = async () => {
  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/health`, {
      timeout: 5000
    });
    
    return {
      status: 'healthy',
      services: response.data.services || {},
      supportedTypes: response.data.supported_types || ['text', 'image', 'document'],
      fastapi: true,
      streaming: true, // ✅ INDICATE STREAMING SUPPORT
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      fastapi: false,
      streaming: false,
      timestamp: new Date().toISOString()
    };
  }
};

console.log('✅ [AI SERVICE] Enhanced Streaming AI Service initialized');
console.log('🔧 [AI SERVICE] Features: FastAPI integration, text extraction support, word-by-word streaming');
console.log(`📡 [AI SERVICE] FastAPI URL: ${FASTAPI_BASE_URL}/chat`);
