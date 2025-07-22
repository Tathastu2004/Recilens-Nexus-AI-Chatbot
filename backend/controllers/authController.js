import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import transporter from '../config/nodemailer.js';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 📌 Register new user & send OTP
export const registerUser = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ message: 'User already registered and verified' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const otp = generateOTP();

    let user = existingUser || new User({ email, role: role || 'client' });
    user.password = hashedPassword;
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.isVerified = false;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Verify your email for Nexus AI Chatbot',
      text: `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    });

    res.status(201).json({ message: 'OTP sent. Please verify your email.' });

  } catch (error) {
    console.error('Register Error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Verify OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });

  } catch (error) {
    console.error('OTP Verification Error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Resend OTP
export const resendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Resent OTP for Nexus AI Chatbot',
      text: `Your new OTP code is ${otp}. It is valid for 10 minutes.`,
    });

    res.status(200).json({ message: 'OTP resent successfully' });

  } catch (error) {
    console.error('Resend OTP Error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Login with JWT
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || !user.isVerified) {
      return res.status(400).json({ message: 'Email not verified or user not found' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ message: 'Login successful', token, role: user.role });

  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Sign Out (Frontend should handle token removal)
export const logoutUser = async (req, res) => {
  res.status(200).json({ message: 'Sign out successful (handled on client)' });
};
