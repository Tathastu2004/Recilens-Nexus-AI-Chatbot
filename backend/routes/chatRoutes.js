// /routes/chatRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { 
  uploadChatFile,  // ✅ Keep multer middleware for file parsing
  handleUploadError // ✅ Keep error handler
} from '../middleware/uploadMiddleware.js';
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import { getAIResponse } from '../services/aiService.js';
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
  uploadFileHandler, // ✅ IMPORT FROM CONTROLLER, NOT MIDDLEWARE
   getSessionContext,      // ✅ NEW
  clearSessionContext 
} from '../controllers/chatController.js';
import { v2 as cloudinary } from 'cloudinary';
import { cacheService } from '../services/cacheService.js';

const router = express.Router();

// ✅ ENHANCED DEBUG MIDDLEWARE WITH TEXT EXTRACTION LOGGING
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
    supportsTextExtraction: req.supportsTextExtraction
  });
  next();
};

// 🔹 Start a new chat session
router.post('/session', verifyToken, debugRequest, createChatSession);

// 🔹 Get all sessions for current user
router.get('/sessions', verifyToken, getUserChatSessions);

// 🔹 Get individual session metadata with text extraction stats
router.get('/session/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    console.log('📋 [GET SESSION] Request:', { sessionId: sessionId?.substring(0, 8), userId });

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

    // ✅ GET TEXT EXTRACTION STATISTICS FOR SESSION
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

// 🔹 Get messages of a session with enhanced text extraction info
router.get('/session/:sessionId/messages', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;
    const { includeExtractedText = 'false' } = req.query;

    console.log('📨 [GET MESSAGES] Request:', { 
      sessionId: sessionId?.substring(0, 8), 
      userId: userId?.toString().substring(0, 8),
      includeExtractedText
    });

    // ✅ VERIFY SESSION EXISTS AND USER HAS ACCESS
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied or session not found' 
      });
    }

    // ✅ FETCH MESSAGES FROM DATABASE WITH OPTIONAL TEXT EXTRACTION
    let messages;
    if (includeExtractedText === 'true') {
      // Include full extracted text
      messages = await Message.find({ session: sessionId })
        .sort({ createdAt: 1 })
        .lean()
        .exec();
    } else {
      // Exclude extracted text for performance, just include preview
      messages = await Message.find({ session: sessionId })
        .select('-extractedText') // Exclude large extracted text field
        .sort({ createdAt: 1 })
        .lean()
        .exec();
    }

    console.log('✅ [GET MESSAGES] Found:', messages.length, 'messages');

    // ✅ ENHANCED MESSAGE DATA WITH TEXT EXTRACTION INFO
    const enhancedMessages = messages.map(msg => ({
      ...msg,
      hasFile: !!msg.fileUrl,
      fileType: msg.fileType || null,
      fileName: msg.fileName || null,
      detectedType: msg.fileUrl ? 
        (msg.fileUrl.includes('/image/') || msg.type === 'image' ? 'image' : 'document') : 
        'text',
      // ✅ TEXT EXTRACTION METADATA
      hasTextExtraction: msg.hasTextExtraction || false,
      textLength: msg.textLength || 0,
      extractionStatus: msg.extractionStatus || 'not_applicable',
      extractedTextPreview: msg.extractedText && !msg.extractedText.startsWith('❌') ? 
        msg.extractedText.substring(0, 200) + '...' : null,
      extractionMethod: msg.metadata?.extractionMethod || null
    }));

    // ✅ CALCULATE ENHANCED STATISTICS
    const stats = {
      total: messages.length,
      fileCount: messages.filter(m => m.fileUrl).length,
      imageCount: messages.filter(m => m.type === 'image' || m.fileUrl?.includes('/image/')).length,
      documentCount: messages.filter(m => m.type === 'document').length,
      textExtractionStats: {
        documentsWithText: messages.filter(m => m.hasTextExtraction).length,
        totalExtractedChars: messages.reduce((sum, m) => sum + (m.textLength || 0), 0),
        failedExtractions: messages.filter(m => m.extractedText?.startsWith('❌')).length,
        averageTextLength: messages.filter(m => m.hasTextExtraction).length > 0 ?
          Math.round(messages.reduce((sum, m) => sum + (m.textLength || 0), 0) / 
                    messages.filter(m => m.hasTextExtraction).length) : 0
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

// 🔹 Update session title
router.patch('/session/:sessionId', verifyToken, updateSessionTitle);

// 🔹 Delete chat session
router.delete('/session/:sessionId', verifyToken, deleteChatSession);

// 🔹 Enhanced send message endpoint using the updated sendMessage controller
router.post('/send', verifyToken, debugRequest, async (req, res) => {
  console.log("📨 [ROUTE] Send message with streaming...");
  
  try {
    // Call the updated controller function which now handles streaming
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

// 🔹 ✅ FIXED: Upload file using CONTROLLER handler, not middleware handler
router.post(
  '/upload',
  verifyToken,
  uploadChatFile.single('file'), // ✅ Keep multer middleware for file parsing
  uploadFileHandler,             // ✅ NOW USES CONTROLLER HANDLER (with pdfjs-dist)
  handleUploadError              // ✅ Keep error handling
);

// ✅ Enhanced file validation with text extraction capabilities
router.post('/validate-file', verifyToken, async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    
    const supportedTypes = {
      images: {
        extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'],
        maxSize: 10 * 1024 * 1024, // 10MB
        textExtractable: false,
        ocrCapable: ['.png', '.jpg', '.jpeg'] // For future OCR support
      },
      documents: {
        extensions: ['.pdf', '.docx', '.doc', '.txt'],
        maxSize: 50 * 1024 * 1024, // 50MB
        textExtractable: true,
        extractionMethods: {
          '.pdf': 'pdfjs-dist',
          '.docx': 'mammoth',
          '.txt': 'utf8-decode',
          '.doc': 'limited-support'
        }
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
      extractionMethod: isDocument ? supportedTypes.documents.extractionMethods[ext] : null,
      ocrCapable: isImage && supportedTypes.images.ocrCapable.includes(ext),
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

    // Processing time estimation
    if (isDocument && fileSize) {
      const sizeMB = fileSize / (1024 * 1024);
      let estimatedTime = '< 1 second';
      
      switch (ext) {
        case '.pdf':
          estimatedTime = `~${Math.ceil(sizeMB * 2)} seconds`;
          break;
        case '.docx':
          estimatedTime = `~${Math.ceil(sizeMB * 1.5)} seconds`;
          break;
        case '.txt':
          estimatedTime = '< 1 second';
          break;
        default:
          estimatedTime = `~${Math.ceil(sizeMB * 0.5)} seconds`;
      }
      
      validation.estimatedProcessingTime = estimatedTime;
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

// ✅ Get session statistics with text extraction metrics
router.get('/session/:sessionId/stats', verifyToken, getSessionStats);


router.get('/debug/upload-cache', verifyToken, (req, res) => {
  res.json({
    success: true,
    cache: {
      available: !!global.uploadCache,
      keys: Object.keys(global.uploadCache || {}),
      entries: Object.entries(global.uploadCache || {}).map(([id, data]) => ({
        id,
        fileName: data.fileName,
        hasText: !!data.extractedText,
        textLength: data.extractedText?.length || 0,
        textPreview: data.extractedText ? data.extractedText.substring(0, 100) + '...' : null,
        timestamp: data.timestamp
      }))
    },
    timestamp: new Date().toISOString()
  });
});


// ✅ Get supported file types with text extraction info
router.get('/supported-types', (req, res) => {
  res.json({
    success: true,
    supportedTypes: {
      images: {
        extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'],
        maxSize: '10MB',
        description: 'Images for visual analysis',
        textExtractable: false,
        ocrCapable: ['.png', '.jpg', '.jpeg'] // Future OCR support
      },
      documents: {
        extensions: ['.pdf', '.docx', '.doc', '.txt'],
        maxSize: '50MB',
        description: 'Documents for text extraction and analysis',
        textExtractable: true,
        extractionMethods: {
          '.pdf': 'pdfjs-dist (Mozilla PDF.js)',
          '.docx': 'mammoth',
          '.txt': 'utf8-decode',
          '.doc': 'limited support'
        }
      }
    },
    processingInfo: {
      images: 'Processed by vision model for visual analysis',
      documents: 'Text extracted in backend, then processed by AI model',
      textExtraction: 'Performed server-side before AI processing',
      deduplication: 'Files are deduplicated using MD5 hashing'
    },
    textExtractionFeatures: {
      pdfExtraction: 'Full text extraction from PDF files using pdfjs-dist',
      docxExtraction: 'Complete text and formatting from DOCX files',
      txtSupport: 'Direct UTF-8 text file reading',
      fallbackMethods: 'Multiple extraction approaches for reliability',
      preprocessedText: 'Text is pre-processed before AI analysis'
    }
  });
});

// ✅ Health check for AI services with text extraction status
router.get('/health', async (req, res) => {
  try {
    const { checkAIHealth } = await import('../services/aiService.js');
    const { checkCloudinaryHealth } = await import('../config/cloudinary.js');
    
    const [aiHealth, cloudinaryHealth, cacheHealth] = await Promise.all([
      checkAIHealth(),
      checkCloudinaryHealth(),
      cacheService.isHealthy() // ✅ ADD REDIS HEALTH CHECK
    ]);
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        backend: 'healthy',
        ai: aiHealth.status,
        cloudinary: cloudinaryHealth.status,
        database: 'healthy',
        cache: cacheHealth.status, // ✅ REDIS STATUS
        textExtraction: 'available (pdfjs-dist + redis cache)'
      },
      cacheDetails: {
        type: cacheHealth.type,
        status: cacheHealth.status,
        ttl: '20 minutes',
        fallback: cacheHealth.type === 'memory_fallback' ? 'Active' : 'Available'
      },
      features: {
        fileUpload: cloudinaryHealth.status === 'healthy',
        textExtraction: true,
        deduplication: cloudinaryHealth.status === 'healthy',
        aiProcessing: aiHealth.status === 'healthy',
        redisCaching: cacheHealth.type === 'redis'
      },
      aiDetails: aiHealth,
      cloudinaryDetails: cloudinaryHealth
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

// ✅ Get duplicate file statistics
router.get('/duplicates/stats', verifyToken, getDuplicateStats);

// ✅ Cleanup duplicate files
router.delete('/duplicates/cleanup', verifyToken, cleanupDuplicates);

// ✅ Check if file is duplicate before upload
router.post('/check-duplicate', verifyToken, async (req, res) => {
  try {
    const { fileHash } = req.body;
    
    if (!fileHash) {
      return res.status(400).json({
        success: false,
        error: 'File hash is required'
      });
    }

    console.log('🔍 [CHECK DUPLICATE] Checking for hash:', fileHash.substring(0, 8) + '...');

    // ✅ SIMPLE CLOUDINARY SEARCH FOR DUPLICATES
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
      
      // If search fails, treat as unique file
      res.json({
        success: true,
        isDuplicate: false,
        existingFile: null,
        message: 'Search failed - will upload as unique file',
        searchError: searchError.message
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

// ✅ Get extracted text from a specific message
router.get('/message/:messageId/text', verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    
    const message = await Message.findById(messageId)
      .populate('session', 'user')
      .lean();
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    if (message.session.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      messageId,
      hasExtractedText: !!message.extractedText,
      extractedText: message.extractedText || null,
      textLength: message.textLength || 0,
      extractionStatus: message.extractionStatus || 'not_applicable',
      extractionMethod: message.metadata?.extractionMethod || null,
      fileName: message.fileName || null,
      fileType: message.fileType || null
    });
    
  } catch (error) {
    console.error('❌ [GET EXTRACTED TEXT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get extracted text',
      details: error.message
    });
  }
});

// ✅ ENHANCED ERROR HANDLING MIDDLEWARE
router.use(handleUploadError);

// ✅ FALLBACK ERROR HANDLER
router.use((error, req, res, next) => {
  console.error('❌ [CHAT ROUTES] Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ✅ ADD DEBUG ROUTE FOR REDIS CACHE:
router.get('/debug/cache-status', verifyToken, async (req, res) => {
  try {
    const cacheHealth = await cacheService.isHealthy();
    
    res.json({
      success: true,
      cache: {
        status: cacheHealth.status,
        type: cacheHealth.type,
        isRedisConnected: cacheHealth.type === 'redis',
        ttl: '20 minutes (1200 seconds)',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.get('/session/:sessionId/context', verifyToken, getSessionContext);
router.delete('/session/:sessionId/context', verifyToken, clearSessionContext);



console.log('✅ [CHAT ROUTES] Enhanced chat routes initialized with controller-based text extraction');
console.log('🔧 [CHAT ROUTES] Features: file upload, pdfjs-dist text extraction, deduplication, streaming AI responses');

export default router;