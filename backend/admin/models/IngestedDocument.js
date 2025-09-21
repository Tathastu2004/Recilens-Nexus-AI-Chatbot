import mongoose from "mongoose";

const ingestedDocumentSchema = new mongoose.Schema({
  docId: { 
    type: String, 
    unique: true, 
    required: true,
  },
  fileName: { 
    type: String, 
    required: true,
  },
  fileType: { 
    type: String,
    required: true
  },
  size: { 
    type: Number, 
    required: true,
  },
  ingestedAt: {
    type: Date,
    default: Date.now,
  },
}, { 
  timestamps: true 
});

ingestedDocumentSchema.index({ docId: 1 });
ingestedDocumentSchema.index({ ingestedAt: -1 });

export default mongoose.model("IngestedDocument", ingestedDocumentSchema);