// feedbackRoutes.js
import express from "express";
import {
  createFeedback,
  getUserFeedbacks,
  getAllFeedbacks,
  replyToFeedback,
  markFeedbackCompleted,
  getUserFeedbackStats,
} from "../controllers/feedbackController.js";
import { verifyToken, requireAdmin, requireClient } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * ===============================
 *  USER ROUTES (CLIENT ONLY)
 * ===============================
 */

// Create new feedback (client only)
router.post("/user", verifyToken, requireClient, createFeedback);

// Get all feedbacks for the logged-in user (client only)
router.get("/user/:userId", verifyToken, requireClient, getUserFeedbacks);
router.get("/stats/user/:userId", verifyToken, requireClient, getUserFeedbackStats);

/**
 * ===============================
 *  ADMIN ROUTES
 * ===============================
 */

// Get all feedbacks (admin only)
router.get("/", verifyToken, requireAdmin, getAllFeedbacks);

// Reply to a feedback (admin only)
router.post("/:feedbackId/reply", verifyToken, requireAdmin, replyToFeedback);

// Mark feedback as completed (admin only)
router.put("/:id/complete", verifyToken, requireAdmin, markFeedbackCompleted);



export default router;
