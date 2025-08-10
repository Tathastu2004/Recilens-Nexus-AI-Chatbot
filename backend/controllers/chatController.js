// /controllers/chatController.js
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

export const uploadFileHandler = async (req, res) => {
  console.log('📤 [UPLOAD] Starting file upload and text extraction...');
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    console.log('📋 [UPLOAD] File received:', req.file.originalname);

    let uploadResult;
    let extractedText = null;

    // --- Cloudinary Upload ---
    uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'nexus_chat_files',
      resource_type: 'raw',
      use_filename: true,
      unique_filename: true,
      access_mode: 'public',
    });

    // --- Text Extraction ---
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (fileExtension === '.pdf' || fileExtension === '.txt') {
      const fileBuffer = fs.readFileSync(req.file.path);
      if (fileExtension === '.pdf') {
        try {
          const { parsePdf } = await import('../utils/pdfParser.js');
          extractedText = await parsePdf(fileBuffer);
        } catch (pdfError) {
          extractedText = `❌ PDF text extraction failed: ${pdfError.message}`;
        }
      } else {
        extractedText = fileBuffer.toString('utf8').trim();
      }
      if (extractedText && !extractedText.startsWith('❌')) {
        console.log(`✅ [EXTRACTION] Text successfully extracted from ${req.file.originalname}. Length: ${extractedText.length} characters.`);
      }
    }

    const hasValidText = extractedText && !extractedText.startsWith('❌');
    res.status(200).json({
      success: true,
      message: 'File processed successfully. Ready for user prompt.',
      fileUrl: uploadResult.secure_url,
      fileName: req.file.originalname,
      extractedText: extractedText,
      hasText: hasValidText,
      textLength: hasValidText ? extractedText.length : 0,
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

// 🔹 Stream AI response over HTTP with full context support - ENHANCED WITH TEXT EXTRACTION
export const sendMessage = async (req, res) => {
  console.log('📨 [SEND MESSAGE] Request received...');
  try {
    const { sessionId, message, type = 'text', fileUrl, fileType, fileName, extractedText } = req.body;
    const userId = req.user._id;

    if (!sessionId || !message) {
      return res.status(400).json({ success: false, error: 'Session ID and message are required' });
    }
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied or session not found' });
    }

    // --- Save User's Message ---
    const userMessage = new Message({
      session: sessionId,
      message,
      sender: userId,
      type,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      extractedText: extractedText || null,
      hasTextExtraction: !!(extractedText && !extractedText.startsWith('❌')),
      textLength: extractedText ? extractedText.length : 0,
    });
    await userMessage.save();
    console.log('✅ User message saved.');

    // --- Get AI Response ---
    console.log('🤖 Calling AI service with user prompt and extracted text...');
    // ✅ Always pass all relevant fields to AI service
    const aiResponse = await getAIResponse({
      message,
      extractedText,
      type,
      fileUrl,
      fileType,
      fileName,
      sessionId,
    });
    console.log('✅ AI response received.');

    // --- Save AI's Message ---
    const aiMessage = new Message({
      session: sessionId,
      message: typeof aiResponse === 'string' ? aiResponse : aiResponse.message,
      sender: 'AI',
      type: type || 'text',
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      extractedText: extractedText || null,
      hasTextExtraction: !!(extractedText && !extractedText.startsWith('❌')),
      textLength: extractedText ? extractedText.length : 0,
      metadata: {
        usedExtractedText: !!(extractedText && !extractedText.startsWith('❌')),
      }
    });
    await aiMessage.save();
    console.log('✅ AI message saved.');

    // --- Update Session and Send Response ---
    session.lastActivity = new Date();
    await session.save();

    res.status(200).json({
      success: true,
      aiMessage: aiMessage,
    });

  } catch (error) {
    console.error('❌ [SEND MESSAGE] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message', details: error.message });
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

// ✅ NEW: Clean up duplicate files (keep only the first one)
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
