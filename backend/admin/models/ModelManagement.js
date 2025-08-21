import mongoose from "mongoose";

const modelManagementSchema = new mongoose.Schema(
  {
    // 🔹 Registry Info
    modelName: { type: String, required: true }, // e.g. "llama3", "blip"
    version: { type: String, default: "v1" }, // v1, v2, etc.
    description: { type: String }, // short description of the model
    modelPath: { type: String }, // local system path to the model

    // 🔹 Training Info
    status: {
      type: String,
      enum: ["idle", "pending", "running", "completed", "failed"],
      default: "idle",
    },
    dataset: { type: String }, // dataset path or reference
    logs: [String], // training log messages

    // 🔹 Metrics
    metrics: {
      accuracy: { type: Number },
      loss: { type: Number },
      f1Score: { type: Number },
      precision: { type: Number },
      recall: { type: Number },
    },

    // 🔹 Ownership & Lifecycle
    trainedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },

    // 🔹 Lifecycle flags
    isActive: { type: Boolean, default: true }, // which version is currently active
    deprecated: { type: Boolean, default: false }, // mark old models as deprecated
  },
  { timestamps: true }
);

export default mongoose.model("ModelManagement", modelManagementSchema);
