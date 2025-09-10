import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    // ✅ Changed from 'user' to 'userId' to match controller expectations
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    // ✅ Added email field for easier queries
    email: { 
      type: String, 
      required: true 
    },
    subject: { 
      type: String, 
      required: true,
      maxlength: 100
    },
    message: { 
      type: String, 
      required: true,
      maxlength: 1000
    },
    reply: { 
      type: String,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ["pending", "processed", "completed"],
      default: "pending"
    },
    // ✅ Added admin tracking fields
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    repliedAt: {
      type: Date
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    completedAt: {
      type: Date
    }
  },
  { 
    timestamps: true,
    // ✅ Add indexes for better performance
    indexes: [
      { userId: 1, createdAt: -1 },
      { status: 1 },
      { email: 1 }
    ]
  }
);

// ✅ Add virtual for backward compatibility (if needed)
feedbackSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// ✅ Ensure virtual fields are serialized
feedbackSchema.set('toJSON', { virtuals: true });
feedbackSchema.set('toObject', { virtuals: true });

export default mongoose.model("Feedback", feedbackSchema);
