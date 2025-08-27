// middleware/authMiddleware.js - TRADITIONAL JWT MIDDLEWARE
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  try {
    // ✅ GET TOKEN FROM AUTHORIZATION HEADER
    const authHeader = req.headers.authorization;
    console.log('🔑 [TRADITIONAL AUTH] Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [TRADITIONAL AUTH] No valid Bearer token found');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // ✅ EXTRACT TOKEN
    const token = authHeader.split(' ')[1];
    console.log('🔍 [TRADITIONAL AUTH] Token extracted, length:', token?.length || 0);

    if (!token || token === 'undefined' || token === 'null') {
      console.log('❌ [TRADITIONAL AUTH] Invalid token format');
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // ✅ VERIFY JWT TOKEN WITH YOUR SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ [TRADITIONAL AUTH] Token verified for user:', decoded.userId);

    // ✅ GET USER FROM DATABASE
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.log('❌ [TRADITIONAL AUTH] User not found:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found.'
      });
    }

    // ✅ ATTACH USER TO REQUEST
    req.user = user;
    req.userId = user._id;
    
    console.log('👤 [TRADITIONAL AUTH] User authenticated:', {
      id: user._id,
      email: user.email,
      role: user.role,
      authMethod: 'traditional'
    });

    next();
  } catch (error) {
    console.error('❌ [TRADITIONAL AUTH] JWT Verification Error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
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
