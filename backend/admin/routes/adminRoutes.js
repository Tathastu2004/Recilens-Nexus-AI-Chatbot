import express from 'express';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

console.log('🔧 [ADMIN ROUTES] Initializing admin routes...');

try {
  // ✅ SYSTEM HEALTH & INFO
  router.get('/health', adminController.getSystemHealth);
  router.get('/system-info', adminController.getSystemInfo);

  // ✅ SYSTEM CONFIGURATION
  router.get('/config', adminController.getSystemConfig);
  router.post('/config', adminController.updateSystemConfig);

  // ✅ DASHBOARD & ANALYTICS
  router.get('/dashboard/stats', adminController.getDashboardStats);
  router.get('/analytics', adminController.getAnalytics);
  router.get('/analytics/realtime', adminController.getRealTimeAnalytics);
  router.get('/analytics/stream', adminController.getAnalyticsStream);

  // ✅ USER MANAGEMENT
  router.get('/users', adminController.getAllUsers);
  router.put('/users/:id/role', adminController.updateUserRole);
  router.delete('/users/:id', adminController.deleteUser);

  // ✅ TRAINING JOBS
  router.get('/training-jobs', adminController.getTrainingJobs);
  router.post('/training-jobs', adminController.createTrainingJob);
  router.put('/training-jobs/:id', adminController.updateTrainingJob);

  // ✅ MODEL MANAGEMENT
  router.get('/model/loaded', adminController.getLoadedModels);
  router.get('/training', adminController.getTrainingJobs); // Alternative route

  console.log('✅ [ADMIN ROUTES] All admin routes initialized successfully');

} catch (error) {
  console.error('❌ [ADMIN ROUTES] Error initializing routes:', error);
  
  // Fallback error route
  router.use('*', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Admin routes initialization failed',
      error: error.message
    });
  });
}

export default router;
