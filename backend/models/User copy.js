import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String,  unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'client' , 'super-admin'], default: 'client' },
  // Email verification fields
  otp: String,
  otpExpires: Date,
  isVerified: { type: Boolean, default: false },
  // Password reset fields
  passwordResetOtp: String,
  passwordResetOtpExpires: Date,
  profilePicture: { type: String, default: '' }, // file path or URL

}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);
