import express from 'express';
import multer from 'multer';
import * as modelManagementController from '../controllers/modelManagementController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ✅ RAG-SPECIFIC ROUTES (BEFORE AUTH - Available without authentication)
router.post('/ingest-data', upload.single('dataSheetFile'), modelManagementController.ingestDataSheet);
router.delete('/delete-data', modelManagementController.deleteDataSheet);
router.delete('/delete-data/:docId', modelManagementController.deleteDataSheet);
router.get('/ingested-documents', modelManagementController.getIngestedDocuments);
router.get('/models', modelManagementController.getModels);
router.get('/models/:modelId/status', modelManagementController.getModelStatus);

// ✅ HEALTH CHECK (BEFORE AUTH)
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
        multer: 'configured'
      },
      endpoints: {
        ingest: '/api/admin/model/ingest-data',
        delete: '/api/admin/model/delete-data',
        documents: '/api/admin/model/ingested-documents',
        models: '/api/admin/model/models'
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

// ✅ NO CLERK AUTH - Keep all endpoints public for now to avoid authentication issues

// ERROR HANDLING MIDDLEWARE FOR THIS ROUTER
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
        message: 'Unexpected file field. Expected: dataSheetFile.',
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