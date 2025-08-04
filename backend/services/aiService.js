// /services/aiService.js
import axios from 'axios';

console.log('🚀 [AI SERVICE] Initializing AI Service...');

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

// ✅ Stream-based AI Response from FastAPI
export const getAIResponse = async (input) => {
  console.log('🚀 [AI SERVICE] Calling FastAPI stream endpoint...');
  console.log('📦 [DEBUG] Input payload:', JSON.stringify(input, null, 2));

  try {
    // ✅ VALIDATE INPUT
    if (!input || (!input.message && !input.prompt)) {
      throw new Error('No message or prompt provided');
    }

    // ✅ ULTRA SIMPLE PAYLOAD
    const payload = {
      message: input.message || input.prompt || '',
      type: "chat"
    };

    console.log('📤 [AI SERVICE] Sending ultra simple payload:', JSON.stringify(payload, null, 2));

    // ✅ TEST 1: HEALTH CHECK
    try {
      const healthCheck = await axios.get(`${FASTAPI_BASE_URL}/health`, { timeout: 5000 });
      console.log('✅ [AI SERVICE] Health check passed:', healthCheck.status);
    } catch (healthError) {
      console.error('❌ [AI SERVICE] Health check failed:', healthError.message);
      return '⚠️ FastAPI service is not available.';
    }

    // ✅ TEST 2: DEBUG ENDPOINT
    try {
      const debugResponse = await axios.post(`${FASTAPI_BASE_URL}/debug`, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log('✅ [AI SERVICE] Debug endpoint passed:', debugResponse.status);
      console.log('📋 [AI SERVICE] Debug response:', debugResponse.data);
    } catch (debugError) {
      console.error('❌ [AI SERVICE] Debug endpoint failed:', {
        status: debugError.response?.status,
        data: debugError.response?.data,
        message: debugError.message
      });
      return `⚠️ Debug test failed: ${JSON.stringify(debugError.response?.data)}`;
    }

    // ✅ TEST 3: SIMPLE TEST ENDPOINT
    try {
      const testResponse = await axios.post(`${FASTAPI_BASE_URL}/test`, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log('✅ [AI SERVICE] Test endpoint passed:', testResponse.status);
    } catch (testError) {
      console.error('❌ [AI SERVICE] Test endpoint failed:', {
        status: testError.response?.status,
        data: testError.response?.data
      });
      return `⚠️ Test endpoint failed: ${JSON.stringify(testError.response?.data)}`;
    }

    // ✅ TEST 4: ACTUAL CHAT REQUEST
    const response = await axios.post(`${FASTAPI_BASE_URL}/chat`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
      },
      responseType: 'stream',
      timeout: 60000,
    });

    console.log('📥 [AI SERVICE] Chat response status:', response.status);

    let fullText = '';
    response.data.setEncoding('utf8');

    for await (const chunk of response.data) {
      fullText += chunk;
      console.log('📝 [AI SERVICE] Chunk received:', chunk.length, 'chars');
    }

    console.log('✅ [AI SERVICE] Stream complete. Total length:', fullText.length);
    
    if (!fullText.trim()) {
      throw new Error('Empty response from AI service');
    }

    return fullText;

  } catch (error) {
    console.error('❌ [AI SERVICE] Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });

    // ✅ DETAILED ERROR MESSAGES
    if (error.code === 'ECONNREFUSED') {
      return '⚠️ AI service is not running. Please start the FastAPI server on port 8000.';
    } else if (error.response?.status === 400) {
      return `⚠️ Bad Request (400): ${JSON.stringify(error.response.data)}`;
    } else if (error.response?.status === 422) {
      return `⚠️ Validation Error (422): ${JSON.stringify(error.response.data)}`;
    } else if (error.response?.status === 503) {
      return '⚠️ Ollama service is not available. Please make sure Ollama is running.';
    } else {
      return `⚠️ AI service failed (${error.response?.status || 'unknown'}): ${JSON.stringify(error.response?.data) || error.message}`;
    }
  }
};

// ✅ Alias (if any call uses the older function)
export const getSimpleAIResponse = getAIResponse;

console.log('✅ [AI SERVICE] FastAPI streaming AI ready.');
