import mongoose from "mongoose";

const adminConfigSchema = new mongoose.Schema({
  // Which model is currently active (e.g. "llama3", "blip")
  activeModel: { type: String, default: "llama3" },

  // NLP Intents (e.g. greeting, faq, support)
  intents: [
    {
      name: { type: String, required: true },
      responseTemplate: { type: String, required: true }, // Default response text
      examples: [String] // Example user queries
    }
  ],

  // Response Templates for quick replies
  responseTemplates: [
    {
      title: { type: String },
      body: { type: String }
    }
  ],

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("AdminConfig", adminConfigSchema);
