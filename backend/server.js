import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import compression from 'compression';
import http from 'http';
import { EventEmitter } from 'events';

// ✅ INCREASE EVENT EMITTER LIMIT
EventEmitter.defaultMaxListeners = 15;

// ✅ IMPORT UPLOAD MIDDLEWARE FIRST
import { handleUploadError } from './middleware/uploadMiddleware.js';

import './config/cloudinary.js';
import connectDB from './config/mongodb.js';

dotenv.config();

console.log('🚀 [SERVER] Starting server with Clerk authentication...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
if (!fs.existsSync('/tmp')) {
  fs.mkdirSync('/tmp', { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression({ threshold: 0 }));
const server = http.createServer(app);

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}
connectDB();

// ✅ CORS CONFIGURATION
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// ✅ WEBHOOK MIDDLEWARE (must be before JSON parsing)
app.use('/api/clerk/webhook', express.raw({ type: 'application/json' }));

// ✅ REGULAR JSON PARSING
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ SERVE STATIC FILES
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'running',
    auth: 'clerk'
  });
});

// ✅ ROOT ROUTE
app.get('/', (req, res) => {
  res.send('Welcome to the Nexus AI Chatbot Backend with Clerk Authentication!');
});

// ✅ IMPORT AND USE ROUTES WITH ERROR HANDLING
try {
  const clerkRoutes = await import('./routes/clerkRoute.js');
  app.use('/api/clerk', clerkRoutes.default);
  console.log('✅ [SERVER] Clerk routes loaded');
} catch (error) {
  console.error('❌ [SERVER] Failed to load clerk routes:', error.message);
}

try {
  const chatRoutes = await import('./routes/chatRoutes.js');
  app.use('/api/chat', chatRoutes.default);
  console.log('✅ [SERVER] Chat routes loaded');
} catch (error) {
  console.error('❌ [SERVER] Failed to load chat routes:', error.message);
}

try {
  const feedbackRoutes = await import('./routes/feedbackRoute.js');
  app.use('/api/feedback', feedbackRoutes.default);
  console.log('✅ [SERVER] Feedback routes loaded');
} catch (error) {
  console.error('❌ [SERVER] Failed to load feedback routes:', error.message);
}

// ✅ ADMIN ROUTES WITH SAFER LOADING
try {
  const adminRoutes = await import('./admin/routes/adminRoutes.js');
  app.use('/api/admin', adminRoutes.default);
  console.log('✅ [SERVER] Admin routes loaded at /api/admin');
} catch (error) {
  console.error('❌ [SERVER] Failed to load admin routes:', error.message);
  console.error('❌ [SERVER] Admin functionality will be disabled');
}

// ✅ LEGACY AUTH ROUTES (for backward compatibility)
app.use('/api/auth', async (req, res, next) => {
  try {
    const clerkRoutes = await import('./routes/clerkRoute.js');
    clerkRoutes.default(req, res, next);
  } catch (error) {
    console.error('❌ [SERVER] Legacy auth route error:', error.message);
    res.status(500).json({ success: false, message: 'Auth service unavailable' });
  }
});

// ✅ GLOBAL UPLOAD ERROR HANDLER
app.use(handleUploadError);

// ✅ GLOBAL ERROR HANDLER
app.use((error, req, res, next) => {
  console.error('❌ [SERVER] Global error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ✅ 404 HANDLER
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT} with Clerk authentication`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Clerk webhook: http://localhost:${PORT}/api/clerk/webhook`);
});

export default app;
