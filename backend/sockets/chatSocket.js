// /sockets/chatSocket.js
import fs from 'fs';
import path from 'path';
import Message from '../models/Message.js';
import ChatSession from '../models/ChatSession.js';
import { getAIResponse } from '../services/aiService.js';

export const registerChatSocket = (io) => {
  console.log('🚀 [SOCKET] Registering chat socket handlers...');

  io.on("connection", (socket) => {
    const connectionTime = Date.now();
    console.log(`⚡ [SOCKET CONNECTED] ID: ${socket.id} at ${new Date(connectionTime).toLocaleTimeString()}`);

    socket.on("join-session", (sessionId) => {
      const joinTime = Date.now();
      socket.join(sessionId);
      console.log(`🔗 [JOINED SESSION] Socket ${socket.id} joined session ${sessionId} in ${Date.now() - joinTime}ms`);
      socket.emit("session-joined", { sessionId, timestamp: new Date().toISOString() });
    });

    socket.on("send-message", async (data) => {
      const messageStartTime = Date.now();
      
      // ✅ Enhanced logging to debug the issue
      console.log('📨 [SOCKET] Raw message data received:', {
        data: JSON.stringify(data, null, 2),
        hasSessionId: !!data.sessionId,
        hasSenderId: !!data.senderId,
        senderId: data.senderId,
        senderIdType: typeof data.senderId
      });
      
      const {
        sessionId,
        senderId,
        message,
        type = "text",
        fileUrl = null,
        fileType = null,
        timestamp
      } = data;

      console.log('📨 [SOCKET] Message received:', {
        sessionId,
        sender: senderId, // ✅ Changed from undefined to senderId
        messageLength: message?.length || 0,
        type,
        hasFile: !!fileUrl,
        senderIdExists: !!senderId // ✅ Check if senderId exists
      });

      // ✅ Validate required fields
      if (!sessionId) {
        console.error('❌ [SOCKET] Missing sessionId');
        socket.emit("error", { 
          message: "Session ID is required", 
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!senderId) {
        console.error('❌ [SOCKET] Missing senderId');
        socket.emit("error", { 
          message: "User authentication required", 
          timestamp: new Date().toISOString()
        });
        return;
      }

      try {
        // 1. Store user message
        const messageData = {
          session: sessionId,
          sender: senderId, // ✅ This should now have a value
          message: message || "",
          type,
          fileUrl,
          fileType,
          timestamp: timestamp || new Date()
        };

        console.log('💾 [SOCKET] Creating user message with validated data:', {
          session: messageData.session,
          sender: messageData.sender,
          senderType: typeof messageData.sender,
          messageLength: messageData.message.length,
          type: messageData.type
        });

        const newMessage = await Message.create(messageData);
        console.log('✅ [SOCKET] User message stored:', newMessage._id);

        // 2. Emit user message immediately
        io.to(sessionId).emit("receive-message", newMessage);
        console.log('📤 [SOCKET] User message emitted');

        // 3. Generate AI response (non-blocking)
        if ((type === "text" && message?.trim()) || (type !== "text" && fileUrl)) {
          setImmediate(async () => {
            const aiStartTime = Date.now();
            console.log('🤖 [AI] Starting response generation...');

            try {
              // Prepare AI input
              let aiInput = message || "";

              // Handle file input
              if (fileUrl && fileType) {
                aiInput = {
                  prompt: message || "What can you tell me about this file?",
                  fileUrl: fileUrl,
                  fileType: fileType === "image" ? "image" : "document"
                };

                // Add mime type for images
                if (fileType === "image") {
                  if (fileUrl.includes('.png')) aiInput.mimeType = 'image/png';
                  else if (fileUrl.includes('.jpg') || fileUrl.includes('.jpeg')) aiInput.mimeType = 'image/jpeg';
                  else if (fileUrl.includes('.gif')) aiInput.mimeType = 'image/gif';
                  else if (fileUrl.includes('.webp')) aiInput.mimeType = 'image/webp';
                  else aiInput.mimeType = 'image/jpeg'; // default
                }
              }

              console.log('🔄 [AI] Processing input type:', typeof aiInput);

              const aiReply = await getAIResponse(aiInput);
              const aiProcessingTime = Date.now() - aiStartTime;

              if (aiReply && aiReply.trim()) {
                console.log('💾 [AI] Creating AI message...');
                
                const aiMessage = await Message.create({
                  session: sessionId,
                  sender: "AI", // String value for AI
                  message: aiReply,
                  type: "text",
                  timestamp: new Date()
                });

                console.log('✅ [AI] Response generated in', aiProcessingTime, 'ms');
                
                // Emit AI response
                io.to(sessionId).emit("receive-message", aiMessage);
                console.log('📤 [AI] Response emitted');
              } else {
                console.warn('⚠️ [AI] Empty response received');
              }
            } catch (aiError) {
              console.error('❌ [AI] Error generating response:', aiError.message);
              
              // Send error message to user
              try {
                const errorMessage = await Message.create({
                  session: sessionId,
                  sender: "AI",
                  message: "I apologize, but I encountered an error while processing your request. Please try again.",
                  type: "text",
                  timestamp: new Date()
                });
                
                io.to(sessionId).emit("receive-message", errorMessage);
                console.log('📤 [AI] Error message sent');
              } catch (errorMsgError) {
                console.error('❌ [AI] Failed to create error message:', errorMsgError.message);
              }
            }
          });
        }

        console.log(`⚡ [SOCKET] Message processing completed in ${Date.now() - messageStartTime}ms`);

      } catch (err) {
        console.error('❌ [SOCKET ERROR] Message processing failed:', {
          error: err.message,
          stack: err.stack,
          sessionId,
          senderId,
          messageData: messageData || 'undefined'
        });
        
        socket.emit("error", { 
          message: "Message processing failed", 
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Typing indicators for real-time feel
    socket.on("typing-start", (data) => {
      console.log('⌨️ [SOCKET] User started typing:', data);
      socket.to(data.sessionId).emit("user-typing", data);
    });

    socket.on("typing-stop", (data) => {
      console.log('⏹️ [SOCKET] User stopped typing:', data);
      socket.to(data.sessionId).emit("user-stop-typing", data);
    });

    socket.on("session-title-updated", (updatedSession) => {
      const updateTime = Date.now();
      console.log("🔄 [SESSION TITLE UPDATED] Broadcasting at", new Date(updateTime).toLocaleTimeString(), ':', {
        sessionId: updatedSession._id,
        newTitle: updatedSession.title
      });
      socket.broadcast.emit("session-updated", updatedSession);
    });

    // Real-time session deletion
    socket.on("session-deleted", (deletedSessionId) => {
      const deleteTime = Date.now();
      console.log("🗑️ [SESSION DELETED] Broadcasting deletion at", new Date(deleteTime).toLocaleTimeString(), ':', deletedSessionId);
      socket.broadcast.emit("session-deleted", deletedSessionId);
    });

    // Real-time new session creation
    socket.on("new-session-created", (newSession) => {
      const createTime = Date.now();
      console.log("🆕 [NEW SESSION] Broadcasting creation at", new Date(createTime).toLocaleTimeString(), ':', {
        sessionId: newSession._id,
        title: newSession.title
      });
      socket.broadcast.emit("new-session-created", newSession);
    });

    // Update session title
    socket.on('update-session-title', async (data) => {
      try {
        const { sessionId, title } = data;
        
        // Update in database
        const updatedSession = await ChatSession.findByIdAndUpdate(
          sessionId,
          { title, updatedAt: new Date() },
          { new: true }
        );

        if (updatedSession) {
          // Broadcast to all clients immediately
          io.emit('session-updated', updatedSession);
          console.log('✅ [SOCKET] Session title updated and broadcasted:', updatedSession.title);
        }
      } catch (error) {
        console.error('❌ [SOCKET] Failed to update session title:', error);
      }
    });

    socket.on("disconnect", (reason) => {
      const sessionDuration = Date.now() - connectionTime;
      console.log(`❌ [SOCKET DISCONNECTED] ID: ${socket.id} | Duration: ${sessionDuration}ms`);
    });
  });

  console.log('✅ [SOCKET] Chat socket handlers registered successfully');
};


