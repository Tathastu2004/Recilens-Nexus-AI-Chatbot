// /models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.Mixed,  // Can be ObjectId or 'AI'
    required: true,
    validate: {
      validator: function(value) {
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
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ session: 1, timestamp: 1 });
messageSchema.index({ sender: 1 });

console.log('📄 [MESSAGE MODEL] Message schema defined with Mixed sender type');

const Message = mongoose.model('Message', messageSchema);

export default Message;
