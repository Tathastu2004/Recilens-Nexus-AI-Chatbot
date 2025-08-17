import AdminConfig from "../models/AdminConfig.js";
import Analytics from "../models/Analytics.js";
import ModelTraining from "../models/ModelTraining.js";
import Message from "../../models/Message.js";
import ChatSession from "../../models/ChatSession.js";
import User from "../../models/User.js";

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
    const config = await AdminConfig.findOne().sort({ updatedAt: -1 }); // latest config
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

    const training = new ModelTraining({
      modelName,
      dataset,
      status: "pending",
      trainedBy: req.user._id
    });

    await training.save();
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
