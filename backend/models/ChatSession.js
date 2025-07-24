import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, default: "New Chat" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("ChatSession", chatSessionSchema);
