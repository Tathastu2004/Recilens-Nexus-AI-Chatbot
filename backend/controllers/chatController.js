// /controllers/chatController.js
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import path from 'path';
import fs from 'fs';
import { cloudinary } from '../config/cloudinary.js'; // Import from config

// 🔹 Create new chat session
export const createChatSession = async (req, res) => {
  console.log('🚀 [CREATE SESSION] Request received');
  console.log('📝 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  
  try {
    console.log('📥 [CREATE SESSION] Creating new chat session for user:', req.user._id);
    
    const sessionData = {
      user: req.user._id,
      title: req.body.title || 'New Chat'
    };
    
    console.log('📄 [DEBUG] Session data to create:', JSON.stringify(sessionData, null, 2));
    
    const newSession = new ChatSession(sessionData);
    const saved = await newSession.save();
    
    console.log('✅ [CREATE SESSION] Chat session created successfully:', {
      id: saved._id,
      title: saved.title,
      user: saved.user,
      createdAt: saved.createdAt
    });
    
    res.status(201).json(saved);
  } catch (error) {
    console.error('❌ [CREATE SESSION] Error occurred:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ message: 'Server error creating chat session' });
  }
};

// 🔹 Get all user chat sessions
export const getUserChatSessions = async (req, res) => {
  console.log('🚀 [GET SESSIONS] Request received');
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  
  try {
    console.log('📤 [GET SESSIONS] Fetching chat sessions for user:', req.user._id);
    
    const sessions = await ChatSession.find({ user: req.user._id }).sort({ createdAt: -1 });
    
    console.log('📊 [DEBUG] Query result:', {
      totalSessions: sessions.length,
      sessionIds: sessions.map(s => s._id),
      sessionTitles: sessions.map(s => s.title)
    });
    
    console.log(`✅ [GET SESSIONS] ${sessions.length} session(s) found`);
    res.status(200).json(sessions);
  } catch (error) {
    console.error('❌ [GET SESSIONS] Error occurred:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?._id
    });
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

// 🔹 Get messages in a session
export const getSessionMessages = async (req, res) => {
  console.log('🚀 [GET MESSAGES] Request received');
  console.log('📝 [DEBUG] Session ID:', req.params.sessionId);
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  
  try {
    const sessionId = req.params.sessionId;
    console.log('📤 [GET MESSAGES] Fetching messages for session:', sessionId);
    
    const messages = await Message.find({ session: sessionId }).sort({ createdAt: 1 });
    
    console.log('📊 [DEBUG] Messages query result:', {
      totalMessages: messages.length,
      messageTypes: messages.map(m => m.type),
      senders: messages.map(m => m.sender),
      hasFiles: messages.filter(m => m.fileUrl).length
    });
    
    console.log(`✅ [GET MESSAGES] ${messages.length} message(s) found`);
    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ [GET MESSAGES] Error occurred:', {
      message: error.message,
      stack: error.stack,
      sessionId: req.params.sessionId,
      userId: req.user?._id
    });
    res.status(500).json({ message: 'Error retrieving messages' });
  }
};

// 🔹 Update session title
export const updateSessionTitle = async (req, res) => {
  console.log('🚀 [UPDATE TITLE] Request received');
  console.log('📝 [DEBUG] Request params:', JSON.stringify(req.params, null, 2));
  console.log('📝 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    console.log('📝 [UPDATE TITLE] Updating session title:', { sessionId, title, userId });

    const updateQuery = { _id: sessionId, user: userId };
    const updateData = { title, updatedAt: new Date() };
    
    console.log('🔍 [DEBUG] Update query:', JSON.stringify(updateQuery, null, 2));
    console.log('📄 [DEBUG] Update data:', JSON.stringify(updateData, null, 2));

    const updatedSession = await ChatSession.findOneAndUpdate(
      updateQuery,
      updateData,
      { new: true }
    );

    if (!updatedSession) {
      console.warn('⚠️ [UPDATE TITLE] Session not found or user unauthorized:', { sessionId, userId });
      return res.status(404).json({ message: 'Session not found or unauthorized' });
    }

    console.log('✅ [UPDATE TITLE] Session title updated successfully:', {
      id: updatedSession._id,
      oldTitle: title,
      newTitle: updatedSession.title,
      updatedAt: updatedSession.updatedAt
    });
    
    res.json({ success: true, session: updatedSession });
  } catch (error) {
    console.error('❌ [UPDATE TITLE] Error occurred:', {
      message: error.message,
      stack: error.stack,
      sessionId: req.params.sessionId,
      userId: req.user?._id
    });
    res.status(500).json({ message: 'Failed to update session title' });
  }
};

// 🔹 Delete chat session
export const deleteChatSession = async (req, res) => {
  console.log('🚀 [DELETE SESSION] Request received');
  console.log('📝 [DEBUG] Session ID:', req.params.sessionId);
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    console.log("🗑️ [DELETE SESSION] Starting deletion process:", { sessionId, userId });

    // Step 1: Find all messages in the session
    console.log("🔍 [DEBUG] Searching for messages in session...");
    const messages = await Message.find({ session: sessionId });
    
    console.log("📊 [DEBUG] Messages found:", {
      totalMessages: messages.length,
      messageIds: messages.map(m => m._id),
      messagesWithFiles: messages.filter(m => m.fileUrl).length
    });

    const publicIds = [];
    const deletedFileUrls = [];

    // Step 2: Extract file URLs and public IDs for Cloudinary cleanup
    console.log("🔍 [DEBUG] Processing files for deletion...");
    for (const msg of messages) {
      if (msg.fileUrl) {
        deletedFileUrls.push(msg.fileUrl);
        const match = msg.fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
        if (match && match[1]) {
          publicIds.push(match[1]);
          console.log("📎 [DEBUG] File to delete:", {
            messageId: msg._id,
            fileUrl: msg.fileUrl,
            publicId: match[1]
          });
        }
      }
    }

    // Step 3: Delete files from Cloudinary
    if (publicIds.length > 0) {
      console.log("☁️ [DEBUG] Deleting files from Cloudinary:", { count: publicIds.length, publicIds });
      
      try {
        const cloudinaryResult = await cloudinary.api.delete_resources(publicIds);
        console.log("☁️ [DEBUG] Cloudinary deletion result:", cloudinaryResult);
        
        console.log("🧹 [DELETE SESSION] Deleted the following file URLs from Cloudinary:");
        deletedFileUrls.forEach((url, i) => {
          console.log(`   ${i + 1}. ${url}`);
        });
      } catch (cloudinaryError) {
        console.error("❌ [DELETE SESSION] Cloudinary deletion error:", {
          message: cloudinaryError.message,
          publicIds
        });
      }
    } else {
      console.log("ℹ️ [DELETE SESSION] No files to delete from Cloudinary.");
    }

    // Step 4: Delete all messages
    console.log("🗑️ [DEBUG] Deleting messages from database...");
    const deletedMessages = await Message.deleteMany({ session: sessionId });
    console.log(`✅ [DELETE SESSION] Deleted ${deletedMessages.deletedCount} messages from session`);

    // Step 5: Delete the session
    console.log("🗑️ [DEBUG] Deleting session from database...");
    const deletedSession = await ChatSession.findOneAndDelete({
      _id: sessionId,
      user: userId,
    });

    if (!deletedSession) {
      console.warn("⚠️ [DELETE SESSION] Session not found or user unauthorized:", { sessionId, userId });
      return res.status(404).json({ message: "Session not found or unauthorized" });
    }

    console.log(`✅ [DELETE SESSION] Session "${deletedSession.title}" deleted successfully`, {
      sessionId: deletedSession._id,
      title: deletedSession.title,
      deletedMessages: deletedMessages.deletedCount,
      deletedFiles: deletedFileUrls.length
    });

    res.json({
      success: true,
      message: "Session and files deleted successfully",
      deletedSession,
      deletedFileUrls,
      statistics: {
        messagesDeleted: deletedMessages.deletedCount,
        filesDeleted: deletedFileUrls.length
      }
    });
  } catch (error) {
    console.error("❌ [DELETE SESSION] Error occurred:", {
      message: error.message,
      stack: error.stack,
      sessionId: req.params.sessionId,
      userId: req.user?._id
    });
    res.status(500).json({ message: "Failed to delete session" });
  }
};

// 🔹 Upload file (image or doc) to Cloudinary
export const uploadFileHandler = async (req, res) => {
  const uploadStartTime = Date.now();
  console.log('🚀 [UPLOAD FILE] Request received at', new Date(uploadStartTime).toLocaleTimeString());
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  console.log('📁 [DEBUG] File info:', {
    hasFile: !!req.file,
    fileName: req.file?.originalname,
    fileSize: req.file?.size,
    mimeType: req.file?.mimetype,
    fieldName: req.file?.fieldname,
    filePath: req.file?.path
  });
  
  try {
    if (!req.file) {
      console.warn('⚠️ [UPLOAD FILE] No file found in upload request');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const localPath = req.file.path;
    const fileCheckTime = Date.now();
    
    console.log('📥 [UPLOAD FILE] File received and saved locally in', fileCheckTime - uploadStartTime, 'ms:', {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      localPath: localPath,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

    // Quick file existence check
    if (!fs.existsSync(localPath)) {
      console.error('❌ [DEBUG] File not found on disk:', localPath);
      return res.status(500).json({
        success: false,
        message: 'File was not saved properly'
      });
    }

    const cloudinaryStartTime = Date.now();
    console.log('☁️ [DEBUG] Starting Cloudinary upload at', new Date(cloudinaryStartTime).toLocaleTimeString());

    const uploadOptions = {
      folder: 'nexus_chat_files',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      timeout: 30000 // Reduced to 30 seconds for faster response
    };

    let cloudRes;
    try {
      cloudRes = await cloudinary.uploader.upload(localPath, uploadOptions);
      const cloudinaryEndTime = Date.now();
      const cloudinaryDuration = cloudinaryEndTime - cloudinaryStartTime;
      
      console.log('☁️ [UPLOAD FILE] Cloudinary upload complete in', cloudinaryDuration, 'ms:', {
        publicId: cloudRes.public_id,
        secureUrl: cloudRes.secure_url,
        resourceType: cloudRes.resource_type,
        format: cloudRes.format,
        bytes: cloudRes.bytes,
        uploadDuration: cloudinaryDuration
      });
      
    } catch (cloudinaryError) {
      const errorTime = Date.now() - cloudinaryStartTime;
      console.error('❌ [CLOUDINARY] Upload failed after', errorTime, 'ms:', {
        message: cloudinaryError?.message || 'No error message',
        code: cloudinaryError?.code || 'No error code',
        http_code: cloudinaryError?.http_code || 'No HTTP code'
      });
      
      // Quick cleanup
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to cloud storage',
        error: cloudinaryError?.message || 'Cloudinary upload failed',
        uploadDuration: errorTime
      });
    }

    // Quick cleanup after successful upload
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log('🧹 [DEBUG] Local file cleaned up');
    }

    const totalUploadTime = Date.now() - uploadStartTime;
    const responseData = {
      success: true,
      message: 'File uploaded successfully',
      fileUrl: cloudRes.secure_url,
      publicId: cloudRes.public_id,
      type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadTimestamp: new Date().toISOString(),
      performance: {
        totalUploadTime,
        cloudinaryTime: Date.now() - cloudinaryStartTime,
        processingTime: cloudinaryStartTime - uploadStartTime
      },
      cloudinaryInfo: {
        resourceType: cloudRes.resource_type,
        format: cloudRes.format,
        bytes: cloudRes.bytes
      }
    };

    console.log('✅ [UPLOAD FILE] Upload successful in', totalUploadTime, 'ms, sending response');
    res.status(200).json(responseData);

  } catch (error) {
    const errorDuration = Date.now() - uploadStartTime;
    console.error('❌ [UPLOAD FILE] Unexpected error after', errorDuration, 'ms:', {
      message: error?.message || 'Unknown error',
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      userId: req.user?._id
    });
    
    // Quick cleanup
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading file',
      error: error?.message || 'Unknown error occurred',
      fileName: req.file?.originalname || 'Unknown file',
      processingTime: errorDuration
    });
  }
};

// 🔹 Send message via API (fallback for when socket is not available)
export const sendMessage = async (req, res) => {
  console.log('🚀 [SEND MESSAGE] API request received');
  console.log('📝 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
  console.log('👤 [DEBUG] User ID:', req.user?._id);
  
  try {
    const { sessionId, message, type = 'text', fileUrl, fileType, metadata } = req.body;
    const senderId = req.user._id;

    console.log('📤 [SEND MESSAGE] Creating message:', {
      sessionId,
      senderId,
      messageLength: message?.length || 0,
      type,
      hasFile: !!fileUrl
    });

    // Validate required fields
    if (!sessionId || !message) {
      console.warn('⚠️ [SEND MESSAGE] Missing required fields:', { sessionId: !!sessionId, message: !!message });
      return res.status(400).json({
        success: false,
        message: 'Session ID and message are required'
      });
    }

    // Verify session belongs to user
    const session = await ChatSession.findOne({ _id: sessionId, user: senderId });
    if (!session) {
      console.warn('⚠️ [SEND MESSAGE] Session not found or unauthorized:', { sessionId, userId: senderId });
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized'
      });
    }

    // ✅ CREATE USER MESSAGE WITH CORRECT SENDER FORMAT
    const userMessageData = {
      session: sessionId,
      sender: senderId, // ✅ Use ObjectId instead of string "user"
      message,
      type,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      metadata: metadata || {},
      timestamp: new Date()
    };

    console.log('💾 [DEBUG] Saving user message to database:', {
      session: userMessageData.session,
      sender: userMessageData.sender,
      messageLength: userMessageData.message.length,
      type: userMessageData.type
    });

    const newMessage = new Message(userMessageData);
    const savedMessage = await newMessage.save();

    console.log('✅ [SEND MESSAGE] User message saved successfully:', {
      messageId: savedMessage._id,
      sessionId: savedMessage.session,
      timestamp: savedMessage.timestamp
    });

    // Update session's lastActivity
    await ChatSession.findByIdAndUpdate(sessionId, {
      lastActivity: new Date()
    });

    // ✅ CREATE AI RESPONSE WITH CORRECT SENDER FORMAT
    const aiResponseData = {
      session: sessionId,
      sender: 'AI', // ✅ Use string "AI" for AI messages
      message: `I received your message: "${message}". This is a test response from the API fallback mode.`,
      type: 'text',
      metadata: {
        responseType: 'fallback',
        userMessageId: savedMessage._id
      },
      timestamp: new Date()
    };

    const aiMessage = new Message(aiResponseData);
    const savedAIMessage = await aiMessage.save();

    console.log('✅ [SEND MESSAGE] AI response saved:', {
      messageId: savedAIMessage._id,
      responseLength: aiResponseData.message.length
    });

    // Return both messages
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        userMessage: savedMessage,
        aiResponse: savedAIMessage
      }
    });

  } catch (error) {
    console.error('❌ [SEND MESSAGE] Error occurred:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};
