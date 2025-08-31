import express from 'express';
import { requireAuth, attachUser, requireAdmin } from '../../middleware/clerkAuth.js';

const router = express.Router();

console.log('🔧 [ADMIN ROUTES] Initializing admin routes...');

// ✅ SAFE IMPORT OF UPLOAD MIDDLEWARE
let uploadDataset;
try {
  const uploadModule = await import('../../middleware/uploadMiddleware.js');
  uploadDataset = uploadModule.uploadDataset;
  console.log('✅ [ADMIN ROUTES] Upload middleware loaded');
} catch (error) {
  console.error('❌ [ADMIN ROUTES] Failed to load upload middleware:', error.message);
}

// ✅ APPLY AUTH MIDDLEWARE
router.use(requireAuth);
router.use(attachUser);
router.use(requireAdmin);

// ✅ ADMIN HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'admin',
    user: {
      id: req.user._id,
      role: req.user.role
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ USER MANAGEMENT ROUTES
router.get('/users', async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    
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
    console.error('❌ [ADMIN] Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// ✅ PROMOTE USER TO ADMIN
router.put('/users/:userId/promote', async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    
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
    console.error('❌ [ADMIN] Promote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote user'
    });
  }
});

// ✅ DEMOTE USER
router.put('/users/:userId/demote', async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role: 'client' },
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
      message: 'User demoted to client',
      user
    });
  } catch (error) {
    console.error('❌ [ADMIN] Demote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to demote user'
    });
  }
});

// ✅ ANALYTICS ROUTES
router.get('/analytics/users', async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      isActive: true,
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });
    
    res.json({
      success: true,
      analytics: {
        totalUsers,
        newUsersThisMonth,
        usersByRole: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// ✅ DATASET UPLOAD (ONLY IF UPLOAD MIDDLEWARE IS AVAILABLE)
if (uploadDataset) {
  router.post('/datasets/upload', 
    uploadDataset.single('dataset'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No dataset file uploaded'
          });
        }

        console.log('📊 [ADMIN] Dataset upload:', {
          originalname: req.file.originalname,
          size: req.file.size,
          path: req.file.path
        });

        // Process dataset file here
        res.json({
          success: true,
          message: 'Dataset uploaded successfully',
          file: {
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path
          }
        });
      } catch (error) {
        console.error('❌ [ADMIN] Dataset upload error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to upload dataset'
        });
      }
    }
  );
} else {
  router.post('/datasets/upload', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Dataset upload service unavailable'
    });
  });
}

// ✅ SYSTEM INFO
router.get('/system/info', (req, res) => {
  res.json({
    success: true,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development'
    }
  });
});

console.log('✅ [ADMIN ROUTES] Admin routes initialized successfully');

export default router;
