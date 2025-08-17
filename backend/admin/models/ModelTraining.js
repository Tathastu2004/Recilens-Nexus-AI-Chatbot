import mongoose from "mongoose";

const modelTrainingSchema = new mongoose.Schema({
  modelName: { type: String, required: true }, // e.g. "llama3", "blip"
  status: { type: String, enum: ["pending", "running", "completed", "failed"], default: "pending" },
  dataset: { type: String }, // file path or dataset reference
  logs: [String], // log entries during training
  accuracy: { type: Number }, // optional training accuracy
  trainedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model("ModelTraining", modelTrainingSchema);
