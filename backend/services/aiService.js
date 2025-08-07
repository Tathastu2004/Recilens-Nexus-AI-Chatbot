// /services/aiService.js
// ✅ MAKE SURE THESE IMPORTS ARE CORRECT:
import axios from 'axios';

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

console.log('🚀 [AI SERVICE] Initializing Enhanced AI Service with Backend Text Extraction...');

// ✅ ENHANCED AI RESPONSE FUNCTION - CALLS FASTAPI /chat ENDPOINT
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
  console.log('🚀 [AI SERVICE] ==================== STARTING AI SERVICE CALL ====================');
  console.log('📥 [AI SERVICE] Input parameters received:');
  console.log('   Message length:', message?.length || 0);
  console.log('   Has extracted text:', !!extractedText);
  console.log('   Extracted text length:', extractedText?.length || 0);
  console.log('   Extracted text type:', typeof extractedText);
  console.log('   Extracted text preview:', extractedText ? extractedText.substring(0, 100) + '...' : 'null');
  console.log('   Type:', type);
  console.log('   File name:', fileName);
  
  // ✅ CRITICAL DEBUG - CHECK WHAT'S BEING SENT TO FASTAPI
  console.log('🔍 [AI SERVICE] CRITICAL CHECK - What will be sent to FastAPI:');
  console.log('   extractedText value:', extractedText === null ? 'NULL' : extractedText === undefined ? 'UNDEFINED' : `TEXT(${extractedText.length} chars)`);

  // ✅ EXISTING CODE CONTINUES HERE...
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

    console.log('🌐 [AI SERVICE] Making HTTP request to:', `${FASTAPI_BASE_URL}/chat`);

    // ✅ CALL FASTAPI /chat ENDPOINT
    const response = await axios.post(`${FASTAPI_BASE_URL}/chat`, payload, {
      timeout: 120000, // 2 minute timeout for document processing
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'text' // ✅ FASTAPI RETURNS PLAIN TEXT
    });

    console.log('📥 [AI SERVICE] FastAPI response received:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      dataType: typeof response.data,
      dataLength: response.data?.length || 0,
      responsePreview: response.data ? response.data.substring(0, 200) + '...' : null
    });

    // ✅ FASTAPI RETURNS PLAIN TEXT RESPONSE
    const aiResponse = response.data || 'No response generated';
    
    console.log('✅ [AI SERVICE] AI response processed:', {
      finalLength: aiResponse.length,
      finalPreview: aiResponse.substring(0, 200) + '...'
    });
    console.log('🏁 [AI SERVICE] ==================== AI SERVICE CALL COMPLETED ====================');

    return aiResponse;

  } catch (error) {
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
      throw new Error(`FastAPI error: ${error.response.status} - ${error.response.data || 'Unknown error'}`);
    } else if (error.request) {
      console.error('❌ [AI SERVICE] Network Error - FastAPI not responding');
      console.error('❌ [AI SERVICE] Request details:', error.request);
      throw new Error('Network error: FastAPI server is not responding. Make sure it\'s running on port 8000.');
    } else {
      console.error('❌ [AI SERVICE] Unexpected error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }
};

// ✅ HEALTH CHECK FOR FASTAPI
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
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      fastapi: false,
      timestamp: new Date().toISOString()
    };
  }
};

console.log('✅ [AI SERVICE] Enhanced AI Service initialized');
console.log('🔧 [AI SERVICE] Features: FastAPI integration, text extraction support');
console.log(`📡 [AI SERVICE] FastAPI URL: ${FASTAPI_BASE_URL}/chat`);
