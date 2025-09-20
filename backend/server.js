import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import  connectDB  from "./config/mongodb.js";
import compression from 'compression';

// Import routes
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import feedbackRoute from "./routes/feedbackRoute.js";
import clerkRoutes from "./routes/clerkRoute.js";
import adminRoutes from "./admin/routes/adminRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// CORS configuration
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
}));

// Webhook middleware (must be before JSON parsing)
app.use('/api/clerk/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    message: "Recilens Nexus AI Chatbot Backend is running!",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Recilens Nexus AI Chatbot Backend is running!" });
});




// Other routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/feedback", feedbackRoute);
app.use("/api/clerk", clerkRoutes);
app.use("/api/admin", adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ message: "Internal server error", error: err.message });
});

// 404 handler
app.use("*", (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 Model management: http://localhost:${PORT}/api/admin/model`);
  
  // Test the routes
  console.log('\n📋 Available model management routes:');
  console.log('  - GET /api/admin/model/training-jobs');
  console.log('  - GET /api/admin/model/loaded');
  console.log('  - GET /api/admin/model/available-adapters');
  console.log('  - POST /api/admin/model/load-lora');
  console.log('  - POST /api/admin/model/unload');
});

export default app;
