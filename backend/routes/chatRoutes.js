// /routes/chatRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import uploadChatFile from '../middleware/chatFileUpload.js';
import {
  createChatSession,
  getUserChatSessions,
  getSessionMessages,
  uploadFileHandler
} from '../controllers/chatController.js';

const router = express.Router();

// 🔹 Start a new chat session
router.post('/session', verifyToken, createChatSession);

// 🔹 Get all sessions for current user
router.get('/sessions', verifyToken, getUserChatSessions);

// 🔹 Get messages of a session
router.get('/messages/:sessionId', verifyToken, getSessionMessages);

// 🔹 Upload file (image/doc) to Cloudinary for chat
router.post('/upload', verifyToken, uploadChatFile.single('file'), uploadFileHandler);

export default router;
 