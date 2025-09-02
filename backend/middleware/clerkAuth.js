import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import User from '../models/User.js';

// ✅ CLERK AUTH MIDDLEWARE
export const requireAuth = ClerkExpressRequireAuth({
  onError: (error) => {
    console.error('❌ [CLERK AUTH] Authentication failed:', error.message);
    return {
      status: 401,
      message: 'Authentication required'
    };
  }
});

// ✅ ATTACH USER MIDDLEWARE
export const attachUser = async (req, res, next) => {
  try {
    console.log('🔍 [CLERK AUTH] Attaching user...', {
      hasAuth: !!req.auth,
      userId: req.auth?.userId,
      sessionClaims: req.auth?.sessionClaims ? Object.keys(req.auth.sessionClaims) : null
    });

    if (!req.auth?.userId) {
      console.error('❌ [CLERK AUTH] No user ID found in auth');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find or create user in database
    let user = await User.findOne({ clerkId: req.auth.userId });
    
    if (!user) {
      console.log('👤 [CLERK AUTH] Creating new user from Clerk data');
      
      // Get email from session claims
      const email = req.auth.sessionClaims?.email || '';
      const firstName = req.auth.sessionClaims?.given_name || '';
      const lastName = req.auth.sessionClaims?.family_name || '';
      
      user = new User({
        clerkId: req.auth.userId,
        email: email,
        name: `${firstName} ${lastName}`.trim() || 'User',
        role: email === 'apurvsrivastava1510@gmail.com' ? 'super-admin' : 'client', // ✅ Auto-assign super-admin
        isActive: true
      });
      await user.save();
      console.log('✅ [CLERK AUTH] User created:', user._id, 'Role:', user.role);
    } else if (user.email === 'apurvsrivastava1510@gmail.com' && user.role !== 'super-admin') {
      // ✅ Ensure super admin role is always set for the designated email
      user.role = 'super-admin';
      await user.save();
      console.log('✅ [CLERK AUTH] Updated user to super-admin role');
    }

    req.user = user;
    console.log('✅ [CLERK AUTH] User attached:', {
      id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role
    });

    next();
  } catch (error) {
    console.error('❌ [CLERK AUTH] Error attaching user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ ADMIN MIDDLEWARE
export const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ✅ SUPER ADMIN MIDDLEWARE
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super-admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }
  next();
};

// ✅ ROLE MANAGEMENT PERMISSION MIDDLEWARE
export const requireRoleManagementPermission = (req, res, next) => {
  if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required for role management'
    });
  }
  next();
};