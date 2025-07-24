import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import transporter from '../config/nodemailer.js';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 🔐 Whitelisted emails allowed to register as admin
const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

// 📌 Register new user & send OTP
export const registerUser = async (req, res) => {
  console.log('🔶 [AUTH] Register attempt:', {
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  const { name, email, password, role } = req.body;
  try {
    console.log('🔍 [AUTH] Checking admin authorization for email:', email);
    
    // ❌ Block unauthorized admin registrations
    if (role === 'admin' && !allowedAdminEmails.includes(email)) {
      console.log('❌ [AUTH] Unauthorized admin registration attempt:', email);
      return res.status(403).json({ 
        success: false,
        message: 'You are not authorized to register as admin' 
      });
    }

    console.log('🔍 [AUTH] Checking existing user for email:', email);
    const existingUser = await User.findOne({ email });
    console.log('🔍 [AUTH] Existing user found:', !!existingUser, existingUser ? {
      id: existingUser._id,
      email: existingUser.email,
      isVerified: existingUser.isVerified
    } : 'None');

    if (existingUser && existingUser.isVerified) {
      console.log('❌ [AUTH] User already registered and verified:', email);
      return res.status(400).json({ 
        success: false,
        message: 'User already registered and verified' 
      });
    }

    console.log('🔐 [AUTH] Hashing password...');
    const hashedPassword = await bcryptjs.hash(password, 10);
    const otp = generateOTP();
    console.log('🔢 [AUTH] Generated OTP:', otp);

    let user = existingUser || new User({ name, email, role: role || 'client' });
    user.name = name;
    user.password = hashedPassword;
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.isVerified = false;

    console.log('💾 [AUTH] Saving user:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    });

    await user.save();
    console.log('✅ [AUTH] User saved successfully');

    console.log('📧 [AUTH] Sending OTP email to:', email);
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Verify your email for Nexus AI Chatbot',
      text: `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    });
    console.log('✅ [AUTH] OTP email sent successfully');

    res.status(201).json({ 
      success: true,
      message: 'OTP sent. Please verify your email.' 
    });

  } catch (error) {
    console.error('❌ [AUTH] Register Error:', error.message);
    console.error('❌ [AUTH] Register Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration' 
    });
  }
};

// 📌 Verify OTP
export const verifyOtp = async (req, res) => {
  console.log('🔶 [AUTH] OTP verification attempt:', {
    body: req.body,
    timestamp: new Date().toISOString()
  });

  const { email, otp } = req.body;
  try {
    console.log('🔍 [AUTH] Finding user for OTP verification:', email);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ [AUTH] User not found for OTP verification:', email);
      return res.status(400).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('🔍 [AUTH] User found for OTP verification:', {
      id: user._id,
      email: user.email,
      storedOtp: user.otp,
      providedOtp: otp,
      otpExpires: user.otpExpires,
      currentTime: new Date(),
      isExpired: user.otpExpires < Date.now()
    });

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      console.log('❌ [AUTH] Invalid or expired OTP:', {
        otpMatch: user.otp === otp,
        isExpired: user.otpExpires < Date.now()
      });
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    
    console.log('💾 [AUTH] Updating user verification status...');
    await user.save();
    console.log('✅ [AUTH] User verified successfully:', {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified
    });

    res.status(200).json({ 
      success: true,
      message: 'Email verified successfully' 
    });

  } catch (error) {
    console.error('❌ [AUTH] OTP Verification Error:', error.message);
    console.error('❌ [AUTH] OTP Verification Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error during OTP verification' 
    });
  }
};

// 📌 Resend OTP
export const resendOtp = async (req, res) => {
  console.log('🔶 [AUTH] Resend OTP attempt:', {
    body: req.body,
    timestamp: new Date().toISOString()
  });

  const { email } = req.body;
  try {
    console.log('🔍 [AUTH] Finding user for OTP resend:', email);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ [AUTH] User not found for OTP resend:', email);
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const otp = generateOTP();
    console.log('🔢 [AUTH] Generated new OTP for resend:', otp);

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    console.log('💾 [AUTH] Updating user with new OTP...');
    await user.save();

    console.log('📧 [AUTH] Sending resend OTP email to:', email);
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Resent OTP for Nexus AI Chatbot',
      text: `Your new OTP code is ${otp}. It is valid for 10 minutes.`,
    });
    console.log('✅ [AUTH] Resend OTP email sent successfully');

    res.status(200).json({ 
      success: true,
      message: 'OTP resent successfully' 
    });

  } catch (error) {
    console.error('❌ [AUTH] Resend OTP Error:', error.message);
    console.error('❌ [AUTH] Resend OTP Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error during OTP resend' 
    });
  }
};

// 📌 Login with JWT
export const loginUser = async (req, res) => {
  console.log('🔶 [AUTH] Login attempt:', {
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  if (!req.body || typeof req.body !== 'object') {
    console.log('❌ [AUTH] Missing or malformed request body');
    return res.status(400).json({ 
      success: false,
      message: 'Missing or malformed request body' 
    });
  }

  const { email, password } = req.body;
  console.log('🔍 [AUTH] Login credentials received:', { email, hasPassword: !!password });

  try {
    console.log('🔍 [AUTH] Finding user for login:', email);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ [AUTH] User not found for login:', email);
      return res.status(400).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('🔍 [AUTH] User found for login:', {
      id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      hasPassword: !!user.password,
      name: user.name,
      profilePicture: user.profilePicture
    });

    if (!user.isVerified) {
      console.log('❌ [AUTH] User not verified for login:', email);
      return res.status(400).json({ 
        success: false,
        message: 'Email not verified' 
      });
    }

    console.log('🔐 [AUTH] Comparing passwords...');
    const isMatch = await bcryptjs.compare(password, user.password);
    console.log('🔐 [AUTH] Password match result:', isMatch);

    if (!isMatch) {
      console.log('❌ [AUTH] Invalid credentials for:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    console.log('🎟️ [AUTH] Generating JWT token...');
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('🎟️ [AUTH] JWT token generated:', token.substring(0, 20) + '...');

    const responseData = {
      success: true,
      message: 'Login successful',
      token,
      role: user.role,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      }
    };

    console.log('✅ [AUTH] Login successful, sending response:', {
      success: responseData.success,
      role: responseData.role,
      user: responseData.user
    });

    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [AUTH] Login Error:', error.message);
    console.error('❌ [AUTH] Login Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};

// 📌 Sign Out (frontend responsibility)
export const logoutUser = async (req, res) => {
  console.log('🔶 [AUTH] Logout request:', {
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });
  
  res.status(200).json({ 
    success: true,
    message: 'Sign out successful (handled on client)' 
  });
};

// 📌 Send Password Reset OTP
export const sendPasswordResetOtp = async (req, res) => {
  console.log('🔶 [AUTH] Password reset OTP request:', {
    body: req.body,
    timestamp: new Date().toISOString()
  });

  const { email } = req.body;
  try {
    console.log('🔍 [AUTH] Finding user for password reset:', email);
    const user = await User.findOne({ email });
    
    if (!user || !user.isVerified) {
      console.log('❌ [AUTH] No verified user found for password reset:', email);
      return res.status(404).json({ 
        success: false,
        message: 'No verified account found with this email' 
      });
    }

    console.log('🔢 [AUTH] Generating password reset OTP...');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔢 [AUTH] Password reset OTP generated:', otp);

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    console.log('💾 [AUTH] Saving password reset OTP...');
    await user.save();

    console.log('📧 [AUTH] Sending password reset email to:', email);
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Reset Your Password - Nexus AI Chatbot',
      text: `Your OTP for password reset is ${otp}. It is valid for 10 minutes.`,
    });
    console.log('✅ [AUTH] Password reset email sent successfully');

    res.status(200).json({ 
      success: true,
      message: 'OTP sent to your email for password reset' 
    });

  } catch (error) {
    console.error('❌ [AUTH] Send Reset OTP Error:', error.message);
    console.error('❌ [AUTH] Send Reset OTP Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error during password reset request' 
    });
  }
};

// 📌 Reset Password using OTP
export const resetPasswordWithOtp = async (req, res) => {
  console.log('🔶 [AUTH] Password reset with OTP attempt:', {
    body: { ...req.body, newPassword: '[HIDDEN]' },
    timestamp: new Date().toISOString()
  });

  const { email, otp, newPassword } = req.body;
  try {
    console.log('🔍 [AUTH] Finding user for password reset with OTP:', email);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ [AUTH] User not found for password reset:', email);
      return res.status(400).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('🔍 [AUTH] Validating OTP for password reset:', {
      storedOtp: user.otp,
      providedOtp: otp,
      otpExpires: user.otpExpires,
      currentTime: new Date(),
      isExpired: user.otpExpires < Date.now()
    });

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      console.log('❌ [AUTH] Invalid or expired OTP for password reset');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    console.log('🔐 [AUTH] Hashing new password...');
    user.password = await bcryptjs.hash(newPassword, 10);
    user.otp = null;
    user.otpExpires = null;
    
    console.log('💾 [AUTH] Saving password reset...');
    await user.save();
    console.log('✅ [AUTH] Password reset successfully');

    res.status(200).json({ 
      success: true,
      message: 'Password reset successfully' 
    });

  } catch (error) {
    console.error('❌ [AUTH] Reset Password Error:', error.message);
    console.error('❌ [AUTH] Reset Password Stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset' 
    });
  }
};

// 📌 Get User Profile
export const getUserProfile = async (req, res) => {
  console.log('🔶 [AUTH] Get profile request:', {
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });

  try {
    const user = req.user;
    console.log('🔍 [AUTH] User from middleware:', {
      id: user?._id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      isVerified: user?.isVerified,
      profilePicture: user?.profilePicture
    });

    if (!user) {
      console.log('❌ [AUTH] User not found in request');
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const responseData = {
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      }
    };

    console.log('✅ [AUTH] Sending profile response:', responseData);

    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [AUTH] Get Profile Error:', error.message);
    console.error('❌ [AUTH] Get Profile Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching profile' 
    });
  }
};

// 📌 Update user profile
export const updateUserProfile = async (req, res) => {
  console.log('🔶 [AUTH] Update profile request:', {
    userId: req.user?._id,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  const { name, email } = req.body;
  try {
    const user = req.user;
    console.log('🔍 [AUTH] Current user data:', {
      id: user?._id,
      currentName: user?.name,
      currentEmail: user?.email,
      newName: name,
      newEmail: email
    });

    if (!user) {
      console.log('❌ [AUTH] User not found for update');
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    console.log('💾 [AUTH] Saving updated user profile...');
    await user.save();

    const responseData = {
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      }
    };

    console.log('✅ [AUTH] Profile updated successfully:', responseData);

    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [AUTH] Update Profile Error:', error.message);
    console.error('❌ [AUTH] Update Profile Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating profile' 
    });
  }
};