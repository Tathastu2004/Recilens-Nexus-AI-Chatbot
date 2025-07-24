// /models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: { type: String },
  type: { type: String, enum: ['text', 'image', 'document'], default: 'text' },
  fileUrl: { type: String },     // ✅ Cloudinary URL
  fileType: { type: String },    // ✅ MIME type (optional)
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Optional: auto-delete after 30 days
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model('Message', messageSchema);
