// /models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: { type: String },
  type: { type: String, enum: ['text', 'image', 'document'], default: 'text' },
  fileUrl: { type: String }, // For file/image messages
  fileType: { type: String }, // image/png, application/pdf, etc.
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export default mongoose.model('Message', messageSchema);
