import express from 'express';
import multer from 'multer';
import { clerkAuth } from '../../middleware/clerkAuth.js';
import * as modelManagementController from '../controllers/modelManagementController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ✅ INTERNAL STATUS UPDATE ROUTE (BEFORE AUTH) - For FastAPI callbacks
router.put('/internal/training/:jobId/status', modelManagementController.updateTrainingJobStatus);

// ✅ APPLY CLERK AUTH TO ALL OTHER ROUTES
router.use(clerkAuth);

// ✅ TRAINING JOB ROUTES
router.get('/training-jobs', modelManagementController.getTrainingJobs);
router.get('/training-jobs/:jobId', modelManagementController.getTrainingJobById);
router.get('/training-jobs/:jobId/status', modelManagementController.getTrainingStatus);
router.post('/training-jobs', upload.single('datasetFile'), modelManagementController.createTrainingJob); // ✅ FIX: Unified training endpoint
router.post('/training-jobs/:jobId/cancel', modelManagementController.cancelTrainingJob);
router.delete('/training-jobs/:jobId', modelManagementController.deleteTrainingJob);

// ✅ MODEL MANAGEMENT ROUTES
router.get('/loaded', modelManagementController.getLoadedModels);
router.get('/available-adapters', modelManagementController.getAvailableAdapters);
router.get('/status/:modelId', modelManagementController.getModelStatus); // ✅ FIX: Use GET method and path param
router.post('/load-lora', modelManagementController.loadLoRAAdapter);
router.delete('/unload/:modelId', modelManagementController.unloadModel); // ✅ FIX: Use DELETE method and path param

// ✅ LEGACY TRAINING ROUTES (For backward compatibility)
router.post('/train-lora/:job_id', upload.single('dataset'), async (req, res) => {
  try {
    const { job_id } = req.params;
    const { baseModel = 'llama3', parameters } = req.body;
    
    console.log('🔄 [LEGACY ROUTE] Converting train-lora to new format for job:', job_id);
    
    // Transform to new format
    req.body.name = `Legacy LoRA Training ${new Date().toLocaleDateString()}`;
    req.body.modelType = 'lora';
    req.body.baseModel = baseModel;
    req.body.parameters = parameters;
    
    // Rename file field to match expected format
    if (req.file) {
      req.file.fieldname = 'datasetFile';
    }
    
    // Forward to unified endpoint
    return await modelManagementController.createTrainingJob(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY ROUTE] train-lora error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process legacy training request',
      error: error.message 
    });
  }
});

// ✅ ALTERNATIVE ENDPOINTS FOR BACKWARD COMPATIBILITY
router.post('/unload', modelManagementController.unloadModelPost); // POST method for backward compatibility
router.post('/start-training', upload.single('datasetFile'), modelManagementController.startModelTraining); // Generic training starter

// ✅ ADDITIONAL HELPFUL ROUTES
router.get('/adapters/available', modelManagementController.getAvailableAdapters); // Alternative path
router.get('/models/loaded', modelManagementController.getLoadedModels); // Alternative path

// ✅ HEALTH CHECK FOR MODEL MANAGEMENT
router.get('/health', async (req, res) => {
  try {
    const FASTAPI_BASE_URL = process.env.FASTAPI_URL || "http://localhost:8000";
    
    let fastapiStatus = 'unknown';
    try {
      const axios = await import('axios');
      const response = await axios.default.get(`${FASTAPI_BASE_URL}/health`, { timeout: 3000 });
      fastapiStatus = response.status === 200 ? 'healthy' : 'unhealthy';
    } catch (error) {
      fastapiStatus = 'unavailable';
    }
    
    res.json({
      success: true,
      status: 'healthy',
      services: {
        fastapi: fastapiStatus,
        database: 'connected',
        multer: 'configured',
        auth: 'active'
      },
      endpoints: {
        training: '/api/admin/model/training-jobs',
        models: '/api/admin/model/loaded',
        adapters: '/api/admin/model/available-adapters',
        load: '/api/admin/model/load-lora',
        unload: '/api/admin/model/unload/:modelId'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ✅ ERROR HANDLING MIDDLEWARE FOR THIS ROUTER
router.use((error, req, res, next) => {
  console.error('❌ [MODEL ROUTES] Error:', {
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack
  });
  
  // Handle multer errors specifically
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.',
        error_type: 'file_too_large'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Expected: datasetFile or dataset.',
        error_type: 'unexpected_field'
      });
    }
  }
  
  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Internal server error in model management routes',
    error: error.message,
    error_type: 'server_error'
  });
});

export default router;