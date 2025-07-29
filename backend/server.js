import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import Cloudinary config EARLY
import './config/cloudinary.js';

import connectDB from './config/mongodb.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './admin/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { registerChatSocket} from './sockets/chatSocket.js';
import chatRoutes from './routes/chatRoutes.js';
import compression from 'compression';




dotenv.config();

console.log('🚀 [SERVER] Starting server initialization...');
console.log('🔑 [ENV CHECK] Environment variables status:', {
  MONGO_URI: process.env.MONGO_URI ? 'Set' : 'Missing',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Missing',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
});

// Resolve __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
if (!fs.existsSync('/tmp')) {
  fs.mkdirSync('/tmp', { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression({ threshold: 0 }));


// ✅ Create HTTP server for socket.io
const server = http.createServer(app);

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // replace with frontend URL in prod
    methods: ['GET', 'POST']
  }
});

// ✅ MongoDB Connection
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not defined in .env file');
  process.exit(1);
}
connectDB();

// ✅ Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve uploaded files with CORS
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ✅ Routes
app.get('/', (req, res) => {
  res.send('Welcome to the Recilens Nexus AI Chatbot Backend!');
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);

// ✅ Start Socket.IO listeners
registerChatSocket(io);

// ✅ Launch server (IMPORTANT: use server.listen)
server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
