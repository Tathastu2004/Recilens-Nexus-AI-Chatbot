// /routes/chatRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import uploadChatFile, { handleUploadErrors, debugUploadRequest } from '../middleware/chatFileUpload.js';
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js'; // Import Message model
import { getAIResponse } from '../services/aiService.js';
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

// 🔹 Get messages of a session - FIX THE ENDPOINT
router.get('/session/:sessionId/messages', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    console.log('📨 [GET MESSAGES] Request:', { sessionId, userId });

    // ✅ VERIFY SESSION EXISTS AND USER HAS ACCESS
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied or session not found' 
      });
    }

    // ✅ FETCH MESSAGES FROM DATABASE
    const messages = await Message.find({ session: sessionId })
      .sort({ createdAt: 1 }) // Chronological order
      .exec();

    console.log('✅ [GET MESSAGES] Found:', messages.length, 'messages');

    res.json({
      success: true,
      messages: messages,
      total: messages.length
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

// 🔹 Send message with streaming support - ENSURE MESSAGES ARE SAVED
router.post('/message', verifyToken, async (req, res) => {
  try {
    const { sessionId, message, type, fileUrl, fileType, senderId, tempId } = req.body;
    const userId = req.user._id;
    
    // ✅ SAVE USER MESSAGE TO DATABASE FIRST
    const userMessage = new Message({
      session: sessionId,
      message,
      sender: userId,
      type: type || 'text',
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      timestamp: new Date()
    });

    const savedUserMessage = await userMessage.save();
    console.log('✅ [BACKEND] User message saved:', savedUserMessage._id);

    // ✅ VALIDATE SESSION EXISTS AND USER HAS ACCESS
    const session = await ChatSession.findById(sessionId);
    if (!session || session.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied or session not found' 
      });
    }

    // ✅ GET RECENT SESSION MESSAGES FOR CONTEXT (INCREASED TO 15 MESSAGES)
    let conversationContext = [];
    try {
      const recentMessages = await ChatSession.findById(sessionId)
        .populate({
          path: 'messages',
          options: { 
            sort: { createdAt: -1 },
            limit: 15  // ✅ Get more messages for better context
          }
        })
        .exec();

      if (recentMessages && recentMessages.messages) {
        // Reverse to get chronological order
        const lastMessages = recentMessages.messages.reverse();
        conversationContext = lastMessages.map(msg => ({
          role: msg.sender.toString() === userId.toString() ? 'user' : 'assistant',
          content: msg.message,
          type: msg.type || 'text',
          fileUrl: msg.fileUrl,
          timestamp: msg.timestamp
        }));
        
        console.log(`📚 [BACKEND] Found ${conversationContext.length} recent messages for context`);
        
        // ✅ LOG CONTEXT DETAILS FOR DEBUGGING
        const hasImageInContext = conversationContext.some(msg => msg.fileUrl || msg.type === 'image');
        console.log('🔍 [BACKEND] Context analysis:', {
          totalMessages: conversationContext.length,
          hasImageInContext,
          lastMessage: conversationContext[conversationContext.length - 1]?.content?.substring(0, 50),
          userMessage: message.substring(0, 50)
        });
        
      }
    } catch (contextError) {
      console.error('⚠️ [BACKEND] Could not retrieve session context:', contextError.message);
    }

    // ✅ ENHANCED AI PAYLOAD WITH FULL CONTEXT
    const aiPayload = {
      message,
      type: type || 'chat',
      fileUrl,
      fileType,
      sessionId: sessionId,
      conversationContext: conversationContext  // ✅ Pass full conversation context
    };

    console.log('🤖 [BACKEND] Calling AI service with enhanced context:', {
      originalMessage: message,
      contextMessages: conversationContext.length,
      hasImageInContext: conversationContext.some(msg => msg.fileUrl || msg.type === 'image'),
      isAskingAboutPrevious: ['again', 'analysis', 'repeat', 'previous'].some(word => 
        message.toLowerCase().includes(word)
      )
    });

    const aiResponse = await getAIResponse(aiPayload);

    // ✅ LOG AI RESPONSE INFO
    console.log('📥 [BACKEND] AI response received:', {
      length: aiResponse?.length,
      processedBy: type === 'image' ? 'BLIP' : 'Llama3',
      responsePreview: aiResponse?.substring(0, 100) + '...',
      contextWasUsed: conversationContext.length > 0
    });

    // ✅ SAVE AI RESPONSE TO DATABASE
    const aiMessage = new Message({
      session: sessionId,
      message: aiResponse,
      sender: 'AI',
      type: 'text',
      timestamp: new Date()
    });

    const savedAiMessage = await aiMessage.save();
    console.log('✅ [BACKEND] AI message saved:', savedAiMessage._id);

    // ✅ SETUP STREAMING RESPONSE
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no'
    });

    // ✅ STREAM RESPONSE IN CHUNKS
    const chunkSize = 30;
    const delay = type === 'image' ? 50 : 30;

    console.log('🌊 [BACKEND] Starting response streaming...');
    
    for (let i = 0; i < aiResponse.length; i += chunkSize) {
      const chunk = aiResponse.slice(i, i + chunkSize);
      res.write(chunk);
      
      if (i + chunkSize < aiResponse.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log('✅ [BACKEND] Response streaming completed');
    res.end();

  } catch (error) {
    console.error('❌ [BACKEND] Message processing error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
});

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