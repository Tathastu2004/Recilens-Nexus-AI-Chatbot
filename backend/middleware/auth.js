import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  try {
    // ✅ GET TOKEN FROM MULTIPLE SOURCES
    let token = req.header('Authorization');
    
    console.log('🔑 [AUTH MIDDLEWARE] Raw Authorization header:', token);
    
    if (!token) {
      console.log('❌ [AUTH MIDDLEWARE] No Authorization header found');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // ✅ EXTRACT TOKEN FROM BEARER FORMAT
    if (token.startsWith('Bearer ')) {
      token = token.slice(7); // Remove 'Bearer ' prefix
    }

    console.log('🔍 [AUTH MIDDLEWARE] Extracted token:', token ? token.substring(0, 20) + '...' : 'undefined');

    if (!token || token === 'undefined' || token === 'null') {
      console.log('❌ [AUTH MIDDLEWARE] Invalid token format');
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // ✅ VERIFY JWT TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ [AUTH MIDDLEWARE] Token verified for user:', decoded.userId);

    // ✅ GET USER FROM DATABASE
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.log('❌ [AUTH MIDDLEWARE] User not found:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found.'
      });
    }

    // ✅ ATTACH USER TO REQUEST
    req.user = user;
    req.userId = user._id;
    
    console.log('👤 [AUTH MIDDLEWARE] User authenticated:', {
      id: user._id,
      email: user.email,
      role: user.role
    });

    next();
  } catch (error) {
    console.error('❌ [AUTH MIDDLEWARE] JWT Verification Error:', error.message);
    
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