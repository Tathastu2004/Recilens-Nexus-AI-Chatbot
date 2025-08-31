import express from 'express';
import { requireAuth, attachUser, requireAdmin } from '../middleware/clerkAuth.js';
import { uploadProfilePic } from '../middleware/uploadMiddleware.js';
import { 
  getUserProfile, 
  updateUserProfile, 
  deleteProfilePhoto,
  handleClerkWebhook 
} from '../controllers/clerkController.js';
import User from '../models/User.js';

const router = express.Router();

// ✅ WEBHOOK ENDPOINT (no auth required, raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), handleClerkWebhook);

// ✅ HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'clerk-auth',
    timestamp: new Date().toISOString()
  });
});

// ✅ APPLY AUTH MIDDLEWARE TO ALL PROTECTED ROUTES
router.use(requireAuth);
router.use(attachUser);

// ✅ USER PROFILE ROUTES
router.get('/profile', getUserProfile);

// ✅ UPDATE PROFILE - Support both with and without file upload
router.put('/profile', (req, res, next) => {
  // Check if this is a multipart request (file upload)
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.includes('multipart/form-data')) {
    // Use upload middleware for file uploads
    uploadProfilePic.single('photo')(req, res, next);
  } else {
    // Skip upload middleware for JSON requests
    next();
  }
}, updateUserProfile);

router.delete('/profile/photo', deleteProfilePhoto);

// ✅ ADMIN ROUTES
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('-__v')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ [CLERK ROUTES] Admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// ✅ PROMOTE USER TO ADMIN
router.put('/admin/users/:userId/promote', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role: 'admin' },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User promoted to admin',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to promote user'
    });
  }
});

export default router;