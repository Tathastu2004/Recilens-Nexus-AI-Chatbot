// /sockets/chatSocket.js
import Message from '../models/Message.js';

export const setupChatSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`⚡ [SOCKET CONNECTED] ID: ${socket.id} at ${new Date().toLocaleTimeString()}`);
    console.log(`[SOCKET CONNECTED] ID: ${socket.id}`)


    // Handle session joining
    socket.on('join-session', (sessionId) => {
      socket.join(sessionId);
      console.log(`🔗 [JOINED SESSION] Socket ${socket.id} joined session ${sessionId}`);
    });

    // Handle message sending
    socket.on('send-message', async (payload) => {
      try {
        console.log('📨 [RECEIVED MESSAGE EVENT]:', payload);

        const {
          sessionId,
          senderId,
          message,
          type = 'text',
          fileUrl = null,
          fileType = null
        } = payload;

        const newMsg = await Message.create({
          session: sessionId,
          sender: senderId,
          message,
          type,
          fileUrl,
          fileType
        });

        console.log(`✅ [MESSAGE STORED] ID: ${newMsg._id} | Type: ${type} | Session: ${sessionId}`);

        // Broadcast message to others in the session
        io.to(sessionId).emit('receive-message', {
          _id: newMsg._id,
          sender: senderId,
          message,
          type,
          fileUrl,
          fileType,
          createdAt: newMsg.createdAt
        });

        console.log(`📤 [MESSAGE EMITTED] To session ${sessionId}`);

      } catch (err) {
        console.error('❌ [SOCKET ERROR]: Error processing send-message', err);
        socket.emit('error', { message: 'Message send failed', error: err.message });
      }
    });

    // Handle session title updates
    socket.on('session-title-updated', (updatedSession) => {
      // Broadcast to all clients in the user's room
      socket.broadcast.emit('session-updated', updatedSession);
    });

    // Handle disconnects
    socket.on('disconnect', (reason) => {
      console.log(`❌ [SOCKET DISCONNECTED] ID: ${socket.id} | Reason: ${reason}`);
    });
  });
};
