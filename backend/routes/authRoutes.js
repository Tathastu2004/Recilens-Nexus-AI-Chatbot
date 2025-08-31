import express from 'express';
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  logoutUser,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  getUserProfile,
  updateUserProfile
} from '../controllers/authController.js';
import { } from '../middleware/authMiddleware.js';
import { uploadProfilePic } from '../middleware/uploadMiddleware.js';
import {
  uploadProfilePhoto,
  getProfilePhoto,
  deleteProfilePhoto
} from '../controllers/userPhotoController.js';
import { handleClerkWebhook } from '../controllers/clerkWebhookController.js';
import { requireAuth, attachUser, requireAdmin } from '../middleware/clerkAuth.js';
import User from '../models/User.js';

const router = express.Router();
router.use(attachUser);

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/getprofile',  getUserProfile);
router.put('/updateprofile',  uploadProfilePic.single('photo'), updateUserProfile);
router.post('/forgot-password', sendPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);

// ✅ ADD THIS TEST ROUTE
router.get('/test-auth',  (req, res) => {
  res.json({
    success: true,
    message: 'Token verification successful',
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Webhook endpoint (no auth required)
router.post('/webhook', express.raw({ type: 'application/json' }), handleClerkWebhook);

// Get user profile
router.get('/profile', requireAuth, attachUser, async (req, res) => {
  try {
    // const data = {
    //     _id: req.user._id,
    //     clerkId: req.user.clerkId,
    //     email: req.user.email,
    //     name: req.user.name,
    //     role: req.user.role,
    //     profilePicture: req.user.profilePicture,
    //     isActive: req.user.isActive,
    //     createdAt: req.user.createdAt
    //   }

    //   console.log('📋 [CLERK ROUTE] Profile request for user:', data);
    res.json({
      success: true,
      user: {
        _id: req.user._id,
        clerkId: req.user.clerkId,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        profilePicture: req.user.profilePicture,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt
      }

       
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Update user profile
router.put('/profile', requireAuth, attachUser, async (req, res) => {
  try {
    const { name, role } = req.body;
    
    if (name) req.user.name = name;
    if (role && ['admin', 'super-admin'].includes(req.user.role)) {
      // Only admins can change roles
      req.user.role = role;
    }
    
    await req.user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// Admin endpoints
router.get('/admin/users', requireAuth, attachUser, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-__v');
    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

export default router;
