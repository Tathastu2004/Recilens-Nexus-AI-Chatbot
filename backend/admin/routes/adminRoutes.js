import express from "express";
import {
  getSystemConfig,
  updateSystemConfig,
  getDashboardStats,
  getAnalytics,
  generateAnalytics,
  startModelTraining,
  getTrainingJobs,
  updateTrainingStatus,
  getAllUsers,
  getAllAdmins,
  promoteUserToAdmin,
  demoteAdminToClient,
  deleteUser,
  generateRealAnalytics,
  cancelTraining,
  getTrainingDetails,
  getModelStatus,
  loadModel,
  unloadModel,
  getLoadedModels,
  getFilteredTrainingJobs,
  searchUsers,
  exportTrainingLogs,
  exportAnalytics
} from "../controllers/adminController.js";
import { uploadChatFile } from "../../middleware/uploadMiddleware.js";
import { uploadDataset } from "../../middleware/uploadMiddleware.js";


import { verifyToken, requireAdmin } from "../../middleware/authMiddleware.js";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

const router = express.Router();

/**
 * ===============================
 *  SYSTEM SETUP
 * ===============================
 */
router.get("/system", verifyToken, requireAdmin, getSystemConfig);
router.post("/system", verifyToken, requireAdmin, updateSystemConfig);

/**
 * ===============================
 *  DASHBOARD & ANALYTICS
 * ===============================
 */
router.get("/dashboard", verifyToken, requireAdmin, getDashboardStats);
router.get("/analytics", verifyToken, requireAdmin, getAnalytics);
router.post("/analytics/generate", verifyToken, requireAdmin, generateAnalytics);
router.post("/analytics/generate-real", verifyToken, requireAdmin, generateRealAnalytics);

/**
 * ===============================
 *  MODEL MANAGEMENT
 * ===============================
 */
// Model Training Operations
router.post("/model/training/start", verifyToken, requireAdmin, startModelTraining);
router.get("/model/training", verifyToken, requireAdmin, getTrainingJobs);
router.get("/model/training/:id", verifyToken, requireAdmin, getTrainingDetails);
router.put("/model/training/:id/status", updateTrainingStatus); // Called by FastAPI (no auth)
router.put("/model/training/:id/cancel", verifyToken, requireAdmin, cancelTraining);
router.delete("/model/training/:id", verifyToken, requireAdmin, cancelTraining);

// Model Loading/Management Operations  
router.get("/model/loaded", verifyToken, requireAdmin, getLoadedModels);
router.get("/model/:modelId/status", verifyToken, requireAdmin, getModelStatus);
router.post("/model/:modelId/load", verifyToken, requireAdmin, loadModel);
router.post("/model/:modelId/unload", verifyToken, requireAdmin, unloadModel);

// Dataset upload route
router.post(
  "/datasets/upload",
  verifyToken,
  requireAdmin,
  uploadDataset.single('dataset'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No dataset file uploaded" });
    }
    const allowed = [".csv", ".json", ".txt", ".jsonl"];
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return res.status(400).json({
        error: "Invalid file type. Only CSV, JSON, TXT, JSONL allowed.",
      });
    }
    res.json({
      message: "Dataset uploaded successfully",
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedAt: new Date(),
    });
  }
);

/**
 * ===============================
 *  USER & ADMIN MANAGEMENT
 * ===============================
 */
router.get("/users", verifyToken, requireAdmin, getAllUsers);
router.get("/admins", verifyToken, requireAdmin, getAllAdmins);
router.put("/users/:userId/promote", verifyToken, requireAdmin, promoteUserToAdmin);
router.put("/users/:userId/demote", verifyToken, requireAdmin, demoteAdminToClient);
router.delete("/users/:userId", verifyToken, requireAdmin, deleteUser);

/**
 * ===============================
 *  HEALTH CHECK & MONITORING
 * ===============================
 */
router.get("/health", verifyToken, requireAdmin, async (req, res) => {
  try {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      services: {},
      overall: {}
    };

    // Check FastAPI Health
    try {
      const axios = (await import('axios')).default;
      const startTime = Date.now();
      
      const fastApiResponse = await axios.get(`${FASTAPI_BASE_URL}/health`, { 
        timeout: 8000 
      });
      
      const responseTime = Date.now() - startTime;
      
      if (fastApiResponse.status === 200) {
        const data = fastApiResponse.data;
        
        healthStatus.services = {
          database: data.services?.database || { status: "unknown" },
          fastapi: {
            status: "online",
            response_time_ms: responseTime,
            last_checked: new Date().toISOString()
          },
          llama: data.services?.llama || { status: "unknown" },
          blip: data.services?.blip || { status: "unknown" }
        };
        
        healthStatus.system = data.system || {};
        healthStatus.overall = data.overall || "unknown";
        healthStatus.summary = data.summary || {};
      }
    } catch (error) {
      console.error('FastAPI health check failed:', error.message);
      
      // Fallback - check individual services
      healthStatus.services = {
        database: { status: "unknown", error: "Cannot reach FastAPI" },
        fastapi: { status: "offline", error: error.message },
        llama: { status: "unknown", error: "Cannot reach FastAPI" },
        blip: { status: "unknown", error: "Cannot reach FastAPI" }
      };
      
      healthStatus.overall = "unhealthy";
      healthStatus.summary = {
        online_services: 0,
        total_services: 4,
        uptime_percentage: 0
      };
    }

    // Check Database directly from Node.js
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        healthStatus.services.database = {
          status: "online",
          type: "mongodb",
          connected: true,
          last_checked: new Date().toISOString()
        };
      } else {
        throw new Error("Database not connected");
      }
    } catch (dbError) {
      healthStatus.services.database = {
        status: "offline",
        error: dbError.message,
        connected: false,
        last_checked: new Date().toISOString()
      };
    }

    res.json(healthStatus);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
      overall: { status: "unhealthy" }
    });
  }
});

/**
 * ===============================
 *  ADVANCED FILTERING & SEARCH
 * ===============================
 */
router.get("/model/training/search", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { 
      status, 
      modelName, 
      trainedBy, 
      dateFrom, 
      dateTo, 
      limit = 50, 
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (modelName) filter.modelName = new RegExp(modelName, 'i');
    if (trainedBy) filter.trainedBy = trainedBy;
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const result = await getFilteredTrainingJobs(filter, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/users/search", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { 
      username, 
      email, 
      role, 
      isActive, 
      limit = 50, 
      offset = 0 
    } = req.query;

    const result = await searchUsers({
      username,
      email, 
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined
    }, { limit: parseInt(limit), offset: parseInt(offset) });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 *  EXPORT OPERATIONS
 * ===============================
 */
router.get("/model/training/:id/export", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    
    const exportData = await exportTrainingLogs(id, format);
    
    res.setHeader('Content-Disposition', `attachment; filename=training_${id}_logs.${format}`);
    res.setHeader('Content-Type', 
      format === 'json' ? 'application/json' : 
      format === 'csv' ? 'text/csv' : 'text/plain'
    );
    
    res.send(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/export", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, format = 'json' } = req.query;
    
    const analyticsData = await exportAnalytics({ dateFrom, dateTo }, format);
    
    res.setHeader('Content-Disposition', `attachment; filename=analytics_export.${format}`);
    res.setHeader('Content-Type', 
      format === 'json' ? 'application/json' : 
      format === 'csv' ? 'text/csv' : 'text/plain'
    );
    
    res.send(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
