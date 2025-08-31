import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String, 
    unique: true,
    sparse: true, // This allows multiple null/undefined values but maintains uniqueness for actual values
    validate: {
      validator: function(v) {
        // Either null/undefined or a valid email format
        return !v || /^\S+@\S+\.\S+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  name: { 
    type: String, 
    required: false,
    default: ''
  },
  profilePicture: { 
    type: String, 
    default: '' 
  },
  role: { 
    type: String, 
    enum: ['admin', 'client', 'super-admin'], 
    default: 'client' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, {
  timestamps: true
});

// Add index for better performance
userSchema.index({ clerkId: 1 });
userSchema.index({ email: 1 }, { sparse: true });

export default mongoose.model('User', userSchema);
