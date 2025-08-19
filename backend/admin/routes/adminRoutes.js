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
  generateRealAnalytics
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

router.post("/analytics/generate-real", verifyToken, requireAdmin, generateRealAnalytics);

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

/**
 * ===============================
 *  USER & ADMIN MANAGEMENT
 * ===============================
 */

// ✅ Get all users
router.get("/users", verifyToken, requireAdmin, getAllUsers);

// ✅ Get all admins
router.get("/admins", verifyToken, requireAdmin, getAllAdmins);

// ✅ Promote user to admin
router.put("/users/:userId/promote", verifyToken, requireAdmin, promoteUserToAdmin);

// ✅ Demote admin to client
router.put("/users/:userId/demote", verifyToken, requireAdmin, demoteAdminToClient);

// ✅ Delete a user (cascade delete sessions & messages)
router.delete("/users/:userId", verifyToken, requireAdmin, deleteUser);




export default router;
