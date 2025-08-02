// /routes/chatRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import uploadChatFile, { handleUploadErrors, debugUploadRequest } from '../middleware/chatFileUpload.js';
import ChatSession from '../models/ChatSession.js'; // ✅ ADD THIS MISSING IMPORT
import {
  createChatSession,
  getUserChatSessions,
  getSessionMessages,
  updateSessionTitle,
  deleteChatSession,
  uploadFileHandler,
  sendMessage
} from '../controllers/chatController.js';

const router = express.Router();

// 🔹 Start a new chat session
router.post('/session', verifyToken, createChatSession);

// 🔹 Get all sessions for current user
router.get('/sessions', verifyToken, getUserChatSessions);

// 🔹 Get messages of a session
router.get('/messages/:sessionId', verifyToken, getSessionMessages);

// 🔹 Update session title
router.patch('/session/:sessionId', verifyToken, updateSessionTitle);

// 🔹 Delete chat session
router.delete('/session/:sessionId', verifyToken, deleteChatSession);

// 🔹 Send message with streaming support (FIXED ROUTE)
router.post('/message', verifyToken, sendMessage);

// 🔹 Legacy streaming route (keep for compatibility)
router.get('/stream/:sessionId', verifyToken, sendMessage);

// 🔹 Upload file (image/doc) to Cloudinary for chat
router.post(
  '/upload',
  verifyToken,
  debugUploadRequest,
  uploadChatFile.single('file'),
  uploadFileHandler
);

// 🔹 Get individual session metadata - FIXED
router.get('/session/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    // ✅ Now ChatSession is properly imported
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

    // ✅ Return the session data directly (not nested in success object)
    res.json({
      _id: session._id,
      user: session.user,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivity: session.lastActivity
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

// Error handling middleware
router.use(handleUploadErrors);

export default router;