// /models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.Mixed, // ✅ Allow both ObjectId and string
    required: true,
    validate: {
      validator: function(value) {
        // ✅ Only allows "AI" string or valid ObjectId
        return value === 'AI' || mongoose.Types.ObjectId.isValid(value);
      },
      message: 'Sender must be "AI" or a valid ObjectId'
    }
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'document'],
    default: 'text'
  },
  fileUrl: String,
  fileType: String,
  fileName: String,
  // ✅ ADD TEXT EXTRACTION FIELDS
  extractedText: String,
  hasTextExtraction: {
    type: Boolean,
    default: false
  },
  textLength: {
    type: Number,
    default: 0
  },
  // ✅ REMOVE extractionStatus OR ADD VALID ENUM VALUES:
  extractionStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not_applicable'], // ✅ Add valid values
    default: 'not_applicable'
  },
  completedBy: String,
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

export default mongoose.model('Message', messageSchema);
