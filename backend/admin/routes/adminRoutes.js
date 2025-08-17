import express from "express";
import {
  getSystemConfig,
  updateSystemConfig,
  getDashboardStats,
  getAnalytics,
  generateAnalytics,
  startModelTraining,
  getTrainingJobs,
  updateTrainingStatus
} from "../controllers/adminController.js";

import { verifyToken, requireAdmin } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * ===============================
 *  SYSTEM SETUP
 * ===============================
 */

// ✅ Get current system config
router.get("/system", verifyToken, requireAdmin, getSystemConfig);

// ✅ Update system config (model, intents, templates)
router.post("/system", verifyToken, requireAdmin, updateSystemConfig);


/**
 * ===============================
 *  DASHBOARD & ANALYTICS
 * ===============================
 */

// ✅ Get dashboard overview stats
router.get("/dashboard", verifyToken, requireAdmin, getDashboardStats);

// ✅ Get recent analytics reports
router.get("/analytics", verifyToken, requireAdmin, getAnalytics);

// ✅ Generate new analytics report
router.post("/analytics/generate", verifyToken, requireAdmin, generateAnalytics);


/**
 * ===============================
 *  MODEL MANAGEMENT
 * ===============================
 */

// ✅ Start a new model training job
router.post("/model/training", verifyToken, requireAdmin, startModelTraining);

// ✅ Get all model training jobs
router.get("/model/training", verifyToken, requireAdmin, getTrainingJobs);

// ✅ Update training job status (running/completed/failed)
router.put("/model/training/:id", verifyToken, requireAdmin, updateTrainingStatus);


export default router;
