import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
dotenv.config();

export const verifyToken = async (req, res, next) => {
  console.log('JWT_SECRET:', process.env.JWT_SECRET); // ✅ Log 1

  const authHeader = req.headers.authorization;
  console.log('authHeader:', authHeader); // ✅ Log 1

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Extracted Token:', token); // ✅ Log 2

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token Decoded:', decoded); // ✅ Log 3

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message); // ✅ Log 4
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};


// Middleware for role: admin only
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
  next();
};

// Middleware for role: client only (optional)
export const requireClient = (req, res, next) => {
  if (!req.user || req.user.role !== 'client') {
    return res.status(403).json({ message: 'Access denied: Clients only' });
  }
  next();
};

