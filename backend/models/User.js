import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: true, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  otp: String,
  otpExpires: Date,
  isVerified: { type: Boolean, default: false },
  profilePicture: { type: String, default: '' }, // file path or URL

});

export default mongoose.model('User', userSchema);
