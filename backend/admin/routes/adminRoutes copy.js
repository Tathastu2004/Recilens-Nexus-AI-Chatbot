import express from 'express';
import { requireAuth, attachUser, requireAdmin, requireSuperAdmin, requireRoleManagementPermission } from '../../middleware/clerkAuth.js';

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
      role: req.user.role,
      isSuperAdmin: req.user.role === 'super-admin'
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
        createdAt: user.createdAt,
        canBeManaged: user.canBeManagedBy(req.user.role)
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

// ✅ PROMOTE USER TO ADMIN (ENHANCED WITH ROLE CHECKS)
router.put('/users/:userId/promote', requireRoleManagementPermission, async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    const { role = 'admin' } = req.body; // Default to admin if no role specified
    
    // Validate role
    if (!['admin', 'super-admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin or super-admin'
      });
    }

    // Only super admin can create super admins
    if (role === 'super-admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can promote users to super admin'
      });
    }

    // Find target user
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if current user can manage target user
    if (!targetUser.canBeManagedBy(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot manage this user\'s role'
      });
    }

    // Prevent modifying the original super admin
    if (targetUser.email === 'apurvsrivastava1510@gmail.com' && req.user.email !== 'apurvsrivastava1510@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify the original super admin'
      });
    }

    // Update user role
    targetUser.role = role;
    await targetUser.save();
    
    res.json({
      success: true,
      message: `User promoted to ${role}`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Promote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote user'
    });
  }
});

// ✅ DEMOTE USER (ENHANCED WITH ROLE CHECKS)
router.put('/users/:userId/demote', requireRoleManagementPermission, async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    const { role = 'client' } = req.body; // Default to client if no role specified
    
    // Find target user
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-demotion
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot demote yourself'
      });
    }

    // Prevent modifying the original super admin
    if (targetUser.email === 'apurvsrivastava1510@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Cannot demote the original super admin'
      });
    }

    // Check if current user can manage target user
    if (!targetUser.canBeManagedBy(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot manage this user\'s role'
      });
    }

    // Only super admin can demote super admins
    if (targetUser.role === 'super-admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can demote super admins'
      });
    }

    // Update user role
    targetUser.role = role;
    await targetUser.save();
    
    res.json({
      success: true,
      message: `User role changed to ${role}`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Demote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change user role'
    });
  }
});

// ✅ SUPER ADMIN ONLY: GET ALL ADMINS
router.get('/admins', requireSuperAdmin, async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    
    const admins = await User.find({ 
      role: { $in: ['admin', 'super-admin'] },
      isActive: true 
    })
      .select('-__v')
      .sort({ role: -1, createdAt: -1 }); // Super admins first
    
    res.json({
      success: true,
      admins: admins.map(admin => ({
        _id: admin._id,
        clerkId: admin.clerkId,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        isOriginalSuperAdmin: admin.email === 'apurvsrivastava1510@gmail.com'
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
});

// ✅ ANALYTICS ROUTES (EXISTING)
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
        }, {}),
        currentUserRole: req.user.role
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

// ✅ SYSTEM INFO (ENHANCED)
router.get('/system/info', (req, res) => {
  res.json({
    success: true,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development'
    },
    user: {
      role: req.user.role,
      isSuperAdmin: req.user.role === 'super-admin',
      permissions: {
        canManageUsers: ['admin', 'super-admin'].includes(req.user.role),
        canManageAdmins: req.user.role === 'super-admin',
        canCreateSuperAdmins: req.user.role === 'super-admin'
      }
    }
  });
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

console.log('✅ [ADMIN ROUTES] Admin routes initialized successfully');

export default router;
