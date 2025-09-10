// feedbackRoutes.js
import express from "express";
import { requireAuth, attachUser } from "../middleware/clerkAuth.js";
import {
  createFeedback,
  getUserFeedbacks,
  getAllFeedbacks,
  replyToFeedback,
  markFeedbackCompleted,
  getUserFeedbackStats,
} from "../controllers/feedbackController.js";

const router = express.Router();

console.log("📋 [FEEDBACK ROUTES] Initializing feedback routes...");

// ✅ Apply Clerk auth middleware to all routes
router.use(requireAuth);
router.use(attachUser);

// ===============================
//  CLIENT FEEDBACK ROUTES
// ===============================

// Create new feedback (authenticated users)
router.post("/user", createFeedback);

// Get user's own feedbacks
router.get("/user/:userId", getUserFeedbacks);

// Get user feedback stats (optional)
router.get("/stats/user/:userId", getUserFeedbackStats);

// ===============================
//  ADMIN FEEDBACK ROUTES
// ===============================

// Get all feedbacks (admin only)
router.get("/", getAllFeedbacks);

// Reply to feedback (admin only)
router.post("/:feedbackId/reply", replyToFeedback);

// Mark feedback as completed (admin only)
router.put("/:id/complete", markFeedbackCompleted);

console.log("✅ [FEEDBACK ROUTES] Feedback routes initialized successfully");

export default router;
