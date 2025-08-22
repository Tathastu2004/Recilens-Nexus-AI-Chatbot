import AdminConfig from "../models/AdminConfig.js";
import Analytics from "../models/Analytics.js";
import ModelTraining from "../models/ModelTraining.js";
import Message from "../../models/Message.js";
import ChatSession from "../../models/ChatSession.js";
import User from "../../models/User.js";
import axios from "axios";

const FASTAPI_BASE_URL = process.env.FASTAPI_URL || "http://localhost:8000";

/**
 * ===============================
 *  SYSTEM SETUP (AdminConfig)
 * ===============================
 */
export const getSystemConfig = async (req, res) => {
  try {
    const config = await AdminConfig.findOne().sort({ updatedAt: -1 });
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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

export const getAnalytics = async (req, res) => {
  try {
    const analytics = await Analytics.find().sort({ generatedAt: -1 }).limit(20);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const generateAnalytics = async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const randomAccuracy = Math.floor(Math.random() * 20) + 80;

    const analytics = new Analytics({
      intent: "general",
      totalQueries: totalMessages,
      accuracy: randomAccuracy,
      avgResponseTime: Math.floor(Math.random() * 1000) + 300,
      generatedAt: new Date()
    });

    await analytics.save();
    res.json({ message: "Analytics generated", analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const generateRealAnalytics = async (req, res) => {
  try {
    const aggregation = await Message.aggregate([
      { $match: { intent: { $exists: true } } },
      {
        $group: {
          _id: "$intent",
          totalQueries: { $sum: 1 },
          correctResponses: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          avgResponseTime: { $avg: "$responseTimeMs" }
        }
      },
      {
        $project: {
          intent: "$_id",
          totalQueries: 1,
          accuracy: { 
            $cond: [
              { $eq: ["$totalQueries", 0] },
              0,
              { $multiply: [{ $divide: ["$correctResponses", "$totalQueries"] }, 100] }
            ]
          },
          avgResponseTime: { $ifNull: ["$avgResponseTime", 0] },
          _id: 0
        }
      }
    ]);

    const now = new Date();
    await Promise.all(aggregation.map(async (item) => {
      const doc = new Analytics({
        ...item,
        generatedAt: now,
      });
      await doc.save();
    }));

    res.json({ message: "Real analytics generated", analytics: aggregation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ===============================
 *  MODEL MANAGEMENT
 * ===============================
 */
export const startModelTraining = async (req, res) => {
  try {
    const { modelName, dataset, parameters } = req.body;

    const supportedModels = ["llama3", "blip", "llama-custom"];
    if (!supportedModels.some(model => modelName.toLowerCase().includes(model))) {
      return res.status(400).json({ error: "Unsupported model type" });
    }

    const training = new ModelTraining({
      modelName,
      dataset,
      parameters: parameters || {},
      status: "pending",
      trainedBy: req.user._id
    });
    await training.save();

    try {
      const response = await axios.post(`${FASTAPI_BASE_URL}/train`, {
        jobId: training._id.toString(),
        modelName,
        dataset,
        parameters
      }, { timeout: 10000 });

      console.log("FastAPI training started:", response.data);
    } catch (err) {
      console.error("FastAPI training error:", err.message);
      
      await ModelTraining.findByIdAndUpdate(training._id, {
        status: "failed",
        $push: { logs: `Failed to start training: ${err.message}` }
      });
      
      return res.status(500).json({ error: "Failed to start training on FastAPI" });
    }

    res.json({ message: "Model training initiated", training });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTrainingJobs = async (req, res) => {
  try {
    const { status, modelName, limit = 20 } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (modelName) filter.modelName = new RegExp(modelName, 'i');

    const jobs = await ModelTraining.find(filter)
      .populate('trainedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
      
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTrainingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const training = await ModelTraining.findById(id)
      .populate('trainedBy', 'username email');
      
    if (!training) {
      return res.status(404).json({ error: "Training job not found" });
    }
    
    res.json(training);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTrainingStatus = async (req, res) => {
  try {
    const { id, jobId } = req.params;
    const { status, log, logs, accuracy, progress } = req.body;
    
    const trainingId = id || jobId;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (accuracy !== undefined) updateData.accuracy = accuracy;
    if (status === "completed") updateData.completedAt = new Date();
    
    if (log || logs) {
      updateData.$push = { logs: log || logs };
    }

    const training = await ModelTraining.findByIdAndUpdate(
      trainingId,
      updateData,
      { new: true }
    );

    if (!training) {
      return res.status(404).json({ error: "Training job not found" });
    }

    console.log(`Training ${trainingId} updated:`, { status, progress, log });
    res.json({ message: "Training updated", training });
  } catch (error) {
    console.error("Update training error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const cancelTraining = async (req, res) => {
  try {
    const { id } = req.params;
    
    const training = await ModelTraining.findByIdAndUpdate(
      id,
      { 
        status: "failed",
        completedAt: new Date(),
        $push: { logs: "Training cancelled by admin" }
      },
      { new: true }
    );

    if (!training) {
      return res.status(404).json({ error: "Training job not found" });
    }

    try {
      await axios.post(`${FASTAPI_BASE_URL}/training/cancel`, {
        jobId: id
      });
    } catch (err) {
      console.error("Failed to notify FastAPI about cancellation:", err.message);
    }

    res.json({ message: "Training cancelled", training });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const loadModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    const { modelPath, modelType, parameters } = req.body;

    const response = await axios.post(`${FASTAPI_BASE_URL}/model/load`, {
      modelId,
      modelPath: modelPath || `./models/${modelId}`,
      modelType: modelType || "llama",
      parameters: parameters || {}
    });

    res.json({
      message: "Model load request sent",
      modelId,
      fastApiResponse: response.data
    });
  } catch (error) {
    console.error("Model load error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const unloadModel = async (req, res) => {
  try {
    const { modelId } = req.params;

    const response = await axios.post(`${FASTAPI_BASE_URL}/model/unload`, {
      modelId
    });

    res.json({
      message: "Model unload request sent",
      modelId,
      fastApiResponse: response.data
    });
  } catch (error) {
    console.error("Model unload error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const getModelStatus = async (req, res) => {
  try {
    const { modelId } = req.params;

    const response = await axios.get(`${FASTAPI_BASE_URL}/model/${modelId}/status`);

    res.json({
      modelId,
      status: response.data
    });
  } catch (error) {
    console.error("Model status error:", error.message);
    res.status(500).json({ 
      error: error.message,
      modelId: req.params.modelId,
      status: "unknown"
    });
  }
};

export const getLoadedModels = async (req, res) => {
  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/model/loaded`);

    res.json({
      loadedModels: response.data,
      count: response.data.length || 0
    });
  } catch (error) {
    console.error("Get loaded models error:", error.message);
    res.status(500).json({ 
      error: error.message,
      loadedModels: [],
      count: 0
    });
  }
};

/**
 * ===============================
 *  USER & ADMIN MANAGEMENT
 * ===============================
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password -otp -passwordResetOtp");
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super-admin"] } })
      .select("-password -otp -passwordResetOtp");

    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(404).json({ success: false, message: "User not found" });

    const sessions = await ChatSession.find({ user: userId });
    const sessionIds = sessions.map(s => s._id);

    await ChatSession.deleteMany({ user: userId });
    await Message.deleteMany({ session: { $in: sessionIds } });

    res.json({ success: true, message: "User and related data deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper functions for advanced routes
export const getFilteredTrainingJobs = async (filter, options) => {
  try {
    const { limit = 50, offset = 0, sort = { createdAt: -1 } } = options;
    
    const jobs = await ModelTraining.find(filter)
      .populate('trainedBy', 'username email')
      .sort(sort)
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    const total = await ModelTraining.countDocuments(filter);
    
    return {
      jobs,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    };
  } catch (error) {
    throw error;
  }
};

export const searchUsers = async (searchCriteria, options) => {
  try {
    const { username, email, role, isActive } = searchCriteria;
    const { limit = 50, offset = 0 } = options;
    
    const filter = {};
    if (username) filter.username = new RegExp(username, 'i');
    if (email) filter.email = new RegExp(email, 'i');
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive;
    
    const users = await User.find(filter)
      .select("-password -otp -passwordResetOtp")
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    return {
      users,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    };
  } catch (error) {
    throw error;
  }
};

export const exportTrainingLogs = async (jobId, format) => {
  try {
    const training = await ModelTraining.findById(jobId)
      .populate('trainedBy', 'username email');
    
    if (!training) {
      throw new Error('Training job not found');
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(training, null, 2);
      case 'csv':
        // Simple CSV export
        const logs = training.logs || [];
        const csvData = ['Timestamp,Log Entry'].concat(
          logs.map((log, index) => `${index + 1},"${log}"`)
        ).join('\n');
        return csvData;
      case 'txt':
        return logs.join('\n');
      default:
        return JSON.stringify(training, null, 2);
    }
  } catch (error) {
    throw error;
  }
};

export const exportAnalytics = async (dateFilter, format) => {
  try {
    const { dateFrom, dateTo } = dateFilter;
    const filter = {};
    
    if (dateFrom || dateTo) {
      filter.generatedAt = {};
      if (dateFrom) filter.generatedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.generatedAt.$lte = new Date(dateTo);
    }
    
    const analytics = await Analytics.find(filter).sort({ generatedAt: -1 });
    
    switch (format) {
      case 'json':
        return JSON.stringify(analytics, null, 2);
      case 'csv':
        const headers = 'Intent,Total Queries,Accuracy,Avg Response Time,Generated At';
        const rows = analytics.map(item => 
          `"${item.intent}",${item.totalQueries},${item.accuracy},${item.avgResponseTime},"${item.generatedAt}"`
        );
        return [headers, ...rows].join('\n');
      case 'txt':
        return analytics.map(item => 
          `Intent: ${item.intent}\nQueries: ${item.totalQueries}\nAccuracy: ${item.accuracy}%\nResponse Time: ${item.avgResponseTime}ms\nGenerated: ${item.generatedAt}\n---\n`
        ).join('');
      default:
        return JSON.stringify(analytics, null, 2);
    }
  } catch (error) {
    throw error;
  }
};

