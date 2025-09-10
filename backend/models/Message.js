// /models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true,
    enum: ['user', 'AI'] // ✅ ENUM VALUES SHOULD BE STRINGS
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'document', 'error'],
    default: 'text'
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileType: {
    type: String,
    default: null
  },
  fileName: {
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
  responseTimeMs: {
    type: Number,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
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
