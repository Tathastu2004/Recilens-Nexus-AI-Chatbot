import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  intent: { type: String },
  totalQueries: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 }, // e.g. % correct responses
  avgResponseTime: { type: Number, default: 0 }, // ms

  // Which messages contributed to this analytics
  relatedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],

  generatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Analytics", analyticsSchema);
