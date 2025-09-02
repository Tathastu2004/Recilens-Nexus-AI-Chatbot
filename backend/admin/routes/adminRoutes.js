import express from 'express';
import { requireAuth, attachUser, requireAdmin, requireSuperAdmin, requireRoleManagementPermission } from '../../middleware/clerkAuth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

console.log('🔧 [ADMIN ROUTES] Initializing admin routes...');

// ✅ APPLY CLERK AUTH MIDDLEWARE TO ALL ROUTES
router.use(requireAuth);
router.use(attachUser);
router.use(requireAdmin);

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
//  USER MANAGEMENT ROUTES
// ===============================
router.get('/users', adminController.getAllUsers);
router.get('/admins', requireSuperAdmin, adminController.getAllAdmins);
router.put('/users/:userId/promote', requireRoleManagementPermission, adminController.promoteUserToAdmin);
router.put('/users/:userId/demote', requireRoleManagementPermission, adminController.demoteAdminToClient);
router.delete('/users/:userId', requireSuperAdmin, adminController.deleteUser);

// ===============================
//  MODEL TRAINING ROUTES
// ===============================
router.get('/training', adminController.getTrainingJobs);
router.get('/training/:id', adminController.getTrainingDetails);
router.post('/training/start', adminController.startModelTraining);
router.put('/training/:id', adminController.updateTrainingStatus);
router.post('/training/:id/cancel', adminController.cancelTraining);

// ===============================
//  MODEL MANAGEMENT ROUTES
// ===============================
router.post('/model/:modelId/load', adminController.loadModel);
router.post('/model/:modelId/unload', adminController.unloadModel);
router.get('/model/:modelId/status', adminController.getModelStatus);
router.get('/model/loaded', adminController.getLoadedModels);

console.log('✅ [ADMIN ROUTES] Admin routes initialized successfully');

export default router;
