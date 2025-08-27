import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import User from '../models/User.js';

// 🔐 Admin whitelist
const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

// ✅ CLERK GLOBAL MIDDLEWARE
export const clerkAuth = clerkMiddleware({
  debug: process.env.NODE_ENV === 'development'
});

// ✅ REQUIRE AUTHENTICATION
export const verifyToken = requireAuth();

// ✅ ATTACH USER MIDDLEWARE (FOR ROUTES THAT NEED USER DATA)
export const attachUserMiddleware = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    
    if (!auth?.userId) {
      return res.status(401).json({
        success: false,
        message: 'No authenticated user found'
      });
    }

    // Find user in MongoDB (should exist due to webhook)
    const user = await User.findOne({ clerkUserId: auth.userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in database. Please contact support.'
      });
    }

    // Attach user to request
    req.user = user;
    req.auth = auth;
    
    next();

  } catch (error) {
    console.error('❌ [ATTACH USER] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user data'
    });
  }
};

// ✅ ROLE-BASED MIDDLEWARE
export const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super-admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied: Admin privileges required' 
    });
  }
  next();
};

export const requireClient = (req, res, next) => {
  if (!req.user || req.user.role !== 'client') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied: Client role required' 
    });
  }
  next();
};
