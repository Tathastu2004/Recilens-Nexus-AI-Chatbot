import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import compression from 'compression';

import './config/cloudinary.js';
import connectDB from './config/mongodb.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import adminRoutes from './admin/routes/adminRoutes.js';
import feedbackRoutes from './routes/feedbackRoute.js';

console.log('🚀 [SERVER] Starting server initialization...');
console.log('🔑 [ENV CHECK] Environment variables status:', {
  MONGO_URI: process.env.MONGO_URI ? 'Set' : 'Missing',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Missing',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
});

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
if (!fs.existsSync('/tmp')) {
  fs.mkdirSync('/tmp', { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CLERK MIDDLEWARE (GLOBAL) - MUST BE FIRST
app.use(clerkMiddleware());

// ✅ CORS CONFIGURATION
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// ✅ Apply compression
app.use(compression({ threshold: 0 }));

// ✅ MongoDB connection
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}
connectDB();

// ✅ BODY PARSING (IMPORTANT: AFTER CORS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ✅ HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// ✅ Routes
app.get('/', (req, res) => {
  res.send('Welcome to the Recilens Nexus AI Chatbot Backend!');
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use("/api/feedback", feedbackRoutes);

// ✅ ERROR HANDLING
app.use((error, req, res, next) => {
  console.error('Server Error:', error.message);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// ✅ 404 HANDLER
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/api/auth/webhooks/sync`);
});