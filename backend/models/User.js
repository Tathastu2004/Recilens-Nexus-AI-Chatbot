import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  otp: String,
  otpExpires: Date,
  isVerified: { type: Boolean, default: false },
});

export default mongoose.model('User', userSchema);
