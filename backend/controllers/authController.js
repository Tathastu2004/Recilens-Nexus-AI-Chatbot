import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import transporter from '../config/nodemailer.js';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 🔐 Whitelisted emails allowed to register as admin
const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

// 📌 Register new user & send OTP
export const registerUser = async (req, res) => {
  console.log('Registering user:', req.body);
  const { name, email, password, role } = req.body;
  try {
    // ❌ Block unauthorized admin registrations
    if (role === 'admin' && !allowedAdminEmails.includes(email)) {
      return res.status(403).json({ message: 'You are not authorized to register as admin' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ message: 'User already registered and verified' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const otp = generateOTP();

    let user = existingUser || new User({ name, email, role: role || 'client' });
    user.name = name;
    user.password = hashedPassword;
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.isVerified = false;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Verify your email for Nexus AI Chatbot',
      text: `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    });

    res.status(201).json({ 
      success: true, // Add this
      message: 'OTP sent. Please verify your email.' 
    });

  } catch (error) {
    console.error('Register Error:', error.message);
    res.status(500).json({ 
      success: false, // Add this
      message: 'Server error during registration' 
    });
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

    res.status(200).json({ 
      success: true, // Add this
      message: 'Email verified successfully' 
    });

  } catch (error) {
    console.error('OTP Verification Error:', error.message);
    res.status(500).json({ 
      success: false, // Add this
      message: 'Server error during OTP verification' 
    });
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

    res.status(200).json({ 
      success: true, // Add this
      message: 'OTP resent successfully' 
    });

  } catch (error) {
    console.error('Resend OTP Error:', error.message);
    res.status(500).json({ 
      success: false, // Add this
      message: 'Server error during OTP resend' 
    });
  }
};

// 📌 Login with JWT
export const loginUser = async (req, res) => {
  //  console.log('Headers:', req.headers);
  console.log('Raw req.body:', req.body);

   if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ message: 'Missing or malformed request body' });
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || !user.isVerified) {
      return res.status(400).json({ message: 'Email not verified or user not found' });
    }

    const isMatch = bcryptjs.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      role: user.role
    });

  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// 📌 Sign Out (frontend responsibility)
export const logoutUser = async (req, res) => {
  res.status(200).json({ message: 'Sign out successful (handled on client)' });
};

// 📌 Send Password Reset OTP
 export const sendPasswordResetOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) {
      return res.status(404).json({ message: 'No verified account found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Reset Your Password - Nexus AI Chatbot',
      text: `Your OTP for password reset is ${otp}. It is valid for 10 minutes.`,
    });

    res.status(200).json({ 
      success: true, // Add this
      message: 'OTP sent to your email for password reset' 
    });

  } catch (error) {
    console.error('Send Reset OTP Error:', error.message);
    res.status(500).json({ 
      success: false, // Add this
      message: 'Server error during password reset request' 
    });
  }
};
// 📌 Reset Password using OTP
export const resetPasswordWithOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = await bcryptjs.hash(newPassword, 10);
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({ 
      success: true,
      message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset Password Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
};
// 📌 Get User Profil
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture
    });

  } catch (error) {
    console.error('Get Profile Error:', error.message);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};
//upadte user profile
export const updateUserProfile = async (req, res) => {
  const { name, email } = req.body;
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name || user.name;
    user.email = email || user.email;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Update Profile Error:', error.message);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
}