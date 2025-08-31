// /routes/chatRoutes.js
import express from 'express';
import path from 'path';
import { requireAuth, attachUser } from '../middleware/clerkAuth.js';
import { 
  uploadChatFile, 
  uploadFileHandler, 
  handleUploadError 
} from '../middleware/uploadMiddleware.js';
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import {
  createChatSession,
  getUserChatSessions,
  getSessionMessages,
  updateSessionTitle,
  deleteChatSession,
  sendMessage,
  validateFileType,
  getSessionStats,
  getDuplicateStats,
  cleanupDuplicates,
  getSessionContext,
  clearSessionContext 
} from '../controllers/chatController.js';
import { v2 as cloudinary } from 'cloudinary';
import { cacheService } from '../services/cacheService.js';

const router = express.Router();

// ✅ HEALTH CHECK WITHOUT AUTH (for connection testing)
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        backend: 'healthy',
        database: 'healthy'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ APPLY CLERK AUTH MIDDLEWARE TO ALL PROTECTED ROUTES
router.use(requireAuth);
router.use(attachUser);

// ✅ AUTHENTICATED HEALTH CHECK
router.get('/health/auth', async (req, res) => {
  try {
    let aiHealth = { status: 'unknown' };
    let cloudinaryHealth = { status: 'unknown' };
    let cacheHealth = { status: 'unknown', type: 'none' };

    try {
      const { checkAIHealth } = await import('../services/aiService.js');
      aiHealth = await checkAIHealth();
    } catch (error) {
      console.warn('⚠️ AI Service check failed:', error.message);
      aiHealth = { status: 'unavailable', error: error.message };
    }

    try {
      cloudinaryHealth = { status: 'healthy' }; // Simplified check
    } catch (error) {
      console.warn('⚠️ Cloudinary check failed:', error.message);
      cloudinaryHealth = { status: 'unavailable', error: error.message };
    }

    try {
      cacheHealth = await cacheService.isHealthy();
    } catch (error) {
      console.warn('⚠️ Cache check failed:', error.message);
      cacheHealth = { status: 'unavailable', type: 'none', error: error.message };
    }
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role
      },
      services: {
        backend: 'healthy',
        ai: aiHealth.status,
        cloudinary: cloudinaryHealth.status,
        database: 'healthy',
        cache: cacheHealth.status,
        textExtraction: 'available'
      },
      features: {
        fileUpload: cloudinaryHealth.status === 'healthy',
        textExtraction: true,
        deduplication: cloudinaryHealth.status === 'healthy',
        aiProcessing: aiHealth.status === 'healthy',
        redisCaching: cacheHealth.type === 'redis'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ ENHANCED DEBUG MIDDLEWARE
const debugRequest = (req, res, next) => {
  console.log('🔍 [CHAT ROUTES] Request:', {
    method: req.method,
    path: req.path,
    body: req.method === 'POST' ? {
      ...req.body,
      extractedText: req.body.extractedText ? `${req.body.extractedText.length} chars` : undefined
    } : undefined,
    params: req.params,
    query: req.query,
    hasFile: !!req.file,
    hasUser: !!req.user,
    userId: req.user?._id?.toString().substring(0, 8)
  });
  next();
};

// ✅ FILE UPLOAD ENDPOINT
router.post('/upload', 
  uploadChatFile.single('file'),
  uploadFileHandler,
  handleUploadError
);

// ✅ Session management routes
router.post('/session', createChatSession);
router.get('/sessions', getUserChatSessions);

// ✅ Individual session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    console.log('📋 [GET SESSION] Request:', { 
      sessionId: sessionId?.substring(0, 8), 
      userId: userId?.toString().substring(0, 8)
    });

    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - session belongs to different user'
      });
    }

    // Get text extraction statistics
    const messages = await Message.find({ session: sessionId }).lean();
    const textExtractionStats = {
      documentsWithText: messages.filter(m => m.extractedText && !m.extractedText.startsWith('❌')).length,
      totalExtractedChars: messages.reduce((sum, m) => sum + (m.extractedText?.length || 0), 0),
      failedExtractions: messages.filter(m => m.extractedText?.startsWith('❌')).length,
      textExtractableFiles: messages.filter(m => m.type === 'document').length
    };

    res.json({
      _id: session._id,
      user: session.user,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivity: session.lastActivity,
      textExtractionStats
    });

  } catch (error) {
    console.error('❌ [GET SESSION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session',
      error: error.message
    });
  }
});

// ✅ Get messages
router.get('/session/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    const { includeExtractedText = 'false' } = req.query;

    console.log('📨 [GET MESSAGES] Request:', { 
      sessionId: sessionId?.substring(0, 8), 
      userId: userId?.toString().substring(0, 8),
      includeExtractedText
    });

    // Verify session access
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied or session not found' 
      });
    }

    // Fetch messages
    let messages;
    if (includeExtractedText === 'true') {
      messages = await Message.find({ session: sessionId })
        .sort({ createdAt: 1 })
        .lean()
        .exec();
    } else {
      messages = await Message.find({ session: sessionId })
        .select('-extractedText')
        .sort({ createdAt: 1 })
        .lean()
        .exec();
    }

    console.log('✅ [GET MESSAGES] Found:', messages.length, 'messages');

    // Enhanced message data
    const enhancedMessages = messages.map(msg => ({
      ...msg,
      hasFile: !!msg.fileUrl,
      fileType: msg.fileType || null,
      fileName: msg.fileName || null,
      detectedType: msg.fileUrl ? 
        (msg.fileUrl.includes('/image/') || msg.type === 'image' ? 'image' : 'document') : 
        'text',
      hasTextExtraction: msg.hasTextExtraction || false,
      textLength: msg.textLength || 0,
      extractionStatus: msg.extractionStatus || 'not_applicable'
    }));

    // Calculate statistics
    const stats = {
      total: messages.length,
      fileCount: messages.filter(m => m.fileUrl).length,
      imageCount: messages.filter(m => m.type === 'image' || m.fileUrl?.includes('/image/')).length,
      documentCount: messages.filter(m => m.type === 'document').length,
      textExtractionStats: {
        documentsWithText: messages.filter(m => m.hasTextExtraction).length,
        totalExtractedChars: messages.reduce((sum, m) => sum + (m.textLength || 0), 0),
        failedExtractions: messages.filter(m => m.extractedText?.startsWith('❌')).length
      }
    };

    res.json({
      success: true,
      messages: enhancedMessages,
      ...stats,
      includeExtractedText: includeExtractedText === 'true'
    });

  } catch (error) {
    console.error('❌ [GET MESSAGES] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      details: error.message
    });
  }
});

// ✅ Update session title
router.patch('/session/:sessionId', updateSessionTitle);

// ✅ Delete session
router.delete('/session/:sessionId', deleteChatSession);

// ✅ Send message with streaming
router.post('/send', debugRequest, async (req, res) => {
  console.log("📨 [ROUTE] Send message with streaming...");
  
  try {
    await sendMessage(req, res);
  } catch (error) {
    console.error('❌ [ROUTE] Send message error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
        details: error.message
      });
    }
  }
});

// ✅ File validation
router.post('/validate-file', async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    
    const supportedTypes = {
      images: {
        extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'],
        maxSize: 10 * 1024 * 1024, // 10MB
        textExtractable: false
      },
      documents: {
        extensions: ['.pdf', '.docx', '.doc', '.txt'],
        maxSize: 50 * 1024 * 1024, // 50MB
        textExtractable: true
      }
    };
    
    const ext = fileName ? path.extname(fileName).toLowerCase() : '';
    const isImage = supportedTypes.images.extensions.includes(ext);
    const isDocument = supportedTypes.documents.extensions.includes(ext);
    
    let validation = {
      isValid: isImage || isDocument,
      detectedType: isImage ? 'image' : isDocument ? 'document' : 'unknown',
      supportedTypes,
      canExtractText: isDocument && supportedTypes.documents.textExtractable,
      maxSize: isImage ? supportedTypes.images.maxSize : supportedTypes.documents.maxSize,
      maxSizeMB: isImage ? '10MB' : '50MB'
    };

    // Size validation
    if (fileSize) {
      const maxSize = isImage ? supportedTypes.images.maxSize : supportedTypes.documents.maxSize;
      validation.sizeValid = fileSize <= maxSize;
      validation.actualSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      
      if (!validation.sizeValid) {
        validation.isValid = false;
        validation.sizeError = `File size ${validation.actualSizeMB}MB exceeds limit of ${validation.maxSizeMB}`;
      }
    }

    res.json(validation);
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Validation failed',
      details: error.message 
    });
  }
});

// ✅ Session statistics
router.get('/session/:sessionId/stats', getSessionStats);

// ✅ Supported file types
router.get('/supported-types', (req, res) => {
  res.json({
    success: true,
    supportedTypes: {
      images: {
        extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'],
        maxSize: '10MB',
        description: 'Images for visual analysis',
        textExtractable: false
      },
      documents: {
        extensions: ['.pdf', '.docx', '.doc', '.txt'],
        maxSize: '50MB',
        description: 'Documents for text extraction and analysis',
        textExtractable: true
      }
    }
  });
});

// ✅ Duplicate management
router.get('/duplicates/stats', getDuplicateStats);
router.delete('/duplicates/cleanup', cleanupDuplicates);

// ✅ Check duplicate before upload
router.post('/check-duplicate', async (req, res) => {
  try {
    const { fileHash } = req.body;
    
    if (!fileHash) {
      return res.status(400).json({
        success: false,
        error: 'File hash is required'
      });
    }

    console.log('🔍 [CHECK DUPLICATE] Checking for hash:', fileHash.substring(0, 8) + '...');

    try {
      const searchResult = await cloudinary.search
        .expression(`tags=${fileHash}`)
        .max_results(1)
        .execute();
      
      const isDuplicate = searchResult.resources && searchResult.resources.length > 0;
      const existingFile = isDuplicate ? searchResult.resources[0] : null;

      console.log('✅ [CHECK DUPLICATE] Search completed:', {
        isDuplicate,
        existingFileId: existingFile?.public_id
      });

      res.json({
        success: true,
        isDuplicate,
        existingFile: existingFile ? {
          secure_url: existingFile.secure_url,
          public_id: existingFile.public_id,
          created_at: existingFile.created_at
        } : null,
        message: existingFile ? 
          'File already exists - will use existing file' : 
          'File is unique - will upload normally'
      });

    } catch (searchError) {
      console.warn('⚠️ [CHECK DUPLICATE] Search failed, treating as unique:', searchError.message);
      
      res.json({
        success: true,
        isDuplicate: false,
        existingFile: null,
        message: 'Search failed - will upload as unique file'
      });
    }

  } catch (error) {
    console.error('❌ [CHECK DUPLICATE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for duplicates',
      details: error.message
    });
  }
});

// ✅ Session context management
router.get('/session/:sessionId/context', getSessionContext);
router.delete('/session/:sessionId/context', clearSessionContext);

// ✅ Error handling middleware
router.use(handleUploadError);

// ✅ Final error handler
router.use((error, req, res, next) => {
  console.error('❌ [CHAT ROUTES] Unhandled error:', error);
  
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ [CHAT ROUTES] Enhanced chat routes initialized with proper authentication');

export default router;