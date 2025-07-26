// /controllers/chatController.js
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

// 🔹 Create new chat session
export const createChatSession = async (req, res) => {
  try {
    console.log('📥 Creating new chat session for user:', req.user._id);
    const newSession = new ChatSession({
      user: req.user._id,
      title: req.body.title || 'New Chat'
    });
    const saved = await newSession.save();
    console.log('✅ Chat session created:', saved._id);
    res.status(201).json(saved);
  } catch (error) {
    console.error('❌ Create Session Error:', error);
    res.status(500).json({ message: 'Server error creating chat session' });
  }
};

// 🔹 Get all user chat sessions
export const getUserChatSessions = async (req, res) => {
  try {
    console.log('📤 Fetching chat sessions for user:', req.user._id);
    const sessions = await ChatSession.find({ user: req.user._id }).sort({ createdAt: -1 });
    console.log(`✅ ${sessions.length} session(s) found`);
    res.status(200).json(sessions);
  } catch (error) {
    console.error('❌ Get Sessions Error:', error);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

// 🔹 Get messages in a session
export const getSessionMessages = async (req, res) => {
  try {
    console.log('📤 Fetching messages for session:', req.params.sessionId);
    const messages = await Message.find({ session: req.params.sessionId }).sort({ createdAt: 1 });
    console.log(`✅ ${messages.length} message(s) found`);
    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Fetch Messages Error:', error);
    res.status(500).json({ message: 'Error retrieving messages' });
  }
};

// 🔹 Update session title
export const updateSessionTitle = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    console.log('📝 [Chat] Updating session title:', { sessionId, title, userId });

    const updatedSession = await ChatSession.findOneAndUpdate(
      { _id: sessionId, user: userId },
      { title, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedSession) {
      console.warn('⚠️ Session not found or user unauthorized:', { sessionId, userId });
      return res.status(404).json({ message: 'Session not found or unauthorized' });
    }

    console.log('✅ Session title updated successfully:', updatedSession.title);
    res.json({ success: true, session: updatedSession });
  } catch (error) {
    console.error('❌ [Chat] Error updating session title:', error);
    res.status(500).json({ message: 'Failed to update session title' });
  }
};

// 🔹 Delete chat session
export const deleteChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    console.log('🗑️ [Chat] Deleting session:', { sessionId, userId });

    // First, delete all messages in this session
    const deletedMessages = await Message.deleteMany({ session: sessionId });
    console.log(`🗑️ Deleted ${deletedMessages.deletedCount} messages from session`);

    // Then delete the session itself
    const deletedSession = await ChatSession.findOneAndDelete({
      _id: sessionId,
      user: userId
    });

    if (!deletedSession) {
      console.warn('⚠️ Session not found or user unauthorized:', { sessionId, userId });
      return res.status(404).json({ message: 'Session not found or unauthorized' });
    }

    console.log('✅ Session deleted successfully:', deletedSession.title);
    res.json({ 
      success: true, 
      message: 'Session deleted successfully',
      deletedSession: deletedSession
    });
  } catch (error) {
    console.error('❌ [Chat] Error deleting session:', error);
    res.status(500).json({ message: 'Failed to delete session' });
  }
};

// 🔹 Upload file (image or doc) to Cloudinary
export const uploadFileHandler = async (req, res) => {
  try {
    if (!req.file) {
      console.warn('⚠️ No file found in upload');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    console.log('📤 Uploading file to Cloudinary...', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'nexus_chat_files',
      resource_type: 'auto'
    });

    console.log('✅ Cloudinary upload success:', result.secure_url);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl: result.secure_url,
      publicId: result.public_id,
      type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
      fileType: req.file.mimetype,
      fileName: req.file.originalname
    });

  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading file',
      error: error.message 
    });
  }
};

