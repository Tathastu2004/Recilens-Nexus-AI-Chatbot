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

// 🔹 Upload file (image or doc) to Cloudinary
export const uploadFileHandler = async (req, res) => {
  try {
    if (!req.file) {
      console.warn('⚠️ No file found in upload');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('📤 Uploading file to Cloudinary...');
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'nexus_chat_files',
      resource_type: 'auto' // Automatically detects image/video/document
    });

    const fileType = req.file.mimetype || 'unknown';
    console.log('✅ Cloudinary upload success:', result.secure_url);

    res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl: result.secure_url,
      fileType
    });
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error);
    res.status(500).json({ message: 'Error uploading file to cloud' });
  }
};
