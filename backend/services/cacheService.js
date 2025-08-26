// services/cacheService.js - UPDATED
import { createClient } from 'redis';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.CONTEXT_SIZE = 15;
    this.CONTEXT_EXPIRY = 24 * 60 * 60; // 24 hours
    this.init();
  }

  async init() {
    try {
      // ✅ CREATE REDIS CLIENT
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      // ✅ ERROR HANDLING
      this.client.on('error', (error) => {
        console.error('❌ [REDIS] Redis client error:', error.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ [REDIS] Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('⚠️ [REDIS] Disconnected from Redis');
        this.isConnected = false;
      });

      // ✅ CONNECT TO REDIS
      await this.client.connect();
      
    } catch (error) {
      console.error('❌ [REDIS] Failed to initialize Redis:', error.message);
      console.log('⚠️ [REDIS] Falling back to in-memory cache');
      this.client = null;
      this.isConnected = false;
    }
  }

  // ✅ NEW: CHAT CONTEXT MANAGEMENT
  getChatContextKey(sessionId, userId = 'default') {
    return `chat_context:${sessionId}:${userId}`;
  }

  // ✅ ADD MESSAGE TO CONTEXT WINDOW
  async addMessageToContext(sessionId, message, userId = 'default') {
    const key = this.getChatContextKey(sessionId, userId);
    const messageData = {
      timestamp: Date.now(),
      role: message.role || (message.sender === 'AI' ? 'assistant' : 'user'),
      content: message.content || message.message,
      messageId: message._id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: message.type || 'text'
    };

    try {
      if (this.client && this.isConnected) {
        // ✅ USE REDIS PIPELINE FOR ATOMIC OPERATIONS
        const pipeline = this.client.multi();
        
        // Add new message to the end of the list
        pipeline.rPush(key, JSON.stringify(messageData));
        
        // Keep only last 15 messages (sliding window)
        pipeline.lTrim(key, -this.CONTEXT_SIZE, -1);
        
        // Set expiry
        pipeline.expire(key, this.CONTEXT_EXPIRY);
        
        await pipeline.exec();
        
        console.log('✅ [CONTEXT] Added message to context window:', {
          sessionId: sessionId.substring(0, 8) + '...',
          role: messageData.role,
          content: messageData.content.substring(0, 50) + '...',
          contextSize: await this.getContextSize(sessionId, userId)
        });
        
        return messageData;
      } else {
        // ✅ FALLBACK TO IN-MEMORY
        return this.addMessageToMemoryContext(sessionId, messageData, userId);
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Failed to add message to context:', error.message);
      return this.addMessageToMemoryContext(sessionId, messageData, userId);
    }
  }

  // ✅ GET RECENT 15 MESSAGES FOR CONTEXT
  async getRecentContext(sessionId, userId = 'default') {
    const key = this.getChatContextKey(sessionId, userId);
    
    try {
      if (this.client && this.isConnected) {
        // ✅ GET FROM REDIS
        const messages = await this.client.lRange(key, 0, -1);
        const contextMessages = messages.map(msg => JSON.parse(msg));
        
        console.log('✅ [CONTEXT] Retrieved context for session:', {
          sessionId: sessionId.substring(0, 8) + '...',
          messageCount: contextMessages.length,
          oldestMessage: contextMessages[0]?.timestamp ? new Date(contextMessages[0].timestamp).toLocaleTimeString() : 'N/A',
          newestMessage: contextMessages[contextMessages.length - 1]?.timestamp ? new Date(contextMessages[contextMessages.length - 1].timestamp).toLocaleTimeString() : 'N/A'
        });
        
        return contextMessages;
      } else {
        // ✅ FALLBACK TO IN-MEMORY
        return this.getMemoryContext(sessionId, userId);
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Failed to retrieve context:', error.message);
      return this.getMemoryContext(sessionId, userId);
    }
  }

  // ✅ GET FORMATTED CONTEXT FOR LLAMA MODEL
  async getFormattedContextForLlama(sessionId, userId = 'default') {
    const messages = await this.getRecentContext(sessionId, userId);
    
    // Format messages for Llama3 model
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    console.log('🦙 [LLAMA CONTEXT] Formatted context for model:', {
      sessionId: sessionId.substring(0, 8) + '...',
      messageCount: formattedMessages.length,
      roles: formattedMessages.map(m => m.role).join(', ')
    });

    return formattedMessages;
  }

  // ✅ GET CONTEXT SIZE
  async getContextSize(sessionId, userId = 'default') {
    const key = this.getChatContextKey(sessionId, userId);
    
    try {
      if (this.client && this.isConnected) {
        return await this.client.lLen(key);
      } else {
        const memoryContext = this.getMemoryContext(sessionId, userId);
        return memoryContext.length;
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Failed to get context size:', error.message);
      return 0;
    }
  }

  // ✅ CLEAR CONTEXT FOR SESSION
  async clearContext(sessionId, userId = 'default') {
    const key = this.getChatContextKey(sessionId, userId);
    
    try {
      if (this.client && this.isConnected) {
        await this.client.del(key);
      }
      
      // Also clear from memory fallback
      if (global.chatContextCache && global.chatContextCache[sessionId]) {
        delete global.chatContextCache[sessionId];
      }
      
      console.log('🗑️ [CONTEXT] Cleared context for session:', sessionId.substring(0, 8) + '...');
    } catch (error) {
      console.error('❌ [CONTEXT] Failed to clear context:', error.message);
    }
  }

  // ✅ GET CONTEXT STATISTICS
  async getContextStats(sessionId, userId = 'default') {
    const key = this.getChatContextKey(sessionId, userId);
    
    try {
      const contextSize = await this.getContextSize(sessionId, userId);
      const ttl = this.client && this.isConnected ? await this.client.ttl(key) : -1;
      
      return {
        sessionId,
        userId,
        messageCount: contextSize,
        maxSize: this.CONTEXT_SIZE,
        expiresIn: ttl,
        isActive: contextSize > 0,
        storageType: this.isConnected ? 'redis' : 'memory'
      };
    } catch (error) {
      console.error('❌ [CONTEXT] Failed to get context stats:', error.message);
      return {
        sessionId,
        userId,
        messageCount: 0,
        maxSize: this.CONTEXT_SIZE,
        expiresIn: -1,
        isActive: false,
        storageType: 'error'
      };
    }
  }

  // ✅ IN-MEMORY FALLBACK FOR CONTEXT
  addMessageToMemoryContext(sessionId, messageData, userId) {
    global.chatContextCache = global.chatContextCache || {};
    const contextKey = `${sessionId}:${userId}`;
    
    if (!global.chatContextCache[contextKey]) {
      global.chatContextCache[contextKey] = [];
    }
    
    global.chatContextCache[contextKey].push(messageData);
    
    // Keep only last 15 messages
    if (global.chatContextCache[contextKey].length > this.CONTEXT_SIZE) {
      global.chatContextCache[contextKey] = global.chatContextCache[contextKey].slice(-this.CONTEXT_SIZE);
    }
    
    console.log('💾 [MEMORY CONTEXT] Stored message in memory fallback:', {
      sessionId: sessionId.substring(0, 8) + '...',
      count: global.chatContextCache[contextKey].length
    });
    
    return messageData;
  }

  getMemoryContext(sessionId, userId) {
    if (!global.chatContextCache) return [];
    const contextKey = `${sessionId}:${userId}`;
    return global.chatContextCache[contextKey] || [];
  }

  // ✅ EXISTING EXTRACTED TEXT METHODS (UNCHANGED)
  async storeExtractedText(uploadId, data) {
    const key = `extracted_text:${uploadId}`;
    const ttl = 20 * 60; // 20 minutes in seconds
    
    try {
      if (this.client && this.isConnected) {
        await this.client.setEx(key, ttl, JSON.stringify(data));
        console.log('✅ [REDIS] Stored extracted text:', {
          uploadId: uploadId.substring(0, 12) + '...',
          textLength: data.extractedText?.length || 0,
          ttl: `${ttl / 60} minutes`
        });
        return true;
      } else {
        this.storeInMemory(uploadId, data, ttl);
        return true;
      }
    } catch (error) {
      console.error('❌ [REDIS] Failed to store:', error.message);
      this.storeInMemory(uploadId, data, ttl);
      return false;
    }
  }

  async getExtractedText(uploadId) {
    const key = `extracted_text:${uploadId}`;
    
    try {
      if (this.client && this.isConnected) {
        const data = await this.client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          console.log('✅ [REDIS] Retrieved extracted text:', {
            uploadId: uploadId.substring(0, 12) + '...',
            textLength: parsed.extractedText?.length || 0
          });
          return parsed;
        }
      } else {
        return this.getFromMemory(uploadId);
      }
    } catch (error) {
      console.error('❌ [REDIS] Failed to retrieve:', error.message);
      return this.getFromMemory(uploadId);
    }
    
    return null;
  }

  async deleteExtractedText(uploadId) {
    const key = `extracted_text:${uploadId}`;
    
    try {
      if (this.client && this.isConnected) {
        await this.client.del(key);
      }
      if (global.uploadCache && global.uploadCache[uploadId]) {
        delete global.uploadCache[uploadId];
      }
      
      console.log('🗑️ [REDIS] Deleted extracted text:', uploadId.substring(0, 12) + '...');
    } catch (error) {
      console.error('❌ [REDIS] Failed to delete:', error.message);
    }
  }

  // ✅ IN-MEMORY FALLBACK METHODS (UNCHANGED)
  storeInMemory(uploadId, data, ttlSeconds) {
    global.uploadCache = global.uploadCache || {};
    global.uploadCache[uploadId] = {
      ...data,
      expiresAt: new Date(Date.now() + (ttlSeconds * 1000))
    };
    
    this.cleanupMemoryCache();
    
    console.log('💾 [MEMORY] Stored extracted text (fallback):', {
      uploadId: uploadId.substring(0, 12) + '...',
      textLength: data.extractedText?.length || 0,
      expiresAt: global.uploadCache[uploadId].expiresAt
    });
  }

  getFromMemory(uploadId) {
    if (!global.uploadCache || !global.uploadCache[uploadId]) {
      return null;
    }
    
    const entry = global.uploadCache[uploadId];
    
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      delete global.uploadCache[uploadId];
      console.log('⏰ [MEMORY] Entry expired and removed:', uploadId.substring(0, 12) + '...');
      return null;
    }
    
    console.log('✅ [MEMORY] Retrieved extracted text (fallback):', {
      uploadId: uploadId.substring(0, 12) + '...',
      textLength: entry.extractedText?.length || 0
    });
    
    return entry;
  }

  cleanupMemoryCache() {
    if (!global.uploadCache) return;
    
    const now = new Date();
    let cleaned = 0;
    
    Object.keys(global.uploadCache).forEach(key => {
      const entry = global.uploadCache[key];
      if (entry.expiresAt && now > entry.expiresAt) {
        delete global.uploadCache[key];
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`🧹 [MEMORY] Cleaned up ${cleaned} expired entries`);
    }
  }

  // ✅ ENHANCED HEALTH CHECK
  async isHealthy() {
    try {
      if (this.client && this.isConnected) {
        await this.client.ping();
        return { 
          status: 'healthy', 
          type: 'redis',
          contextFeature: 'enabled',
          contextSize: this.CONTEXT_SIZE
        };
      } else {
        return { 
          status: 'healthy', 
          type: 'memory_fallback',
          contextFeature: 'enabled',
          contextSize: this.CONTEXT_SIZE
        };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        type: 'memory_fallback',
        contextFeature: 'enabled',
        contextSize: this.CONTEXT_SIZE
      };
    }
  }
}

// ✅ EXPORT SINGLETON INSTANCE
export const cacheService = new CacheService();
