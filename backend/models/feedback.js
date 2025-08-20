import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    reply: { type: String },
    status: {
      type: String,
      enum: ["pending", "processed", "completed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Feedback", feedbackSchema);
