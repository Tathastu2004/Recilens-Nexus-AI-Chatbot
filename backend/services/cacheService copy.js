import { createClient } from 'redis';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
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

  // ✅ STORE EXTRACTED TEXT WITH 20 MIN TTL
  async storeExtractedText(uploadId, data) {
    const key = `extracted_text:${uploadId}`;
    const ttl = 20 * 60; // 20 minutes in seconds
    
    try {
      if (this.client && this.isConnected) {
        // ✅ USE REDIS
        await this.client.setEx(key, ttl, JSON.stringify(data));
        console.log('✅ [REDIS] Stored extracted text:', {
          uploadId: uploadId.substring(0, 12) + '...',
          textLength: data.extractedText?.length || 0,
          ttl: `${ttl / 60} minutes`
        });
        return true;
      } else {
        // ✅ FALLBACK TO IN-MEMORY
        this.storeInMemory(uploadId, data, ttl);
        return true;
      }
    } catch (error) {
      console.error('❌ [REDIS] Failed to store:', error.message);
      // ✅ FALLBACK TO IN-MEMORY
      this.storeInMemory(uploadId, data, ttl);
      return false;
    }
  }

  // ✅ RETRIEVE EXTRACTED TEXT
  async getExtractedText(uploadId) {
    const key = `extracted_text:${uploadId}`;
    
    try {
      if (this.client && this.isConnected) {
        // ✅ GET FROM REDIS
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
        // ✅ FALLBACK TO IN-MEMORY
        return this.getFromMemory(uploadId);
      }
    } catch (error) {
      console.error('❌ [REDIS] Failed to retrieve:', error.message);
      return this.getFromMemory(uploadId);
    }
    
    return null;
  }

  // ✅ DELETE EXTRACTED TEXT
  async deleteExtractedText(uploadId) {
    const key = `extracted_text:${uploadId}`;
    
    try {
      if (this.client && this.isConnected) {
        await this.client.del(key);
      }
      // Also clear from memory fallback
      if (global.uploadCache && global.uploadCache[uploadId]) {
        delete global.uploadCache[uploadId];
      }
      
      console.log('🗑️ [REDIS] Deleted extracted text:', uploadId.substring(0, 12) + '...');
    } catch (error) {
      console.error('❌ [REDIS] Failed to delete:', error.message);
    }
  }

  // ✅ IN-MEMORY FALLBACK METHODS
  storeInMemory(uploadId, data, ttlSeconds) {
    global.uploadCache = global.uploadCache || {};
    global.uploadCache[uploadId] = {
      ...data,
      expiresAt: new Date(Date.now() + (ttlSeconds * 1000))
    };
    
    // ✅ CLEANUP EXPIRED ENTRIES
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
    
    // ✅ CHECK IF EXPIRED
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

  // ✅ HEALTH CHECK
  async isHealthy() {
    try {
      if (this.client && this.isConnected) {
        await this.client.ping();
        return { status: 'healthy', type: 'redis' };
      } else {
        return { status: 'healthy', type: 'memory_fallback' };
      }
    } catch (error) {
      return { status: 'unhealthy', error: error.message, type: 'memory_fallback' };
    }
  }
}

// ✅ EXPORT SINGLETON INSTANCE
export const cacheService = new CacheService();