import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // ✅ CLERK INTEGRATION FIELDS
  clerkUserId: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true 
  },
  
  // ✅ CORE USER FIELDS
  name: { type: String, required: false },
  email: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ['admin', 'client', 'super-admin'], default: 'client' },
  isVerified: { type: Boolean, default: true },
  profilePicture: { type: String, default: '' },
  
  // ✅ LEGACY FIELDS (KEEP FOR EXISTING USERS)
  password: { type: String, select: false },
  otp: { type: String, select: false },
  otpExpires: { type: Date, select: false },
  passwordResetOtp: { type: String, select: false },
  passwordResetOtpExpires: { type: Date, select: false },
  
  // ✅ CLERK MIGRATION TRACKING
  migratedToClerk: { type: Boolean, default: false },
  migrationDate: { type: Date }
}, {
  timestamps: true
});

// ✅ INDEXES
userSchema.index({ clerkUserId: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

export default mongoose.model('User', userSchema);
