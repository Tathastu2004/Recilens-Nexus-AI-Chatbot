import mongoose from "mongoose";

const modelTrainingSchema = new mongoose.Schema({
  jobId: { 
    type: String, 
    unique: true, 
    sparse: true
  },
  name: { 
    type: String, 
    required: true,
    default: function() {
      return `Training Job ${new Date().toLocaleDateString()}`;
    }
  },
  modelType: { 
    type: String, 
    enum: ["lora", "llama", "blip", "fine-tune"], 
    default: "lora" 
  },
  baseModel: { // ✅ ADDED: To track the base model for LoRA
    type: String, 
    default: "llama3" 
  },
  status: { 
    type: String, 
    enum: ["pending", "running", "completed", "failed", "cancelled"], 
    default: "pending" 
  },
  progress: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100 
  },
  log: { 
    type: String, 
    default: "Training job created" 
  },
  adapterName: { // ✅ ADDED: To store the name of the final adapter folder
    type: String
  },
  model_path: { // ✅ ADDED: To store the final path to the adapter
    type: String
  },
  accuracy: { // ✅ ADDED: To store the final accuracy/loss
    type: Number
  },
  dataset: { // ✅ ADDED: To store dataset info
    filename: { type: String },
    path: { type: String },
    size: { type: Number }
  },
  parameters: { // ✅ ADDED: To store hyperparameters
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: { 
    type: String, 
    required: false 
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { 
  timestamps: true 
});

modelTrainingSchema.index({ jobId: 1 });
modelTrainingSchema.index({ status: 1 });
modelTrainingSchema.index({ createdBy: 1 });
modelTrainingSchema.index({ createdAt: -1 });

modelTrainingSchema.pre('save', function(next) {
  if (!this.jobId && this.isNew) {
    this.jobId = `${this.modelType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (this.isModified('status') && this.status === 'running' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  if (this.isModified('status') && ['completed', 'failed', 'cancelled'].includes(this.status) && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

modelTrainingSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return Math.round((this.completedAt - this.startedAt) / 1000);
  }
  return null;
});

modelTrainingSchema.virtual('isActive').get(function() {
  return ['pending', 'running'].includes(this.status);
});

export default mongoose.model("ModelTraining", modelTrainingSchema);