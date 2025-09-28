// /models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'AI', 'system'] // ✅ ADD 'assistant' to enum
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'image', 'document', 'response', 'file'] // ✅ ADD 'response' to enum
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  fileType: {
    type: String,
    default: null
  },
  extractedText: {
    type: String,
    default: null
  },
  hasTextExtraction: {
    type: Boolean,
    default: false
  },
  textLength: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// ✅ ADD INDEXES FOR BETTER PERFORMANCE
messageSchema.index({ session: 1, createdAt: -1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

export default mongoose.model('Message', messageSchema);
