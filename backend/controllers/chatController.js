// controllers/chatController.js - UPDATED
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { getAIResponse } from '../services/aiService.js';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { cacheService } from '../services/cacheService.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000";

// ✅ EXISTING UTILITY FUNCTIONS (UNCHANGED)
const generateFileHash = (fileBuffer) => {
  try {
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (error) {
    console.error('❌ [HASH] Failed to generate file hash:', error.message);
    return 'hash_failed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
};

const uploadWithDeduplication = async (filePath, options = {}) => {
  try {
    console.log('☁️ [DEDUP] Starting upload with deduplication...');
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = generateFileHash(fileBuffer);
    console.log('🔍 [DEDUP] File hash generated:', fileHash.substring(0, 8) + '...');
    
    try {
      const searchResult = await cloudinary.search
        .expression(`tags=${fileHash}`)
        .max_results(1)
        .execute();
        
      if (searchResult.resources && searchResult.resources.length > 0) {
        const existingFile = searchResult.resources[0];
        console.log('♻️ [DEDUP] Duplicate found, reusing existing file:', existingFile.public_id);
        return {
          ...existingFile,
          isDuplicate: true,
          originalHash: fileHash,
          message: 'Duplicate file found, reusing existing upload'
        };
      }
    } catch (searchError) {
      console.warn('⚠️ [DEDUP] Search failed, proceeding with new upload:', searchError.message);
    }
    
    console.log('📤 [DEDUP] Uploading new file...');
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      ...options,
      tags: [...(options.tags || []), fileHash, 'nexus_chat'],
      context: {
        ...options.context,
        file_hash: fileHash,
        uploaded_at: new Date().toISOString()
      }
    });
    
    console.log('✅ [DEDUP] New file uploaded successfully:', uploadResult.public_id);
    return {
      ...uploadResult,
      isDuplicate: false,
      originalHash: fileHash,
      message: 'New file uploaded successfully'
    };
  } catch (error) {
    console.error('❌ [DEDUP] Upload with deduplication failed:', error.message);
    throw error;
  }
};

// ✅ EXISTING CRUD OPERATIONS (UNCHANGED)
export const createChatSession = async (req, res) => {
  try {
    const newSession = new ChatSession({
      user: req.user._id,
      title: req.body.title || 'New Chat'
    });
    const saved = await newSession.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating chat session' });
  }
};

export const getUserChatSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

export const getSessionMessages = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const messages = await Message.find({ session: sessionId }).sort({ createdAt: 1 });
    
    // ✅ NEW: Include context stats in response
    const contextStats = await cacheService.getContextStats(sessionId, req.user._id);
    
    res.status(200).json({
      success: true,
      messages,
      contextStats,
      sessionId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving messages' });
  }
};

export const updateSessionTitle = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const updatedSession = await ChatSession.findOneAndUpdate(
      { _id: sessionId, user: req.user._id },
      { title, updatedAt: new Date() },
      { new: true }
    );
    if (!updatedSession) return res.status(404).json({ message: 'Session not found or unauthorized' });
    res.json({ success: true, session: updatedSession });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update session title' });
  }
};

export const deleteChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    
    // ✅ NEW: Clear context from Redis when deleting session
    await cacheService.clearContext(sessionId, userId);
    
    const messages = await Message.find({ session: sessionId });
    const publicIds = messages
      .map(msg => msg.fileUrl?.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/)?.[1])
      .filter(Boolean);
    if (publicIds.length > 0) await cloudinary.api.delete_resources(publicIds);
    await Message.deleteMany({ session: sessionId });
    const deletedSession = await ChatSession.findOneAndDelete({ _id: sessionId, user: userId });
    if (!deletedSession) return res.status(404).json({ message: 'Session not found or unauthorized' });
    res.json({ success: true, message: 'Session and files deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete session' });
  }
};

// ✅ EXISTING FILE UPLOAD (UNCHANGED)
export const uploadFileHandler = async (req, res) => {
  console.log('📤 [UPLOAD] Starting file upload and text extraction...');
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    console.log('📋 [UPLOAD] File received:', req.file.originalname);

    let uploadResult;
    let extractedText = null;

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(fileExtension);
    const isDocument = ['.pdf', '.txt', '.docx', '.doc'].includes(fileExtension);

    uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'nexus_chat_files',
      resource_type: isImage ? 'image' : 'raw',
      use_filename: true,
      unique_filename: true,
      access_mode: 'public',
    });

    if (isDocument) {
      const fileBuffer = fs.readFileSync(req.file.path);
      if (fileExtension === '.pdf') {
        try {
          const { parsePdf } = await import('../utils/pdfParser.js');
          extractedText = await parsePdf(fileBuffer);
        } catch (pdfError) {
          extractedText = `❌ PDF text extraction failed: ${pdfError.message}`;
        }
      } else if (fileExtension === '.txt') {
        extractedText = fileBuffer.toString('utf8').trim();
      }
      
      if (extractedText && !extractedText.startsWith('❌')) {
        console.log(`✅ [EXTRACTION] Text successfully extracted from ${req.file.originalname}. Length: ${extractedText.length} characters.`);
      }
    }

    const hasValidText = extractedText && !extractedText.startsWith('❌');
    
    res.status(200).json({
      success: true,
      message: isImage ? 
        'Image uploaded successfully. Ready for BLIP analysis.' : 
        'Document processed successfully. Ready for user prompt.',
      fileUrl: uploadResult.secure_url,
      fileName: req.file.originalname,
      fileType: isImage ? 'image' : 'document',
      extractedText: isDocument ? extractedText : undefined,
      hasText: isDocument ? hasValidText : false,
      textLength: isDocument && hasValidText ? extractedText.length : 0,
    });

  } catch (error) {
    console.error('❌ [UPLOAD] A critical error occurred:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};

// ✅ FIXED SEND MESSAGE - CORRECTED SENDER FIELD
export const sendMessage = async (req, res) => {
  console.log("📨 [SEND MESSAGE] Request received for streaming with context...");
  
  try {
    const { sessionId, message, type = "text", fileUrl, fileType, fileName, extractedText } = req.body;
    const userId = req.user._id;

    // ✅ VALIDATION
    if (!sessionId || !message) {
      console.error('❌ [SEND MESSAGE] Missing required fields:', { sessionId: !!sessionId, message: !!message });
      return res.status(400).json({ 
        success: false, 
        error: "Session ID and message are required" 
      });
    }

    // ✅ VERIFY SESSION ACCESS
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      console.error('❌ [SEND MESSAGE] Session access denied:', { 
        sessionFound: !!session, 
        sessionUser: session?.user?.toString(), 
        requestUser: userId.toString() 
      });
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }

    // ✅ SAVE USER MESSAGE WITH CORRECT SENDER FORMAT
    const userMessage = new Message({
      session: sessionId,
      message,
      sender: "user", // ✅ FIXED: Use string enum value, not userId
      type,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      extractedText: extractedText || null,
      hasTextExtraction: !!(extractedText && !extractedText.startsWith("❌")),
      textLength: extractedText ? extractedText.length : 0,
      userId: userId, // ✅ ADD SEPARATE FIELD FOR USER ID REFERENCE
    });
    
    const savedUserMessage = await userMessage.save();
    console.log("✅ [SEND MESSAGE] User message saved:", savedUserMessage._id);

    // ✅ ADD TO REDIS CONTEXT
    try {
      await cacheService.addMessageToContext(sessionId, {
        role: 'user',
        content: message,
        _id: savedUserMessage._id
      }, userId);
    } catch (contextError) {
      console.warn('⚠️ [SEND MESSAGE] Context service warning:', contextError.message);
    }

    // ✅ GET CONTEXT FOR FASTAPI
    let recentContext = [];
    try {
      recentContext = await cacheService.getFormattedContextForLlama(sessionId, userId);
    } catch (contextError) {
      console.warn('⚠️ [SEND MESSAGE] Context retrieval warning:', contextError.message);
      recentContext = [];
    }

    // ✅ ENHANCED STREAMING HEADERS
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });

    let streamedResponse = "";
    let chunkCount = 0;

    try {
      const fastApiPayload = {
        message,
        extractedText,
        type,
        fileUrl,
        fileType,
        fileName,
        sessionId,
        conversationContext: recentContext
      };

      console.log('🦙 [FASTAPI] Sending to FastAPI:', {
        contextMessages: recentContext.length,
        type: type,
        hasExtractedText: !!extractedText,
        payload: JSON.stringify(fastApiPayload).length + ' bytes'
      });

      // ✅ CHECK IF FASTAPI IS AVAILABLE
      const fastApiResponse = await axios.post(`${FASTAPI_BASE_URL}/chat`, fastApiPayload, {
        responseType: 'stream',
        timeout: 120000,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (status) => status < 500,
      });

      if (fastApiResponse.status !== 200) {
        throw new Error(`FastAPI returned status ${fastApiResponse.status}`);
      }

      // ✅ IMPROVED CHUNK HANDLING
      fastApiResponse.data.on('data', (chunk) => {
        try {
          const chunkStr = chunk.toString('utf8');
          streamedResponse += chunkStr;
          chunkCount++;
          
          console.log(`📦 [CHUNK ${chunkCount}] Size: ${chunk.length} bytes`);
          
          res.write(chunkStr);
          if (res.flush) {
            res.flush();
          }
        } catch (chunkError) {
          console.error('❌ [CHUNK ERROR]:', chunkError);
        }
      });

      fastApiResponse.data.on('end', async () => {
        try {
          console.log("✅ [STREAMING] FastAPI completed");
          console.log(`📊 Final response length: ${streamedResponse.length} chars`);
          
          // ✅ SAVE AI MESSAGE WITH CORRECT SENDER FORMAT
          const aiMessage = new Message({
            session: sessionId,
            message: streamedResponse,
            sender: "AI", // ✅ FIXED: Use string enum value
            type: type,
            userId: userId, // ✅ ADD USER ID REFERENCE
            metadata: {
              streamingCompleted: true,
              contextUsed: recentContext.length,
              blipIntegrated: type === 'image',
              processingPipeline: type === 'image' ? 'BLIP→Context→Llama' : 'Llama'
            },
          });
          
          const savedAiMessage = await aiMessage.save();
          
          // ✅ ADD AI RESPONSE TO REDIS CONTEXT
          try {
            await cacheService.addMessageToContext(sessionId, {
              role: 'assistant',
              content: streamedResponse,
              _id: savedAiMessage._id
            }, userId);
          } catch (contextError) {
            console.warn('⚠️ [AI CONTEXT] Warning saving AI response to context:', contextError.message);
          }

          // ✅ UPDATE SESSION ACTIVITY
          session.lastActivity = new Date();
          await session.save();
          
          res.end();
        } catch (endError) {
          console.error('❌ [STREAMING END] Error:', endError);
          res.end();
        }
      });

      fastApiResponse.data.on('error', (error) => {
        console.error("❌ [STREAMING] FastAPI stream error:", error);
        const errorMsg = `❌ Streaming Error: ${error.message}`;
        if (!res.headersSent) {
          res.write(errorMsg);
        }
        res.end();
      });

      req.on('close', () => {
        console.log('🔌 [STREAMING] Client disconnected');
        if (fastApiResponse.data) {
          fastApiResponse.data.destroy();
        }
      });

    } catch (fastApiError) {
      console.error("❌ [FASTAPI] Error:", fastApiError);
      
      const errorMessage = `❌ AI Service Error: ${fastApiError.message}. Please try again.`;
      
      if (!res.headersSent) {
        res.write(errorMessage);
      }
      
      // ✅ SAVE ERROR MESSAGE WITH CORRECT SENDER FORMAT
      try {
        const errorAiMessage = new Message({
          session: sessionId,
          message: errorMessage,
          sender: "AI", // ✅ FIXED: Use string enum value
          type: "error",
          userId: userId, // ✅ ADD USER ID REFERENCE
          metadata: {
            error: true,
            errorType: 'fastapi_error',
            originalError: fastApiError.message
          },
        });
        
        await errorAiMessage.save();
      } catch (saveError) {
        console.error('❌ [ERROR SAVE] Failed to save error message:', saveError);
      }
      
      res.end();
    }

  } catch (error) {
    console.error("❌ [SEND MESSAGE] Controller error:", error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: "Failed to send message",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// ✅ NEW: GET CONTEXT ENDPOINT
export const getSessionContext = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    
    const context = await cacheService.getRecentContext(sessionId, userId);
    const contextStats = await cacheService.getContextStats(sessionId, userId);
    
    res.json({
      success: true,
      context,
      stats: contextStats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get session context' 
    });
  }
};

// ✅ NEW: CLEAR CONTEXT ENDPOINT
export const clearSessionContext = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    console.log(`[Controller] Attempting to clear context for session: ${sessionId}, user: ${userId}`);

    await cacheService.clearContext(sessionId, userId);

    console.log(`[Controller] Successfully cleared context for session: ${sessionId}, user: ${userId}`);

    res.json({
      success: true,
      message: 'Session context cleared successfully'
    });
  } catch (error) {
    console.error(`[Controller] Error clearing context:`, error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear session context' 
    });
  }
};

// ✅ EXISTING UTILITY ENDPOINTS (UNCHANGED)
export const validateFileType = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    const supportedTypes = {
      images: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'],
      documents: ['.pdf', '.docx', '.doc', '.txt']
    };
    const ext = path.extname(fileName).toLowerCase();
    const isImage = supportedTypes.images.includes(ext);
    const isDocument = supportedTypes.documents.includes(ext);
    res.json({
      isValid: isImage || isDocument,
      detectedType: isImage ? 'image' : isDocument ? 'document' : 'unknown',
      supportedTypes,
      canExtractText: isDocument
    });
  } catch (error) {
    res.status(500).json({ error: 'Validation failed' });
  }
};

export const getSessionStats = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await Message.find({ session: sessionId }).lean();
    
    // ✅ INCLUDE CONTEXT STATS
    const contextStats = await cacheService.getContextStats(sessionId, req.user._id);
    
    const stats = {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.sender !== 'AI').length,
      aiMessages: messages.filter(m => m.sender === 'AI').length,
      imageMessages: messages.filter(m => m.type === 'image').length,
      documentMessages: messages.filter(m => m.type === 'document').length,
      filesUploaded: messages.filter(m => m.fileUrl).length,
      documentsWithText: messages.filter(m => m.extractedText && !m.extractedText.startsWith('❌')).length,
      totalExtractedChars: messages.reduce((sum, m) => sum + (m.extractedText?.length || 0), 0),
      contextStats // ✅ INCLUDE CONTEXT INFORMATION
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session stats' });
  }
};

export const getDuplicateStats = async (req, res) => {
  try {
    const duplicateSearch = await cloudinary.search
      .expression('tags:nexus_chat')
      .with_field('tags')
      .with_field('context')
      .max_results(500)
      .execute();
    const filesByHash = {};
    let totalFiles = 0;
    let duplicateFiles = 0;
    let savedBandwidth = 0;
    duplicateSearch.resources.forEach(file => {
      totalFiles++;
      const hash = file.tags?.find(tag => tag.length === 32);
      if (hash) {
        if (!filesByHash[hash]) {
          filesByHash[hash] = [];
        }
        filesByHash[hash].push(file);
        if (filesByHash[hash].length > 1) {
          duplicateFiles++;
          savedBandwidth += file.bytes || 0;
        }
      }
    });
    const duplicateGroups = Object.values(filesByHash).filter(group => group.length > 1);
    res.json({
      success: true,
      stats: {
        totalFiles,
        uniqueFiles: Object.keys(filesByHash).length,
        duplicateFiles,
        duplicateGroups: duplicateGroups.length,
        savedBandwidth,
        savedBandwidthMB: (savedBandwidth / (1024 * 1024)).toFixed(2),
        topDuplicates: duplicateGroups
          .sort((a, b) => b.length - a.length)
          .slice(0, 5)
          .map(group => ({
            hash: group[0].tags?.find(tag => tag.length === 32),
            count: group.length,
            firstUpload: group[0].created_at,
            lastUpload: group[group.length - 1].created_at,
            totalSize: group.reduce((sum, file) => sum + (file.bytes || 0), 0)
          }))
      }
    });
  } catch (error) {
    console.error('❌ [DUPLICATE STATS] Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get duplicate statistics' 
    });
  }
};

export const cleanupDuplicates = async (req, res) => {
  try {
    const { dryRun = true } = req.query;
    console.log('🧹 [CLEANUP] Starting duplicate cleanup...', { dryRun });
    const duplicateSearch = await cloudinary.search
      .expression('tags:nexus_chat')
      .with_field('tags')
      .with_field('context')
      .sort_by([['created_at', 'asc']])
      .max_results(500)
      .execute();
    const filesByHash = {};
    duplicateSearch.resources.forEach(file => {
      const hash = file.tags?.find(tag => tag.length === 32);
      if (hash) {
        if (!filesByHash[hash]) {
          filesByHash[hash] = [];
        }
        filesByHash[hash].push(file);
      }
    });
    const duplicateGroups = Object.values(filesByHash).filter(group => group.length > 1);
    let deletedFiles = 0;
    let savedSpace = 0;
    const deletedPublicIds = [];
    for (const group of duplicateGroups) {
      const [keepFile, ...deleteFiles] = group;
      console.log(`📋 [CLEANUP] Hash group: ${keepFile.tags?.find(tag => tag.length === 32)?.substring(0, 8)}... - Keep: ${keepFile.public_id}, Delete: ${deleteFiles.length} files`);
      for (const file of deleteFiles) {
        if (!dryRun) {
          try {
            await cloudinary.uploader.destroy(file.public_id);
            console.log(`🗑️ [CLEANUP] Deleted: ${file.public_id}`);
          } catch (deleteError) {
            console.error(`❌ [CLEANUP] Failed to delete ${file.public_id}:`, deleteError.message);
            continue;
          }
        }
        deletedFiles++;
        savedSpace += file.bytes || 0;
        deletedPublicIds.push(file.public_id);
      }
    }
    res.json({
      success: true,
      cleanup: {
        dryRun,
        duplicateGroups: duplicateGroups.length,
        deletedFiles,
        savedSpace,
        savedSpaceMB: (savedSpace / (1024 * 1024)).toFixed(2),
        deletedPublicIds: dryRun ? deletedPublicIds : deletedPublicIds.slice(0, 10),
        message: dryRun ? 
          `Dry run completed. Would delete ${deletedFiles} duplicate files (${(savedSpace / (1024 * 1024)).toFixed(2)} MB)` :
          `Deleted ${deletedFiles} duplicate files, saved ${(savedSpace / (1024 * 1024)).toFixed(2)} MB`
      }
    });
  } catch (error) {
    console.error('❌ [CLEANUP] Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cleanup duplicates' 
    });
  }
};
