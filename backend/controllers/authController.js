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
    body: { ...req.body, password: '[HIDDEN]' },
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
    const existingUser = await User.findOne({ email: email.toLowerCase() });
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

    let user = existingUser || new User({ 
      name, 
      email: email.toLowerCase(), 
      role: role || 'client' 
    });
    
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
      html: `
        <h2>Welcome to Nexus AI Chatbot!</h2>
        <p>Thank you for registering. Your verification code is:</p>
        <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code is valid for 10 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
      text: `Welcome to Nexus AI Chatbot! Your OTP code is ${otp}. It is valid for 10 minutes.`,
    });
    console.log('✅ [AUTH] OTP email sent successfully');

    // ✅ RETURN SUCCESS WITHOUT TOKEN - USER MUST VERIFY EMAIL FIRST
    res.status(201).json({ 
      success: true,
      message: 'Registration successful! Please check your email for the verification code.',
      requiresVerification: true,
      email: email
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
  console.log('🔶 [AUTH] Login request:', {
    email: req.body.email,
    timestamp: new Date().toISOString()
  });

  const { email, password } = req.body;
  
  try {
    if (!email || !password) {
      console.log('❌ [AUTH] Missing credentials');
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ [AUTH] User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // ✅ USE bcryptjs INSTEAD OF bcrypt
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ [AUTH] Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      console.log('⚠️ [AUTH] Email not verified:', email);
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // ✅ ENSURE JWT_SECRET EXISTS
    if (!process.env.JWT_SECRET) {
      console.error('❌ [AUTH] JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // ✅ GENERATE JWT TOKEN WITH PROPER PAYLOAD
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('🔑 [AUTH] Token generated:', {
      userId: user._id,
      tokenLength: token.length,
      payload: tokenPayload
    });

    // ✅ ENSURE CONSISTENT USER DATA STRUCTURE
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      profilePicture: user.profilePicture || null,
      createdAt: user.createdAt
    };

    console.log('✅ [AUTH] Login successful:', {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    // ✅ RETURN CONSISTENT RESPONSE STRUCTURE
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('❌ [AUTH] Login Error:', error);
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

// ✅ SEND PASSWORD RESET OTP FUNCTION
export const sendPasswordResetOtp = async (req, res) => {
  console.log('🔶 [AUTH] Password reset OTP request:', {
    email: req.body.email,
    timestamp: new Date().toISOString()
  });

  const { email } = req.body;
  
  try {
    if (!email) {
      console.log('❌ [AUTH] Missing email for password reset');
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ [AUTH] User not found for password reset:', email);
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address'
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      console.log('⚠️ [AUTH] User not verified for password reset:', email);
      return res.status(400).json({
        success: false,
        message: 'Please verify your email first before resetting password'
      });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    console.log('🔢 [AUTH] Generated password reset OTP:', otp);

    // Update user with password reset OTP
    user.passwordResetOtp = otp;
    user.passwordResetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    console.log('📧 [AUTH] Sending password reset OTP email to:', email);
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Password Reset - Nexus AI Chatbot',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Your verification code is:</p>
        <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code is valid for 10 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
      `,
      text: `Password Reset Request - Your OTP code is ${otp}. It is valid for 10 minutes.`,
    });
    console.log('✅ [AUTH] Password reset OTP email sent successfully');

    res.status(200).json({ 
      success: true,
      message: 'Password reset OTP sent to your email successfully!'
    });

  } catch (error) {
    console.error('❌ [AUTH] Send Password Reset OTP Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while sending password reset OTP' 
    });
  }
};

// ✅ RESET PASSWORD WITH OTP FUNCTION
export const resetPasswordWithOtp = async (req, res) => {
  console.log('🔶 [AUTH] Reset password with OTP request:', {
    email: req.body.email,
    timestamp: new Date().toISOString()
  });

  const { email, otp, newPassword } = req.body;
  
  try {
    if (!email || !otp || !newPassword) {
      console.log('❌ [AUTH] Missing required fields for password reset');
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required'
      });
    }

    if (newPassword.length < 6) {
      console.log('❌ [AUTH] Invalid password length for reset');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ [AUTH] User not found for password reset:', email);
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address'
      });
    }

    // Check OTP
    if (!user.passwordResetOtp || user.passwordResetOtp !== otp) {
      console.log('❌ [AUTH] Invalid OTP for password reset:', {
        provided: otp,
        expected: user.passwordResetOtp
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code'
      });
    }

    // Check OTP expiration
    if (!user.passwordResetOtpExpires || user.passwordResetOtpExpires < new Date()) {
      console.log('❌ [AUTH] Expired OTP for password reset');
      return res.status(400).json({
        success: false,
        message: 'OTP code has expired. Please request a new one.'
      });
    }

    // Hash new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    // Update user password and clear OTP fields
    user.password = hashedPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    await user.save();

    console.log('✅ [AUTH] Password reset successful for user:', email);

    res.status(200).json({ 
      success: true,
      message: 'Password reset successfully! You can now login with your new password.'
    });

  } catch (error) {
    console.error('❌ [AUTH] Reset Password Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while resetting password' 
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
    file: req.file ? { originalname: req.file.originalname, size: req.file.size } : 'No file',
    timestamp: new Date().toISOString()
  });

  const { name, email, removePhoto } = req.body;
  try {
    const user = req.user;
    console.log('🔍 [AUTH] Current user data:', {
      id: user?._id,
      currentName: user?.name,
      currentEmail: user?.email,
      currentProfilePicture: user?.profilePicture,
      newName: name,
      newEmail: email,
      removePhoto: removePhoto
    });

    if (!user) {
      console.log('❌ [AUTH] User not found for update');
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update basic fields
    if (name) user.name = name;
    if (email) user.email = email;

    // Handle photo removal
    if (removePhoto === true || removePhoto === 'true') {
      console.log('🗑️ [AUTH] Removing profile photo');
      user.profilePicture = null;
    }

    // Handle photo upload
    if (req.file) {
      console.log('📸 [AUTH] New photo uploaded:', req.file.path);
      user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    }

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