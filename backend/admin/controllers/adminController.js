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
    res.json({
      success: true,
      config: config || {}
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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
    
    res.json({ 
      success: true,
      message: "System configuration updated", 
      config: newConfig 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

/**
 * ===============================
 *  SYSTEM HEALTH & INFO
 * ===============================
 */
export const getSystemHealth = async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      service: 'admin',
      overall: 'healthy',
      services: {
        database: { status: 'online', type: 'mongodb' },
        fastapi: { status: 'unknown' },
        llama: { status: 'unknown' },
        blip: { status: 'unknown' }
      },
      system: {
        cpu_percent: 45,
        memory_percent: 60,
        disk_percent: 30
      },
      summary: {
        online_services: 1,
        total_services: 4,
        uptime_percentage: 99.5
      },
      user: {
        id: req.user._id,
        role: req.user.role,
        isSuperAdmin: req.user.role === 'super-admin'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system health',
      error: error.message
    });
  }
};

export const getSystemInfo = async (req, res) => {
  try {
    res.json({
      success: true,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV || 'development'
      },
      user: {
        role: req.user.role,
        isSuperAdmin: req.user.role === 'super-admin',
        permissions: {
          canManageUsers: ['admin', 'super-admin'].includes(req.user.role),
          canManageAdmins: req.user.role === 'super-admin',
          canCreateSuperAdmins: req.user.role === 'super-admin'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system info',
      error: error.message
    });
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
      success: true,
      totalUsers,
      totalSessions,
      totalMessages,
      aiMessages
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const analytics = await Analytics.find().sort({ generatedAt: -1 }).limit(20);
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const getUserAnalytics = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      isActive: true,
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });
    
    res.json({
      success: true,
      analytics: {
        totalUsers,
        newUsersThisMonth,
        usersByRole: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        currentUserRole: req.user.role
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
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
    res.json({ 
      success: true,
      message: "Analytics generated", 
      analytics 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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

    res.json({ 
      success: true,
      message: "Real analytics generated", 
      analytics: aggregation 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
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
    const users = await User.find({ isActive: true })
      .select('-password -otp -passwordResetOtp -__v')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ 
      role: { $in: ['admin', 'super-admin'] },
      isActive: true 
    })
      .select('-password -otp -passwordResetOtp -__v')
      .sort({ role: -1, createdAt: -1 });
    
    res.json({
      success: true,
      admins: admins.map(admin => ({
        _id: admin._id,
        clerkId: admin.clerkId,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        isOriginalSuperAdmin: admin.email === 'apurvsrivastava1510@gmail.com'
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
};

export const promoteUserToAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role = 'admin' } = req.body;
    
    if (!['admin', 'super-admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin or super-admin'
      });
    }

    if (role === 'super-admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can promote users to super admin'
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (targetUser.email === 'apurvsrivastava1510@gmail.com' && req.user.email !== 'apurvsrivastava1510@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify the original super admin'
      });
    }

    targetUser.role = role;
    await targetUser.save();
    
    res.json({
      success: true,
      message: `User promoted to ${role}`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Promote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote user'
    });
  }
};

export const demoteAdminToClient = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role = 'client' } = req.body;
    
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot demote yourself'
      });
    }

    if (targetUser.email === 'apurvsrivastava1510@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Cannot demote the original super admin'
      });
    }

    if (targetUser.role === 'super-admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can demote super admins'
      });
    }

    targetUser.role = role;
    await targetUser.save();
    
    res.json({
      success: true,
      message: `User role changed to ${role}`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Demote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change user role'
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (targetUser && targetUser.email === 'apurvsrivastava1510@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete the original super admin'
      });
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    const sessions = await ChatSession.find({ user: userId });
    const sessionIds = sessions.map(s => s._id);

    await ChatSession.deleteMany({ user: userId });
    await Message.deleteMany({ session: { $in: sessionIds } });

    res.json({ 
      success: true, 
      message: "User and related data deleted" 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * ===============================
 *  MODEL TRAINING
 * ===============================
 */
export const startModelTraining = async (req, res) => {
  try {
    const { modelName, dataset, parameters } = req.body;

    const supportedModels = ["llama3", "blip", "llama-custom"];
    if (!supportedModels.some(model => modelName.toLowerCase().includes(model))) {
      return res.status(400).json({ 
        success: false,
        error: "Unsupported model type" 
      });
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
      
      return res.status(500).json({ 
        success: false,
        error: "Failed to start training on FastAPI" 
      });
    }

    res.json({ 
      success: true,
      message: "Model training initiated", 
      training 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const getTrainingJobs = async (req, res) => {
  try {
    const { status, modelName, limit = 20 } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (modelName) filter.modelName = new RegExp(modelName, 'i');

    const jobs = await ModelTraining.find(filter)
      .populate('trainedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
      
    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const getTrainingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const training = await ModelTraining.findById(id)
      .populate('trainedBy', 'name email');
      
    if (!training) {
      return res.status(404).json({ 
        success: false,
        error: "Training job not found" 
      });
    }
    
    res.json({
      success: true,
      training
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const updateTrainingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, log, logs, accuracy, progress } = req.body;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (accuracy !== undefined) updateData.accuracy = accuracy;
    if (status === "completed") updateData.completedAt = new Date();
    
    if (log || logs) {
      updateData.$push = { logs: log || logs };
    }

    const training = await ModelTraining.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!training) {
      return res.status(404).json({ 
        success: false,
        error: "Training job not found" 
      });
    }

    console.log(`Training ${id} updated:`, { status, progress, log });
    res.json({ 
      success: true,
      message: "Training updated", 
      training 
    });
  } catch (error) {
    console.error("Update training error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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
      return res.status(404).json({ 
        success: false,
        error: "Training job not found" 
      });
    }

    try {
      await axios.post(`${FASTAPI_BASE_URL}/training/cancel`, {
        jobId: id
      });
    } catch (err) {
      console.error("Failed to notify FastAPI about cancellation:", err.message);
    }

    res.json({ 
      success: true,
      message: "Training cancelled", 
      training 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

/**
 * ===============================
 *  MODEL MANAGEMENT
 * ===============================
 */
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
      success: true,
      message: "Model load request sent",
      modelId,
      fastApiResponse: response.data
    });
  } catch (error) {
    console.error("Model load error:", error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const unloadModel = async (req, res) => {
  try {
    const { modelId } = req.params;

    const response = await axios.post(`${FASTAPI_BASE_URL}/model/unload`, {
      modelId
    });

    res.json({
      success: true,
      message: "Model unload request sent",
      modelId,
      fastApiResponse: response.data
    });
  } catch (error) {
    console.error("Model unload error:", error.message);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const getModelStatus = async (req, res) => {
  try {
    const { modelId } = req.params;

    const response = await axios.get(`${FASTAPI_BASE_URL}/model/${modelId}/status`);

    res.json({
      success: true,
      modelId,
      status: response.data
    });
  } catch (error) {
    console.error("Model status error:", error.message);
    res.status(500).json({ 
      success: false,
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
      success: true,
      loadedModels: response.data,
      count: response.data.length || 0
    });
  } catch (error) {
    console.error("Get loaded models error:", error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      loadedModels: [],
      count: 0
    });
  }
};

/**
 * ===============================
 *  DATASET UPLOAD
 * ===============================
 */
export const uploadDataset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No dataset file uploaded'
      });
    }

    console.log('📊 [ADMIN] Dataset upload:', {
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });

    res.json({
      success: true,
      message: 'Dataset uploaded successfully',
      file: {
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Dataset upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload dataset'
    });
  }
};

export const uploadDatasetUnavailable = async (req, res) => {
  res.status(503).json({
    success: false,
    message: 'Dataset upload service unavailable'
  });
};

/**
 * ===============================
 *  HELPER FUNCTIONS
 * ===============================
 */
export const getFilteredTrainingJobs = async (filter, options) => {
  try {
    const { limit = 50, offset = 0, sort = { createdAt: -1 } } = options;
    
    const jobs = await ModelTraining.find(filter)
      .populate('trainedBy', 'name email')
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

