// /routes/chatRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import uploadChatFile, { handleUploadErrors, debugUploadRequest } from '../middleware/chatFileUpload.js';
import {
  createChatSession,
  getUserChatSessions,
  getSessionMessages,
  updateSessionTitle,
  deleteChatSession,
  uploadFileHandler,
  sendMessage // ✅ ADD THIS IMPORT
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

// ✅ ADD THIS NEW ROUTE
// 🔹 Send message via API (fallback when socket unavailable)
router.post('/message', verifyToken, sendMessage);

// 🔹 Upload file (image/doc) to Cloudinary for chat
router.post('/upload', 
  verifyToken, 
  debugUploadRequest,
  uploadChatFile.single('file'), 
  uploadFileHandler
);

// Error handling middleware should be at the end
router.use(handleUploadErrors);

export default router;
