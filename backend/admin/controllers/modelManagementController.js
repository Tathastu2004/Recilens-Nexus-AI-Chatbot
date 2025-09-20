import AdminConfig from "../models/AdminConfig.js";
import Analytics from "../models/Analytics.js";
import ModelTraining from "../models/ModelTraining.js";
import User from '../../models/User.js';
import Message from '../../models/Message.js';
import ChatSession from '../../models/ChatSession.js';
import axios from 'axios';
import FormData from 'form-data';
import mongoose from 'mongoose';
import { basename } from 'path';

const FASTAPI_BASE_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// ✅ HELPER: Check if FastAPI is available
const checkFastAPIHealth = async () => {
  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/health`, { timeout: 3000 });
    return response.status === 200;
  } catch (error) {
    console.log(`⚠️ FastAPI not available at ${FASTAPI_BASE_URL}:`, error.code || error.message);
    return false;
  }
};

// ✅ 1. GET ALL TRAINING JOBS
export const getTrainingJobs = async (req, res) => {
  try {
    const jobs = await ModelTraining.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training jobs',
      error: error.message
    });
  }
};

// ✅ 2. CREATE A NEW TRAINING JOB (Unified)
export const createTrainingJob = async (req, res) => {
  try {
    const { name, modelType, parameters, baseModel } = req.body;
    const datasetFile = req.file;

    console.log('🚀 [CONTROLLER] Creating training job:', {
      name,
      modelType,
      baseModel,
      hasFile: !!datasetFile,
      parameters: typeof parameters === 'string' ? 'JSON_STRING' : typeof parameters
    });

    if (!datasetFile) {
      return res.status(400).json({ 
        success: false, 
        message: "Dataset file is required.",
        received_fields: Object.keys(req.body)
      });
    }
    
    // Generate unique job ID
    const jobId = `${modelType || 'lora'}-${Date.now()}`;
    
    const newJob = new ModelTraining({
      jobId,
      name: name || `${modelType || 'LoRA'} Training ${new Date().toLocaleDateString()}`,
      modelType: modelType || 'lora',
      baseModel: baseModel || 'llama3',
      dataset: {
        filename: datasetFile.originalname,
        path: `/data/training/${datasetFile.originalname}`,
        size: datasetFile.size
      },
      parameters: parameters ? (typeof parameters === 'string' ? JSON.parse(parameters) : parameters) : {},
      status: 'pending',
      createdBy: req.user?._id
    });
    
    await newJob.save();
    console.log('✅ [CONTROLLER] Training job created in DB:', newJob._id);

    // Check if FastAPI is available
    const isHealthy = await checkFastAPIHealth();
    if (!isHealthy) {
      newJob.status = 'failed';
      newJob.log = 'FastAPI service is not available';
      await newJob.save();
      return res.status(503).json({ 
        success: false, 
        message: "AI Model service is not available. Please ensure FastAPI is running on port 8000." 
      });
    }

    // Trigger training on FastAPI
    const formData = new FormData();
    formData.append('dataset', datasetFile.buffer, { 
      filename: datasetFile.originalname, 
      contentType: datasetFile.mimetype 
    });
    formData.append('base_model', baseModel || 'llama3');
    formData.append('parameters', JSON.stringify(parameters || {}));
    
    try {
        console.log('🚀 [CONTROLLER] Sending to FastAPI:', `${FASTAPI_BASE_URL}/train/lora/${jobId}`);
        
        const fastapiResponse = await axios.post(`${FASTAPI_BASE_URL}/train/lora/${jobId}`, formData, {
            headers: { ...formData.getHeaders() },
            maxContentLength: Infinity, 
            maxBodyLength: Infinity,
            timeout: 600000 // 10 minutes timeout
        });

        console.log('✅ [CONTROLLER] FastAPI response:', fastapiResponse.data);

        if (fastapiResponse.data.success || fastapiResponse.data.status === 'started') {
            newJob.status = 'running';
            newJob.log = 'Training job sent to AI service.';
            await newJob.save();
            
            res.json({ 
              success: true, 
              message: 'Training job created and triggered successfully', 
              data: newJob,
              jobId: jobId,
              fastapi_response: fastapiResponse.data
            });
        } else {
            throw new Error(fastapiResponse.data.message || 'Unknown FastAPI error');
        }

    } catch (fastApiError) {
        console.error('❌ [CONTROLLER] FastAPI error:', fastApiError.message);
        
        newJob.status = 'failed';
        newJob.log = `Failed to trigger training on FastAPI: ${fastApiError.message}`;
        await newJob.save();
        
        return res.status(500).json({ 
          success: false, 
          message: "Failed to trigger AI model training.",
          error: fastApiError.response?.data?.detail || fastApiError.message,
          jobId: jobId,
          database_id: newJob._id
        });
    }

  } catch (error) {
    console.error('❌ [CONTROLLER] Create training job error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create training job', 
      error: error.message 
    });
  }
};

// ✅ 3. UPDATE A TRAINING JOB'S STATUS (from FastAPI)
export const updateTrainingJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, log, progress, accuracy, model_path } = req.body;
    
    console.log('🔄 [CONTROLLER] Updating job status:', {
      jobId,
      status,
      progress,
      accuracy,
      model_path: model_path ? basename(model_path) : 'None'
    });
    
    // Try to find by custom jobId first, then by MongoDB _id
    let job = await ModelTraining.findOne({ jobId });
    
    if (!job) {
      job = await ModelTraining.findById(jobId).catch(() => null);
    }
    
    if (!job) {
      console.error('❌ [CONTROLLER] Training job not found:', jobId);
      return res.status(404).json({ 
        success: false, 
        message: 'Training job not found',
        searched_id: jobId
      });
    }
    
    // Update job fields
    job.status = status;
    job.log = log || job.log;
    if (progress !== undefined) job.progress = progress;
    if (accuracy !== undefined) job.accuracy = accuracy;
    
    if (status === 'completed' && model_path) {
        job.adapterName = basename(model_path);
        job.model_path = model_path;
        job.completedAt = new Date();
    }
    
    await job.save();
    
    console.log('✅ [CONTROLLER] Job status updated:', {
      id: job._id,
      jobId: job.jobId,
      status: job.status,
      progress: job.progress
    });
    
    res.json({ 
      success: true, 
      message: 'Job status updated', 
      data: {
        id: job._id,
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        accuracy: job.accuracy,
        model_path: job.model_path
      }
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Update status error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update job status', 
      error: error.message 
    });
  }
};

// ✅ 4. GET ALL LOADED MODELS
export const getLoadedModels = async (req, res) => {
  try {
    console.log('🔍 [CONTROLLER] Fetching loaded models...');
    
    const isHealthy = await checkFastAPIHealth();
    if (!isHealthy) {
      console.warn('⚠️ [CONTROLLER] FastAPI not available, returning empty list');
      return res.json({ 
        success: true, 
        message: 'AI Model service not available', 
        data: [],
        count: 0
      });
    }
    
    try {
      const fastapiResponse = await axios.get(`${FASTAPI_BASE_URL}/models/loaded`, { 
        timeout: 10000 
      });
      
      console.log('✅ [CONTROLLER] FastAPI models response received');
      
      const models = fastapiResponse.data.data || fastapiResponse.data.models || [];
      
      // Ensure consistent model structure
      const normalizedModels = models.map(model => ({
        id: model.id || model.modelId || model.model_id,
        modelId: model.id || model.modelId || model.model_id,
        name: model.name || model.id || 'Unknown Model',
        type: model.type || 'unknown',
        status: model.status || 'loaded',
        memory_usage: model.memory_usage || model.memoryUsage || 'Unknown',
        loaded_at: model.loaded_at || model.loadedAt || new Date().toISOString(),
        base_model: model.base_model || model.baseModel,
        adapter_path: model.adapter_path || model.adapterPath,
        size: model.size || 'Unknown',
        can_unload: model.can_unload !== false,
        description: model.description || `${model.type || 'Model'} - ${model.name || model.id}`
      }));
      
      res.json({ 
        success: true, 
        data: normalizedModels, 
        count: normalizedModels.length 
      });
      
    } catch (fastApiError) {
      console.warn('⚠️ [CONTROLLER] FastAPI models error:', fastApiError.message);
      
      // Return mock data for development
      const mockModels = [
        {
          id: 'llama3_base',
          modelId: 'llama3_base',
          name: 'Llama 3 Base',
          type: 'base',
          status: 'available',
          memory_usage: 'N/A',
          loaded_at: new Date().toISOString(),
          can_unload: false,
          description: 'Base Llama 3 model (from Ollama)'
        }
      ];
      
      res.json({ 
        success: true, 
        data: mockModels, 
        message: 'FastAPI not available - using mock data',
        count: mockModels.length
      });
    }
  } catch (error) {
    console.error('❌ [CONTROLLER] Get loaded models error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch loaded models', 
      error: error.message 
    });
  }
};

// ✅ 5. GET ALL AVAILABLE LORA ADAPTERS
export const getAvailableAdapters = async (req, res) => {
  try {
    console.log('🔍 [CONTROLLER] Fetching available LoRA adapters...');
    
    const isHealthy = await checkFastAPIHealth();
    if (!isHealthy) {
      console.warn('⚠️ [CONTROLLER] FastAPI not available, returning empty adapters list');
      return res.json({ 
        success: true, 
        message: 'AI Model service not available', 
        data: [],
        count: 0
      });
    }
    
    try {
      const fastapiResponse = await axios.get(`${FASTAPI_BASE_URL}/models/available-adapters`, { 
        timeout: 10000 
      });
      
      console.log('✅ [CONTROLLER] FastAPI adapters response received');
      
      const adapters = fastapiResponse.data.data || fastapiResponse.data.adapters || [];
      
      res.json({ 
        success: true, 
        data: adapters, 
        count: adapters.length 
      });
      
    } catch (fastApiError) {
      console.warn('⚠️ [CONTROLLER] FastAPI adapters error:', fastApiError.message);
      
      res.json({ 
        success: true, 
        data: [], 
        message: 'FastAPI not available - no adapters found',
        count: 0
      });
    }
  } catch (error) {
    console.error('❌ [CONTROLLER] Get available adapters error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch available adapters', 
      error: error.message 
    });
  }
};

// ✅ 6. LOAD A SPECIFIC LORA ADAPTER
export const loadLoRAAdapter = async (req, res) => {
  try {
    const { adapter_path, base_model = 'llama3' } = req.body;
    
    if (!adapter_path) { 
      return res.status(400).json({ 
        success: false, 
        message: 'adapter_path is required',
        received_fields: Object.keys(req.body)
      }); 
    }
    
    console.log('📥 [CONTROLLER] Loading LoRA adapter:', { adapter_path, base_model });
    
    const isHealthy = await checkFastAPIHealth();
    if (!isHealthy) { 
      return res.status(503).json({ 
        success: false, 
        message: 'AI Model service not available',
        error_type: 'service_unavailable'
      }); 
    }
    
    try {
      const fastapiResponse = await axios.post(`${FASTAPI_BASE_URL}/models/load-lora`, { 
        adapter_path, 
        base_model 
      }, { 
        timeout: 60000 
      });
      
      console.log('✅ [CONTROLLER] LoRA adapter loaded:', fastapiResponse.data);
      
      res.json(fastapiResponse.data);
    } catch (fastApiError) {
      console.error('❌ [CONTROLLER] FastAPI load error:', fastApiError.message);
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to load LoRA adapter', 
        error: fastApiError.response?.data || fastApiError.message,
        error_type: 'fastapi_error'
      });
    }
  } catch (error) {
    console.error('❌ [CONTROLLER] Load LoRA adapter error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load LoRA adapter', 
      error: error.message,
      error_type: 'server_error'
    });
  }
};

// ✅ 7. UNLOAD MODEL (Fixed: Uses path parameter and DELETE method)
export const unloadModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    if (!modelId) { 
      return res.status(400).json({ 
        success: false, 
        message: 'modelId is required' 
      }); 
    }
    
    console.log('🗑️ [CONTROLLER] Unloading model:', modelId);
    
    const isHealthy = await checkFastAPIHealth();
    if (!isHealthy) { 
      return res.status(503).json({ 
        success: false, 
        message: 'AI Model service not available',
        error_type: 'service_unavailable'
      }); 
    }
    
    try {
      const fastapiResponse = await axios.delete(`${FASTAPI_BASE_URL}/models/unload/${modelId}`, { 
        timeout: 30000 
      });
      
      console.log('✅ [CONTROLLER] Model unloaded:', fastapiResponse.data);
      
      res.json(fastapiResponse.data);
    } catch (fastApiError) {
      console.error('❌ [CONTROLLER] FastAPI unload error:', fastApiError.message);
      
      if (fastApiError.response?.status === 404) {
        res.status(404).json({ 
          success: false, 
          message: 'Model not found',
          error: fastApiError.response.data || fastApiError.message
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to unload model', 
          error: fastApiError.response?.data || fastApiError.message,
          error_type: 'fastapi_error'
        });
      }
    }
  } catch (error) {
    console.error('❌ [CONTROLLER] Unload model error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unload model', 
      error: error.message,
      error_type: 'server_error'
    });
  }
};

// ✅ 8. DELETE TRAINING JOB
export const deleteTrainingJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('🗑️ [CONTROLLER] Deleting training job:', jobId);
    
    // Try to find by custom jobId first, then by MongoDB _id
    let deletedJob = await ModelTraining.findOneAndDelete({ jobId });
    
    if (!deletedJob) {
      deletedJob = await ModelTraining.findByIdAndDelete(jobId).catch(() => null);
    }
    
    if (!deletedJob) {
      return res.status(404).json({ 
        success: false, 
        message: 'Training job not found',
        searched_id: jobId
      });
    }
    
    console.log('✅ [CONTROLLER] Training job deleted:', deletedJob._id);
    
    res.json({ 
      success: true, 
      message: 'Training job deleted successfully', 
      deletedId: deletedJob._id,
      deletedJobId: deletedJob.jobId
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Delete training job error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete training job', 
      error: error.message 
    });
  }
};

// ✅ 9. CANCEL TRAINING JOB
export const cancelTrainingJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('🛑 [CONTROLLER] Cancelling training job:', jobId);
    
    // Try to find by custom jobId first, then by MongoDB _id
    let job = await ModelTraining.findOne({ jobId });
    
    if (!job) {
      job = await ModelTraining.findById(jobId).catch(() => null);
    }
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Training job not found',
        searched_id: jobId
      });
    }
    
    // Check if job can be cancelled
    if (job.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed training job'
      });
    }
    
    if (job.status === 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Training job already failed'
      });
    }
    
    if (job.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Training job already cancelled'
      });
    }
    
    // Try to cancel on FastAPI side first
    const isHealthy = await checkFastAPIHealth();
    if (isHealthy) {
      try {
        await axios.post(`${FASTAPI_BASE_URL}/train/cancel/${job.jobId || jobId}`, {}, {
          timeout: 10000
        });
        console.log('✅ [CONTROLLER] FastAPI cancellation requested');
      } catch (fastApiError) {
        console.warn('⚠️ [CONTROLLER] FastAPI cancellation failed:', fastApiError.message);
      }
    }
    
    // Update job status to cancelled
    job.status = 'cancelled';
    job.log = `Training cancelled by user at ${new Date().toISOString()}`;
    job.updatedAt = new Date();
    await job.save();
    
    console.log('✅ [CONTROLLER] Training job cancelled:', job._id);
    
    res.json({
      success: true,
      message: 'Training job cancelled successfully',
      data: {
        id: job._id,
        jobId: job.jobId,
        status: job.status
      }
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Cancel training error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel training job',
      error: error.message
    });
  }
};

// ✅ 10. GET TRAINING JOB BY ID
export const getTrainingJobById = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('🔍 [CONTROLLER] Getting training job:', jobId);
    
    // Try to find by custom jobId first, then by MongoDB _id
    let job = await ModelTraining.findOne({ jobId });
    
    if (!job) {
      job = await ModelTraining.findById(jobId).catch(() => null);
    }
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Training job not found',
        searched_id: jobId
      });
    }
    
    console.log('✅ [CONTROLLER] Training job found:', {
      id: job._id,
      jobId: job.jobId,
      status: job.status
    });
    
    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Get training job error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get training job',
      error: error.message
    });
  }
};

// ✅ 11. GET TRAINING STATUS
export const getTrainingStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('🔍 [CONTROLLER] Getting training status for:', jobId);
    
    // Try to find by custom jobId first, then by MongoDB _id
    let job = await ModelTraining.findOne({ jobId });
    
    if (!job) {
      job = await ModelTraining.findById(jobId).catch(() => null);
    }
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Training job not found',
        searched_id: jobId
      });
    }
    
    console.log('✅ [CONTROLLER] Training status found:', {
      id: job._id,
      jobId: job.jobId,
      status: job.status,
      progress: job.progress
    });
    
    res.json({
      success: true,
      data: {
        id: job._id,
        jobId: job.jobId,
        status: job.status,
        progress: job.progress || 0,
        log: job.log,
        accuracy: job.accuracy,
        model_path: job.model_path,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        baseModel: job.baseModel,
        modelType: job.modelType,
        adapterName: job.adapterName
      }
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Get training status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get training status',
      error: error.message
    });
  }
};

// ✅ 12. GET MODEL STATUS
export const getModelStatus = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    if (!modelId) {
      return res.status(400).json({
        success: false,
        message: 'modelId is required'
      });
    }

    console.log('🔍 [CONTROLLER] Getting model status for:', modelId);
    
    const isHealthy = await checkFastAPIHealth();
    
    if (!isHealthy) {
      return res.json({
        success: false,
        message: 'AI Model service not available',
        status: { status: 'service_unavailable' }
      });
    }
    
    try {
      const fastapiResponse = await axios.get(`${FASTAPI_BASE_URL}/models/${modelId}/status`, { 
        timeout: 10000 
      });
      
      console.log('✅ [CONTROLLER] Model status response:', fastapiResponse.data);
      
      res.json(fastapiResponse.data);
      
    } catch (fastApiError) {
      console.error('❌ [CONTROLLER] FastAPI status error:', fastApiError.message);
      
      if (fastApiError.response?.status === 404) {
        res.status(404).json({
          success: false,
          message: 'Model not found',
          status: { status: 'not_found' }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to get model status',
          error: fastApiError.response?.data || fastApiError.message,
          status: { status: 'error' }
        });
      }
    }
  } catch (error) {
    console.error('❌ [CONTROLLER] Get model status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get model status',
      error: error.message,
      status: { status: 'error' }
    });
  }
};

// ✅ 13. START MODEL TRAINING (Generic wrapper)
export const startModelTraining = async (req, res) => {
  try {
    const { modelType = 'lora', name, parameters, baseModel } = req.body;
    const datasetFile = req.file;

    console.log('🚀 [CONTROLLER] Starting model training:', {
      modelType,
      name,
      baseModel,
      hasFile: !!datasetFile
    });

    if (!datasetFile) {
      return res.status(400).json({ 
        success: false, 
        message: "Dataset file is required for training." 
      });
    }

    // Route to appropriate training method
    if (modelType === 'lora') {
      // Forward to createTrainingJob which handles LoRA training
      return await createTrainingJob(req, res);
    } else {
      return res.status(400).json({
        success: false,
        message: `Model type '${modelType}' is not supported yet. Currently supported: lora`
      });
    }

  } catch (error) {
    console.error('❌ [CONTROLLER] Start training error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to start model training',
      error: error.message
    });
  }
};

// ✅ 14. ALTERNATIVE UNLOAD WITH POST METHOD (Backward compatibility)
export const unloadModelPost = async (req, res) => {
  try {
    const { model_id, modelId } = req.body;
    const targetModelId = model_id || modelId;
    
    if (!targetModelId) {
      return res.status(400).json({
        success: false,
        message: 'model_id or modelId is required'
      });
    }

    console.log('🗑️ [CONTROLLER] Unloading model (POST):', targetModelId);
    
    // Forward to main unload function by setting params
    req.params.modelId = targetModelId;
    return await unloadModel(req, res);
    
  } catch (error) {
    console.error('❌ [CONTROLLER] Unload model (POST) error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to unload model',
      error: error.message
    });
  }
};

// ✅ Export all functions
export {
  // Legacy training functions for backward compatibility
  createTrainingJob as trainLoRAModel,
  cancelTrainingJob as cancelTraining
};
