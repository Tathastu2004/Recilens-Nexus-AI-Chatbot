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
  console.log('📨 [SEND MESSAGE] Request received');
  
  try {
    const { sessionId, message, type = 'text', fileUrl, fileType, tempId } = req.body;
    const userId = req.user._id;

    console.log('📋 [SEND MESSAGE] Payload:', {
      sessionId: sessionId?.substring(0, 8),
      messageLength: message?.length,
      type,
      hasFile: !!fileUrl,
      tempId
    });

    // ✅ VALIDATE REQUIRED FIELDS
    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message are required'
      });
    }

    // ✅ VERIFY SESSION EXISTS AND BELONGS TO USER
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    if (session.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // ✅ SAVE USER MESSAGE TO DATABASE (FIXED FIELD NAMES)
    const userMessage = new Message({
      session: sessionId,  // ✅ Changed from sessionId to session
      message,
      sender: userId,      // ✅ Changed from 'User' to actual user ObjectId
      type,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      tempId
    });

    await userMessage.save();
    console.log('✅ [SEND MESSAGE] User message saved:', userMessage._id);

    // ✅ SET STREAMING HEADERS
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // ✅ GET AI RESPONSE WITH STREAMING
    console.log('🤖 [SEND MESSAGE] Getting AI response...');
    
    try {
      const aiResponse = await getAIResponse({
        message,
        type,
        fileUrl,
        fileType
      });

      console.log('✅ [SEND MESSAGE] AI response received:', aiResponse?.length || 0, 'chars');

      // ✅ SAVE AI MESSAGE TO DATABASE (FIXED FIELD NAMES)
      const aiMessage = new Message({
        session: sessionId,  // ✅ Changed from sessionId to session
        message: aiResponse,
        sender: 'AI',        // ✅ Keep as 'AI' string for AI responses
        type: 'text'
      });

      await aiMessage.save();
      console.log('✅ [SEND MESSAGE] AI message saved:', aiMessage._id);

      // ✅ UPDATE SESSION ACTIVITY
      session.lastActivity = new Date();
      await session.save();

      // ✅ STREAM AI RESPONSE TO CLIENT
      res.write(aiResponse);
      res.end();

    } catch (aiError) {
      console.error('❌ [SEND MESSAGE] AI Error:', aiError.message);
      
      const errorMessage = `❌ AI Error: ${aiError.message}`;
      
      // ✅ SAVE ERROR MESSAGE (FIXED FIELD NAMES)
      const errorMsg = new Message({
        session: sessionId,  // ✅ Changed from sessionId to session
        message: errorMessage,
        sender: 'AI',        // ✅ Keep as 'AI' string for error messages
        type: 'error'
      });
      
      await errorMsg.save();
      
      res.write(errorMessage);
      res.end();
    }

  } catch (error) {
    console.error('❌ [SEND MESSAGE] Server Error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
        details: error.message
      });
    } else {
      res.write(`❌ Server Error: ${error.message}`);
      res.end();
    }
  }
};
