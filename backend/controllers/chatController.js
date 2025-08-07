// /controllers/chatController.js
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary'; // ✅ Direct import
import { getAIResponse } from '../services/aiService.js';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { cacheService } from '../services/cacheService.js';


// import { extractTextFromFile } from '../utils/textExtraction.js';

// Get __dirname equivalent for ES modules

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ CONFIGURE CLOUDINARY DIRECTLY
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ CREATE MISSING FUNCTIONS LOCALLY
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
    
    // Read file and generate hash
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = generateFileHash(fileBuffer);
    
    console.log('🔍 [DEDUP] File hash generated:', fileHash.substring(0, 8) + '...');
    
    // Check for existing file with same hash (simplified check)
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
    
    // Upload new file with hash tag
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

// 🔹 Create new chat session
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

// 🔹 Get all user chat sessions
export const getUserChatSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

// 🔹 Get messages in a session
export const getSessionMessages = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const messages = await Message.find({ session: sessionId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving messages' });
  }
};

// 🔹 Update session title
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

// 🔹 Delete chat session
export const deleteChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

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

// 🔹 Enhanced Upload file handler with deduplication AND text extraction
// 🔹 Enhanced Upload file handler - REDESIGNED AND SIMPLIFIED
export const uploadFileHandler = async (req, res) => {
  console.log('📤 [UPLOAD] Starting file upload process...');
  
  try {
    // ✅ VALIDATE FILE EXISTS
    if (!req.file) {
      console.error('❌ [UPLOAD] No file provided in request');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    console.log('📋 [UPLOAD] File received:', {
      originalName: req.file.originalname,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // ✅ DETECT FILE TYPE
    const getFileType = (mimetype, filename) => {
      const ext = path.extname(filename).toLowerCase();
      console.log('🔍 [UPLOAD] Analyzing file type:', { ext, mimetype });
      
      if (mimetype.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
        return 'image';
      }
      if (mimetype.includes('pdf') || ext === '.pdf') return 'document';
      if (['.docx', '.doc', '.txt'].includes(ext)) return 'document';
      
      return 'document'; // Default fallback
    };

    const fileType = getFileType(req.file.mimetype, req.file.originalname);
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    console.log('✅ [UPLOAD] File type detected:', { fileType, fileExtension });

    // ✅ READ FILE BUFFER FOR PROCESSING
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = generateFileHash(fileBuffer);
    
    console.log('🔐 [UPLOAD] File hash generated:', fileHash.substring(0, 12) + '...');

    let uploadResult;
    let extractedText = null;

    // ✅ UPLOAD TO CLOUDINARY
    try {
      console.log('☁️ [UPLOAD] Uploading to Cloudinary...');
      
      uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'nexus_chat_files',
        resource_type: fileType === 'image' ? 'image' : 'raw',
        use_filename: true,
        unique_filename: true,
        access_mode: 'public',
        tags: ['nexus_chat', fileHash],
        timeout: 60000
      });

      console.log('✅ [UPLOAD] Cloudinary upload successful:', {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url,
        bytes: uploadResult.bytes
      });

    } catch (uploadError) {
      console.error('❌ [UPLOAD] Cloudinary upload failed:', uploadError.message);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // ✅ EXTRACT TEXT FROM DOCUMENTS
    if (fileType === 'document') {
      console.log('📄 [EXTRACTION] Starting text extraction for document...');
      
      try {
        if (fileExtension === '.pdf') {
          console.log('📄 [PDF] Processing PDF file...');
          
          try {
            // ✅ IMPORT AND USE THE CLEAN PDF PARSER
            const { parsePdf } = await import('../utils/pdfParser.js');
            const pdfBuffer = fs.readFileSync(req.file.path);
            
            console.log('📄 [PDF] Using clean PDF parser...');
            extractedText = await parsePdf(pdfBuffer);
            
            if (extractedText && extractedText.length > 50 && !extractedText.includes('extraction failed')) {
              console.log('✅ [PDF] Clean PDF parser extraction successful:', {
                textLength: extractedText.length,
                preview: extractedText.substring(0, 300) + '...',
                firstWords: extractedText.split(' ').slice(0, 15).join(' ')
              });
            } else {
              console.log('⚠️ [PDF] PDF appears to be image-based or extraction failed');
              extractedText = '⚠️ PDF appears to be image-based or contains no readable text.';
            }
            
          } catch (pdfError) {
            console.error('❌ [PDF] Clean PDF parser failed:', pdfError.message);
            extractedText = `❌ PDF text extraction failed: ${pdfError.message}`;
          }
          
        } else if (fileExtension === '.txt') {
          console.log('📄 [TXT] Extracting text from TXT file...');
          
          try {
            extractedText = fs.readFileSync(req.file.path, 'utf-8').trim();
            
            console.log('✅ [TXT] Text extraction successful:', {
              characters: extractedText.length,
              preview: extractedText.substring(0, 200) + '...'
            });
          } catch (txtError) {
            console.error('❌ [TXT] Text extraction failed:', txtError.message);
            extractedText = `❌ TXT extraction failed: ${txtError.message}`;
          }
          
        } else {
          console.log('⚠️ [EXTRACTION] Unsupported document type:', fileExtension);
          extractedText = `❌ Text extraction not supported for ${fileExtension} files`;
        }
        
      } catch (extractError) {
        console.error('❌ [EXTRACTION] Text extraction failed:', extractError.message);
        extractedText = `❌ Text extraction failed: ${extractError.message}`;
      }
    } else {
      console.log('ℹ️ [EXTRACTION] Skipping text extraction for non-document file');
      extractedText = null;
    }

    // ✅ CLEANUP TEMPORARY FILE
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 [CLEANUP] Temporary file removed:', req.file.path);
      }
    } catch (cleanupError) {
      console.warn('⚠️ [CLEANUP] Failed to remove temp file:', cleanupError.message);
    }

    // ✅ PREPARE RESPONSE AND STORE IN REDIS
    const hasValidText = extractedText && !extractedText.startsWith('❌');
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const cacheData = {
      extractedText: hasValidText ? extractedText : null,
      fileUrl: uploadResult.secure_url,
      fileName: req.file.originalname,
      fileType,
      timestamp: new Date().toISOString(),
      hasValidText
    };

    // ✅ STORE IN REDIS CACHE (20 minutes TTL)
    await cacheService.storeExtractedText(uploadId, cacheData);

    // ✅ AUTO-TRIGGER AI ANALYSIS IF TEXT WAS EXTRACTED
    let aiAnalysis = null;
    if (hasValidText) {
      console.log('🤖 [UPLOAD] Text extracted successfully, triggering immediate AI analysis...');
      console.log('📄 [UPLOAD] Extracted text ready for direct processing:', {
        textLength: extractedText.length,
        textPreview: extractedText.substring(0, 200) + '...',
        fileName: req.file.originalname
      });
      
      try {
        // ✅ CREATE OR GET SESSION
        let sessionId = req.body.sessionId;
        const userId = req.user._id;
        
        if (!sessionId) {
          console.log('📝 [UPLOAD] Creating new session for direct analysis...');
          const newSession = new ChatSession({
            user: userId,
            title: `Analysis: ${req.file.originalname}`,
            createdAt: new Date()
          });
          const savedSession = await newSession.save();
          sessionId = savedSession._id;
          console.log('✅ [UPLOAD] New session created:', sessionId);
        }

        // ✅ CREATE USER MESSAGE
        console.log('💾 [UPLOAD] Creating user message for direct analysis...');
        const userMessage = new Message({
          session: sessionId,
          sender: userId,
          message: `📄 Uploaded and analyzing: ${req.file.originalname}`,
          type: 'document',
          fileUrl: uploadResult.secure_url,
          fileType: fileType,
          fileName: req.file.originalname
        });

        await userMessage.save();
        console.log('✅ [UPLOAD] User message saved:', userMessage._id);

        // ✅ CALL AI SERVICE DIRECTLY WITH EXTRACTED TEXT
        console.log('🤖 [UPLOAD] Calling AI service directly with extracted text...');
        console.log('🔍 [UPLOAD] Passing to AI service:', {
          messageLength: 47, // "Please analyze this document: filename.pdf"
          extractedTextLength: extractedText.length, // ✅ YOUR 4069 CHARACTERS
          extractedTextType: typeof extractedText,
          directPass: true,
          noRedisLookup: true
        });

        const analysisPrompt = `Please analyze this document comprehensively:

Document: ${req.file.originalname}
Type: ${fileType}

Please provide:
1. Document overview and purpose
2. Key topics and main points  
3. Important details or findings
4. Notable sections or highlights
5. Summary of content

Document content to analyze:`;

        // ✅ DIRECT AI SERVICE CALL - NO REDIS INVOLVED
        const aiResponse = await getAIResponse({
          message: analysisPrompt,
          extractedText: extractedText, // ✅ PASS DIRECTLY - 4069 CHARACTERS
          type: 'document',
          fileUrl: uploadResult.secure_url,
          fileType: fileType,
          fileName: req.file.originalname,
          sessionId: sessionId,
          conversationContext: []
        });

        console.log('✅ [UPLOAD] Direct AI analysis completed:', {
          aiResponseLength: aiResponse?.length || 0,
          aiResponsePreview: aiResponse ? aiResponse.substring(0, 200) + '...' : null,
          processingMethod: 'direct_extraction'
        });

        // ✅ CREATE AI MESSAGE
        console.log('💾 [UPLOAD] Saving AI analysis to database...');
        const aiMessage = new Message({
          session: sessionId,
          sender: 'AI',
          message: aiResponse || 'Unable to analyze document at this time.',
          type: 'document',
          completedBy: 'Llama3 + Direct Text Extraction',
          metadata: {
            autoGenerated: true,
            usedDirectExtraction: true,
            extractedTextLength: extractedText.length,
            analysisType: 'immediate_document_analysis',
            processingTime: new Date().toISOString()
          }
        });

        await aiMessage.save();
        console.log('✅ [UPLOAD] AI analysis saved:', aiMessage._id);

        // ✅ PREPARE ANALYSIS RESULTS
        aiAnalysis = {
          success: true,
          method: 'direct_extraction',
          sessionId: sessionId,
          userMessage: {
            _id: userMessage._id,
            message: userMessage.message,
            timestamp: userMessage.createdAt
          },
          aiMessage: {
            _id: aiMessage._id,
            message: aiMessage.message,
            timestamp: aiMessage.createdAt,
            completedBy: aiMessage.completedBy,
            extractedTextLength: extractedText.length
          }
        };

      } catch (aiError) {
        console.error('❌ [UPLOAD] Direct AI analysis failed:', {
          error: aiError.message,
          stack: aiError.stack,
          extractedTextLength: extractedText?.length || 0
        });
        
        aiAnalysis = {
          success: false,
          method: 'direct_extraction',
          error: 'AI analysis failed',
          details: aiError.message,
          extractedTextLength: extractedText?.length || 0
        };
      }
    }

    const response = {
      success: true,
      message: hasValidText ? 
        'File uploaded, text extracted, and AI analysis completed' : 
        'File uploaded successfully',
      fileUrl: uploadResult.secure_url,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
      extractedText: null, // ✅ DON'T SEND FULL TEXT TO FRONTEND
      hasExtractedText: hasValidText,
      textLength: extractedText?.length || 0,
      uploadId: uploadId,
      timestamp: new Date().toISOString(),
      cached: true,
      cacheTTL: '20 minutes',
      // ✅ INCLUDE AI ANALYSIS RESULTS
      aiAnalysis: aiAnalysis,
      autoAnalyzed: !!aiAnalysis && !aiAnalysis.error
    };

    console.log('✅ [UPLOAD] Upload process completed with auto AI analysis:', {
      fileName: req.file.originalname,
      fileType,
      hasExtractedText: hasValidText,
      textLength: extractedText?.length || 0,
      uploadId: uploadId.substring(0, 12) + '...',
      cached: true,
      autoAnalyzed: response.autoAnalyzed,
      sessionId: aiAnalysis?.sessionId ? aiAnalysis.sessionId.toString().substring(0, 8) + '...' : null
    });

    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ [UPLOAD] Upload process failed:', error.message);
    console.error('❌ [UPLOAD] Error stack:', error.stack);
    
    // ✅ CLEANUP ON ERROR
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🧹 [CLEANUP] Temporary file removed after error');
      } catch (cleanupError) {
        console.warn('⚠️ [CLEANUP] Failed to cleanup after error:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'File upload and processing failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// 🔹 Stream AI response over HTTP with full context support - ENHANCED WITH TEXT EXTRACTION
export const sendMessage = async (req, res) => {
  console.log('🚨 [DEBUG] sendMessage function TRIGGERED!');
  console.log('🚨 [DEBUG] Request method:', req.method);
  console.log('🚨 [DEBUG] Request URL:', req.url);
  console.log('🚨 [DEBUG] Request body exists:', !!req.body);
  
  console.log('🚀 [SEND MESSAGE] ==================== STARTING SEND MESSAGE ====================');
  console.log('📥 [SEND MESSAGE] Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('📥 [SEND MESSAGE] Request headers:', req.headers);
  
  try {
    const { sessionId, message, type, fileUrl, fileType, fileName } = req.body;
    // ✅ REMOVED: uploadId logic since we're doing direct analysis
    
    const userId = req.user._id;

    // ✅ VALIDATE REQUIRED FIELDS
    if (!sessionId || !message) {
      console.error('❌ [SEND MESSAGE] Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Session ID and message are required'
      });
    }

    // ✅ VERIFY SESSION EXISTS AND USER HAS ACCESS
    console.log('🔍 [SEND MESSAGE] Checking session access...');
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      console.error('❌ [SEND MESSAGE] Session access denied:', {
        sessionFound: !!session,
        sessionUser: session?.user?.toString(),
        requestUser: userId.toString()
      });
      return res.status(403).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }
    console.log('✅ [SEND MESSAGE] Session access verified');

    // ✅ CREATE USER MESSAGE (No extracted text lookup needed)
    console.log('💾 [SEND MESSAGE] Creating user message in database...');
    const userMessage = new Message({
      session: sessionId,
      sender: userId,
      message,
      type: type || 'text',
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null
    });

    await userMessage.save();
    console.log('✅ [SEND MESSAGE] User message saved:', userMessage._id);

    // ✅ CALL AI SERVICE (No extracted text - for regular chat)
    console.log('🤖 [SEND MESSAGE] Calling AI service for regular chat...');
    const aiResponse = await getAIResponse({
      message,
      extractedText: null, // ✅ No extracted text for regular messages
      type: type || 'text',
      fileUrl,
      fileType,
      fileName,
      sessionId
    });

    // ✅ CREATE AI MESSAGE IN DATABASE
    console.log('💾 [SEND MESSAGE] Creating AI message in database...');
    const aiMessage = new Message({
      session: sessionId,
      sender: 'AI',
      message: aiResponse || 'No response generated',
      type: type || 'text',
      completedBy: type === 'image' ? 'BLIP' : type === 'document' ? 'Llama3 + Document Processing' : 'Llama3',
      metadata: {
        usedExtractedText: false, // ✅ FIXED: Set to false since no extracted text in sendMessage
        extractedTextLength: 0    // ✅ FIXED: Set to 0 since no extracted text
      }
    });

    await aiMessage.save();
    console.log('✅ [SEND MESSAGE] AI message saved to database:', aiMessage._id);

    // ✅ UPDATE SESSION ACTIVITY
    session.lastActivity = new Date();
    await session.save();
    console.log('✅ [SEND MESSAGE] Session activity updated');

    // ✅ RETURN SUCCESS RESPONSE
    const responseData = {
      success: true,
      userMessage: {
        _id: userMessage._id,
        message: userMessage.message,
        sender: 'user',
        timestamp: userMessage.createdAt,
        type: userMessage.type,
        fileUrl: userMessage.fileUrl,
        fileType: userMessage.fileType,
        fileName: userMessage.fileName,
        hasTextExtraction: userMessage.hasTextExtraction,
        extractedTextLength: userMessage.textLength
      },
      aiMessage: {
        _id: aiMessage._id,
        message: aiMessage.message,
        sender: 'AI',
        timestamp: aiMessage.createdAt,
        type: aiMessage.type,
        completedBy: aiMessage.completedBy
      }
    };

    console.log('✅ [SEND MESSAGE] Response ready:', {
      success: true,
      userMessageId: responseData.userMessage._id,
      aiMessageId: responseData.aiMessage._id,
      aiResponseLength: responseData.aiMessage.message.length
    });
    console.log('🏁 [SEND MESSAGE] ==================== SEND MESSAGE COMPLETED ====================');

    res.json(responseData);

  } catch (error) {
    console.error('❌ [SEND MESSAGE] ==================== ERROR OCCURRED ====================');
    console.error('❌ [SEND MESSAGE] Error name:', error.name);
    console.error('❌ [SEND MESSAGE] Error message:', error.message);
    console.error('❌ [SEND MESSAGE] Error stack:', error.stack);
    console.error('❌ [SEND MESSAGE] Request body that caused error:', JSON.stringify(req.body, null, 2));
    
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// ✅ NEW: Get file type validation
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

// ✅ NEW: Get session statistics
export const getSessionStats = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const messages = await Message.find({ session: sessionId }).lean();
    
    const stats = {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.sender !== 'AI').length,
      aiMessages: messages.filter(m => m.sender === 'AI').length,
      imageMessages: messages.filter(m => m.type === 'image').length,
      documentMessages: messages.filter(m => m.type === 'document').length,
      filesUploaded: messages.filter(m => m.fileUrl).length,
      // ✅ NEW: Text extraction stats
      documentsWithText: messages.filter(m => m.extractedText && !m.extractedText.startsWith('❌')).length,
      totalExtractedChars: messages.reduce((sum, m) => sum + (m.extractedText?.length || 0), 0)
    };
    
    res.json(stats);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session stats' });
  }
};

// ✅ NEW: Get duplicate files statistics
export const getDuplicateStats = async (req, res) => {
  try {
    // Get all files with duplicate tags
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
      const hash = file.tags?.find(tag => tag.length === 32); // MD5 hash length
      
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

// ✅ NEW: Clean up duplicate files (keep only the first one)
export const cleanupDuplicates = async (req, res) => {
  try {
    const { dryRun = true } = req.query; // Default to dry run for safety
    
    console.log('🧹 [CLEANUP] Starting duplicate cleanup...', { dryRun });
    
    const duplicateSearch = await cloudinary.search
      .expression('tags:nexus_chat')
      .with_field('tags')
      .with_field('context')
      .sort_by([['created_at', 'asc']])
      .max_results(500)
      .execute();

    const filesByHash = {};
    
    // Group files by hash
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
      // Keep the first file (oldest), delete the rest
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
        deletedPublicIds: dryRun ? deletedPublicIds : deletedPublicIds.slice(0, 10), // Limit output in actual run
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
