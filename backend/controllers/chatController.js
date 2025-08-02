// /controllers/chatController.js
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import path from 'path';
import fs from 'fs';
import { cloudinary } from '../config/cloudinary.js';
import { getAIResponse } from '../services/aiService.js';

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

// 🔹 Upload file (image or doc) to Cloudinary
export const uploadFileHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'nexus_chat_files',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      timeout: 30000
    });
    fs.unlinkSync(req.file.path);
    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl: result.secure_url,
      publicId: result.public_id,
      type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: 'Error uploading file', error: error.message });
  }
};

// 🔹 Stream AI response over HTTP with JSON fallback
export const sendMessage = async (req, res) => {
  const { sessionId, message, type = 'text', fileUrl, fileType, metadata, tempId } = req.body;
  const senderId = req.user._id;

  console.log('📨 [SEND MESSAGE] Request received:', {
    sessionId,
    senderId,
    messageLength: message?.length,
    type,
    hasFile: !!fileUrl,
    tempId
  });

  if (!sessionId || !message) {
    return res.status(400).json({ success: false, message: 'Session ID and message are required' });
  }

  try {
    // ✅ VERIFY SESSION EXISTS AND USER HAS ACCESS
    const session = await ChatSession.findOne({ _id: sessionId, user: senderId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found or unauthorized' });
    }

    // ✅ SAVE USER MESSAGE
    const userMsg = new Message({
      session: sessionId,
      sender: senderId,
      message,
      type,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      metadata: metadata || {},
      timestamp: new Date()
    });
    const savedUserMsg = await userMsg.save();
    
    // ✅ UPDATE SESSION ACTIVITY
    await ChatSession.findByIdAndUpdate(sessionId, { lastActivity: new Date() });

    console.log('✅ [SEND MESSAGE] User message saved:', savedUserMsg._id);

    // ✅ CHECK IF CLIENT ACCEPTS STREAMING
    const acceptHeader = req.headers.accept || '';
    const supportsStreaming = acceptHeader.includes('text/plain') || acceptHeader.includes('text/event-stream');

    if (supportsStreaming) {
      // ✅ STREAMING RESPONSE
      console.log('🌊 [STREAMING] Starting streaming response...');
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        // ✅ GET AI RESPONSE AND STREAM IT
        const aiText = await getAIResponse({ message, fileUrl, fileType });
        
        // ✅ SAVE AI MESSAGE
        const aiMsg = new Message({
          session: sessionId,
          sender: 'AI',
          message: aiText,
          type: 'text',
          metadata: { 
            responseType: 'stream', 
            userMessageId: savedUserMsg._id,
            streamedAt: new Date().toISOString()
          },
          timestamp: new Date()
        });
        await aiMsg.save();

        console.log('✅ [STREAMING] AI message saved and streaming:', aiMsg._id);

        // ✅ STREAM THE COMPLETE RESPONSE
        res.write(aiText);
        res.end();
        
      } catch (aiError) {
        console.error('❌ [STREAMING] AI Error:', aiError);
        res.write('I apologize, but I encountered an error while processing your request. Please try again.');
        res.end();
      }
    } else {
      // ✅ JSON RESPONSE (FALLBACK)
      console.log('📋 [JSON] Sending JSON response...');
      
      try {
        const aiText = await getAIResponse({ message, fileUrl, fileType });
        
        const aiMsg = new Message({
          session: sessionId,
          sender: 'AI',
          message: aiText,
          type: 'text',
          metadata: { 
            responseType: 'json', 
            userMessageId: savedUserMsg._id 
          },
          timestamp: new Date()
        });
        await aiMsg.save();

        console.log('✅ [JSON] AI message saved:', aiMsg._id);

        res.json({
          success: true,
          response: aiText,
          message: aiText,
          userMessage: savedUserMsg,
          aiMessage: aiMsg,
          aiServiceStatus: 'normal'
        });
        
      } catch (aiError) {
        console.error('❌ [JSON] AI Error:', aiError);
        
        res.status(500).json({
          success: false,
          error: 'AI service error',
          message: 'I apologize, but I encountered an error while processing your request. Please try again.',
          aiServiceStatus: aiError.message.includes('quota') ? 'overloaded' : 'error'
        });
      }
    }

  } catch (error) {
    console.error('❌ [SEND MESSAGE] Controller error:', error);
    
    if (res.headersSent) {
      // If streaming has started, we can't send JSON
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: 'Server error',
        message: 'Failed to process message'
      });
    }
  }
};
