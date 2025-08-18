import AdminConfig from "../models/AdminConfig.js";
import Analytics from "../models/Analytics.js";
import ModelTraining from "../models/ModelTraining.js";
import Message from "../../models/Message.js";
import ChatSession from "../../models/ChatSession.js";
import User from "../../models/User.js";
import axios from "axios";


const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000";

/**
 * ===============================
 *  SYSTEM SETUP (AdminConfig)
 * ===============================
 */

/**
 * Get current system configuration (active model, intents, templates)
 */
export const getSystemConfig = async (req, res) => {
  try {
    const config = await AdminConfig.findOne().sort({ updatedAt: -1 });
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update system configuration (change active model, update intents/templates)
 */
export const updateSystemConfig = async (req, res) => {
  try {
    const { activeModel, intents, responseTemplates } = req.body;

    const newConfig = new AdminConfig({
      activeModel,
      intents,
      responseTemplates,
      updatedBy: req.user._id
    });

    await newConfig.save();

    // 🔗 Optionally inform FastAPI about new active model
    try {
      await axios.post(`${FASTAPI_BASE_URL}/config/update`, { activeModel });
    } catch (err) {
      console.warn("FastAPI not reachable, continuing with Mongo only.");
    }

    res.json({ message: "System configuration updated", config: newConfig });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ===============================
 *  DASHBOARD & ANALYTICS
 * ===============================
 */

/**
 * Get dashboard stats:
 * - total users
 * - total chat sessions
 * - total messages
 * - total AI messages
 */
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSessions = await ChatSession.countDocuments();
    const totalMessages = await Message.countDocuments();
    const aiMessages = await Message.countDocuments({ sender: "AI" });

    res.json({
      totalUsers,
      totalSessions,
      totalMessages,
      aiMessages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get analytics report (query patterns, accuracy, response time)
 */
export const getAnalytics = async (req, res) => {
  try {
    const analytics = await Analytics.find().sort({ generatedAt: -1 }).limit(20);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate new analytics report from Messages collection
 */
export const generateAnalytics = async (req, res) => {
  try {
    // Example: total messages + random accuracy
    const totalMessages = await Message.countDocuments();
    const randomAccuracy = Math.floor(Math.random() * 20) + 80; // 80-99%

    const analytics = new Analytics({
      intent: "general",
      totalQueries: totalMessages,
      accuracy: randomAccuracy,
      avgResponseTime: Math.floor(Math.random() * 1000) + 300, // mock in ms
      generatedAt: new Date()
    });

    await analytics.save();
    res.json({ message: "Analytics generated", analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ===============================
 *  MODEL MANAGEMENT
 * ===============================
 */

/**
 * Start new model training
 */
export const startModelTraining = async (req, res) => {
  try {
    const { modelName, dataset } = req.body;

    // 1. Save training job in Mongo first
    const training = new ModelTraining({
      modelName,
      dataset,
      status: "pending",
      trainedBy: req.user._id
    });
    await training.save();

    // 2. Call FastAPI to actually run training
    try {
      await axios.post(`${FASTAPI_BASE_URL}/train`, {
        job_id: training._id.toString(),
        modelName,
        dataset
      });
    } catch (err) {
      console.error("FastAPI training error:", err.message);
      return res.status(500).json({ error: "Failed to start training on FastAPI" });
    }

    res.json({ message: "Model training initiated", training });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all model training jobs
 */
export const getTrainingJobs = async (req, res) => {
  try {
    const jobs = await ModelTraining.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update training status (admin manually marks as running/completed/failed)
 */
export const updateTrainingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, logs, accuracy } = req.body;

    const training = await ModelTraining.findByIdAndUpdate(
      id,
      { status, $push: { logs: logs }, accuracy },
      { new: true }
    );

    res.json({ message: "Training updated", training });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ===============================
//  USER & ADMIN MANAGEMENT
// ===============================

/**
 * 📌 Fetch all users (admin + clients + super-admin)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password -otp -passwordResetOtp");
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 📌 Fetch all admins (role: "admin" or "super-admin")
 */
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super-admin"] } })
      .select("-password -otp -passwordResetOtp");

    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 📌 Promote a client to admin
 */
export const promoteUserToAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role: "admin" },
      { new: true }
    ).select("-password -otp -passwordResetOtp");

    if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "User promoted to admin", user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 📌 Demote an admin to client
 */
export const demoteAdminToClient = async (req, res) => {
  try {
    const { userId } = req.params;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role: "client" },
      { new: true }
    ).select("-password -otp -passwordResetOtp");

    if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "Admin demoted to client", user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 📌 Delete a user (and cascade: delete their sessions + messages)
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(404).json({ success: false, message: "User not found" });

    // Delete user’s sessions & messages
    const sessions = await ChatSession.find({ user: userId });
    const sessionIds = sessions.map(s => s._id);

    await ChatSession.deleteMany({ user: userId });
    await Message.deleteMany({ session: { $in: sessionIds } });

    res.json({ success: true, message: "User and related data deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

