import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { clerkAuth } from '../../middleware/clerkAuth.js';

const router = express.Router();

console.log('🔧 [ADMIN ROUTES] Initializing admin routes...');

// ✅ ENSURE CLERK AUTH MIDDLEWARE IS APPLIED
router.use(clerkAuth);

// ===============================
//  SYSTEM & HEALTH ROUTES
// ===============================
router.get('/health', adminController.getSystemHealth);
router.get('/system/info', adminController.getSystemInfo);
router.get('/system', adminController.getSystemConfig);
router.post('/system', adminController.updateSystemConfig);

// ===============================
//  DASHBOARD & ANALYTICS ROUTES
// ===============================
router.get('/dashboard', adminController.getDashboardStats);
router.get('/analytics', adminController.getAnalytics);
router.get('/analytics/users', adminController.getUserAnalytics);
router.post('/analytics/generate', adminController.generateAnalytics);
router.post('/analytics/generate-real', adminController.generateRealAnalytics);

// ===============================
//  REAL-TIME ANALYTICS ROUTES
// ===============================
router.get('/analytics/realtime', adminController.getRealTimeAnalytics);
router.get('/analytics/stream', adminController.getAnalyticsStream);

// ===============================
//  USER MANAGEMENT ROUTES
// ===============================
router.get('/users', adminController.getAllUsers);
router.get('/admins', adminController.getAllAdmins);
router.put('/users/:userId/promote', adminController.promoteUserToAdmin);
router.put('/users/:userId/demote', adminController.demoteAdminToClient);
router.delete('/users/:userId', adminController.deleteUser);

// ===============================
//  MODEL TRAINING ROUTES
// ===============================
router.get('/training', adminController.getTrainingJobs);
router.get('/training/:id', adminController.getTrainingDetails);
router.post('/training/start', adminController.startModelTraining);
router.put('/training/:id', adminController.updateTrainingStatus);
router.post('/training/:id/cancel', adminController.cancelTraining);

// ===============================
//  MODEL MANAGEMENT ROUTES (✅ FIXED ORDER)
// ===============================
// ⚠️ IMPORTANT: Specific routes MUST come before parameterized routes
router.get('/model/loaded', adminController.getLoadedModels);
router.post('/model/:modelId/load', adminController.loadModel);
router.post('/model/:modelId/unload', adminController.unloadModel);
router.get('/model/:modelId/status', adminController.getModelStatus);

// ===============================
//  DATASET UPLOAD ROUTES
// ===============================
router.post('/datasets/upload', adminController.uploadDataset);

console.log('✅ [ADMIN ROUTES] Admin routes initialized successfully');

export default router;
