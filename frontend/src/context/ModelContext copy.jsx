import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Initial State
const initialState = {
  trainingJobs: [],
  activeTraining: null,
  trainingLoading: false,
  loadedModels: [],
  availableAdapters: [],
  modelStatus: {},
  modelLoading: false,
  error: null,
  notifications: [],
  isConnected: true
};

// Action Types
const actionTypes = {
  SET_TRAINING_LOADING: 'SET_TRAINING_LOADING',
  SET_MODEL_LOADING: 'SET_MODEL_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  
  // Training Actions
  SET_TRAINING_JOBS: 'SET_TRAINING_JOBS',
  ADD_TRAINING_JOB: 'ADD_TRAINING_JOB',
  UPDATE_TRAINING_JOB: 'UPDATE_TRAINING_JOB',
  SET_ACTIVE_TRAINING: 'SET_ACTIVE_TRAINING',
  REMOVE_TRAINING_JOB: 'REMOVE_TRAINING_JOB',
  
  // Model Actions
  SET_LOADED_MODELS: 'SET_LOADED_MODELS',
  SET_AVAILABLE_ADAPTERS: 'SET_AVAILABLE_ADAPTERS',
  SET_MODEL_STATUS: 'SET_MODEL_STATUS',
  ADD_LOADED_MODEL: 'ADD_LOADED_MODEL',
  REMOVE_LOADED_MODEL: 'REMOVE_LOADED_MODEL'
};

// Reducer
const modelManagementReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_TRAINING_LOADING:
      return { ...state, trainingLoading: action.payload };
    case actionTypes.SET_MODEL_LOADING:
      return { ...state, modelLoading: action.payload };
    case actionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        notifications: [...state.notifications, {
          id: Date.now(),
          type: 'error',
          message: action.payload,
          timestamp: new Date()
        }]
      };
    case actionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    case actionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, {
          id: Date.now(),
          ...action.payload,
          timestamp: new Date()
        }]
      };
    case actionTypes.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    // Training Actions
    case actionTypes.SET_TRAINING_JOBS:
      return { ...state, trainingJobs: action.payload };
    case actionTypes.ADD_TRAINING_JOB:
      return {
        ...state,
        trainingJobs: [action.payload, ...state.trainingJobs]
      };
    case actionTypes.UPDATE_TRAINING_JOB:
      return {
        ...state,
        trainingJobs: state.trainingJobs.map(job =>
          job._id === action.payload._id || job.jobId === action.payload.jobId ? 
            { ...job, ...action.payload } : job
        )
      };
    case actionTypes.SET_ACTIVE_TRAINING:
      return { ...state, activeTraining: action.payload };
    case actionTypes.REMOVE_TRAINING_JOB:
      return {
        ...state,
        trainingJobs: state.trainingJobs.filter(job => 
          job._id !== action.payload && job.jobId !== action.payload
        )
      };
    
    // Model Actions
    case actionTypes.SET_LOADED_MODELS:
      return { ...state, loadedModels: action.payload };
    case actionTypes.SET_AVAILABLE_ADAPTERS:
      return { ...state, availableAdapters: action.payload };
    case actionTypes.SET_MODEL_STATUS:
      return {
        ...state,
        modelStatus: {
          ...state.modelStatus,
          [action.payload.modelId]: action.payload.status
        }
      };
    case actionTypes.ADD_LOADED_MODEL:
      return {
        ...state,
        loadedModels: [...state.loadedModels, action.payload]
      };
    case actionTypes.REMOVE_LOADED_MODEL:
      return {
        ...state,
        loadedModels: state.loadedModels.filter(model => 
          model.modelId !== action.payload && model.id !== action.payload
        )
      };
    
    default:
      return state;
  }
};

const ModelManagementContext = createContext();

export const ModelManagementProvider = ({ children }) => {
  const [state, dispatch] = useReducer(modelManagementReducer, initialState);
  const { getToken } = useAuth();
  const prevCompletedCount = useRef(0);

  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  const createApiClient = useCallback(async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('Authentication token not available. Please sign in again.');
      }
      
      const baseURL = `${API_BASE}/api/admin`;
      
      const client = axios.create({
        baseURL: baseURL,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });
      
      client.interceptors.request.use(
        (request) => {
          if (request.data instanceof FormData) {
            delete request.headers['Content-Type']; 
          }
          return request;
        },
        (error) => Promise.reject(error)
      );
      
      return client;
      
    } catch (error) {
      console.error('❌ [MODEL CONTEXT] Failed to create API client:', error);
      throw error;
    }
  }, [getToken, API_BASE]);

  // **TRAINING MANAGEMENT FUNCTIONS**
  const getTrainingJobs = useCallback(async (filters = {}) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const params = new URLSearchParams(filters);
      const response = await apiClient.get(`/model/training-jobs?${params}`);
      
      const jobs = response.data.success ? (response.data.data || []) : [];
      dispatch({ type: actionTypes.SET_TRAINING_JOBS, payload: jobs });
      return jobs;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      dispatch({ type: actionTypes.SET_TRAINING_JOBS, payload: [] });
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, [createApiClient]);

  const startModelTraining = useCallback(async (jobName, datasetFile, modelType, parameters = {}, baseModel) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      
      const formData = new FormData();
      formData.append('name', jobName);
      formData.append('modelType', modelType);
      formData.append('datasetFile', datasetFile);
      formData.append('parameters', JSON.stringify(parameters));
      formData.append('baseModel', baseModel);
      
      const response = await apiClient.post('/model/training-jobs', formData);
      
      if (response.data.success) {
        dispatch({ type: actionTypes.ADD_TRAINING_JOB, payload: response.data.data });
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: 'success', message: `Training job "${jobName}" started successfully.` }
        });
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, [createApiClient]);

  const startLoRATraining = useCallback(async (trainingData) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      console.log('🚀 [MODEL CONTEXT] Starting LoRA training:', trainingData);
      
      const apiClient = await createApiClient();
      
      const formData = new FormData();
      formData.append('name', `LoRA-${trainingData.jobId || Date.now()}`);
      formData.append('modelType', 'lora');
      formData.append('datasetFile', trainingData.datasetFile);
      formData.append('baseModel', trainingData.base_model || 'llama3');
      formData.append('parameters', JSON.stringify(trainingData.parameters || {}));
      
      console.log('📤 [MODEL CONTEXT] Sending LoRA training request...');
      
      const response = await apiClient.post('/model/training-jobs', formData);
      
      console.log('✅ [MODEL CONTEXT] LoRA training response:', response.data);
      
      if (response.data.success) {
        dispatch({ type: actionTypes.ADD_TRAINING_JOB, payload: response.data.data });
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { 
            type: 'success', 
            message: `LoRA training job started successfully.` 
          }
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ [MODEL CONTEXT] Start LoRA training error:', error);
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, [createApiClient]);

  const getTrainingDetails = useCallback(async (jobId) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/model/training/${jobId}`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    }
  }, [createApiClient]);

  const cancelTraining = useCallback(async (jobId) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.post(`/model/training/${jobId}/cancel`);
      
      if (response.data.success) {
        dispatch({
          type: actionTypes.UPDATE_TRAINING_JOB,
          payload: { _id: jobId, status: 'cancelled' }
        });
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: 'warning', message: 'Training job cancelled' }
        });
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    }
  }, [createApiClient]);

  const deleteTrainingJob = useCallback(async (jobId) => {
    try {
      const apiClient = await createApiClient();
      await apiClient.delete(`/model/training-jobs/${jobId}`);
      dispatch({ type: actionTypes.REMOVE_TRAINING_JOB, payload: jobId });
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    }
  }, [createApiClient]);

  // **MODEL MANAGEMENT FUNCTIONS**
  const getLoadedModels = useCallback(async () => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get('/model/loaded');
      
      const models = response.data.success ? (response.data.data || []) : [];
      dispatch({ type: actionTypes.SET_LOADED_MODELS, payload: models });
      
      return models;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      dispatch({ type: actionTypes.SET_LOADED_MODELS, payload: [] });
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient]);

  const getAvailableAdapters = useCallback(async () => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get('/model/available-adapters');
      
      const adapters = response.data.success ? (response.data.data || []) : [];
      dispatch({ type: actionTypes.SET_AVAILABLE_ADAPTERS, payload: adapters }); 
      
      return adapters;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      dispatch({ type: actionTypes.SET_AVAILABLE_ADAPTERS, payload: [] });
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient]);

  const loadLoRAAdapter = useCallback(async (adapterPath, baseModel = 'llama3') => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.post('/model/load-lora', {
        adapter_path: adapterPath,
        base_model: baseModel
      });
      
      if (response.data.success) {
        dispatch({ 
          type: actionTypes.ADD_NOTIFICATION, 
          payload: { type: 'success', message: `LoRA adapter loaded successfully` } 
        });
        await getLoadedModels();
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient, getLoadedModels]);

  const getModelStatus = useCallback(async (modelId) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/model/status/${modelId}`);
      
      if (response.data.success) {
        dispatch({
          type: actionTypes.SET_MODEL_STATUS,
          payload: { modelId, status: response.data.status }
        });
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    }
  }, [createApiClient]);

  const unloadModel = useCallback(async (modelId) => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.delete(`/model/unload/${modelId}`);
      
      if (response.data.success) {
        dispatch({ type: actionTypes.ADD_NOTIFICATION, payload: { type: 'success', message: `Model ${modelId} unloaded successfully` } });
        await getLoadedModels();
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient, getLoadedModels]);

  // **UTILITY FUNCTIONS**
  const clearError = useCallback(() => {
    dispatch({ type: actionTypes.CLEAR_ERROR });
  }, []);

  const removeNotification = useCallback((notificationId) => {
    dispatch({ type: actionTypes.REMOVE_NOTIFICATION, payload: notificationId });
  }, []);

  // **AUTO-REFRESH FOR ACTIVE TRAININGS**
  useEffect(() => {
    let refreshInterval;
    
    const refreshData = async () => {
      try {
        const activeTrainings = state.trainingJobs.filter(job => 
          ['running', 'pending'].includes(job.status)
        );
        
        if (activeTrainings.length > 0) {
          await getTrainingJobs();
        }
      } catch (error) {
        console.warn('⚠️ [MODEL CONTEXT] Auto-refresh failed:', error.message);
      }
    };
    
    const hasActiveTrainings = state.trainingJobs.some(job => 
      ['running', 'pending'].includes(job.status)
    );
    
    if (hasActiveTrainings) {
      refreshInterval = setInterval(refreshData, 5000);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [state.trainingJobs, getTrainingJobs]);

  const contextValue = {
    ...state,
    startModelTraining,
    startLoRATraining,
    getTrainingJobs,
    getTrainingDetails,
    cancelTraining,
    deleteTrainingJob,
    getLoadedModels,
    getAvailableAdapters,
    loadLoRAAdapter,
    getModelStatus,
    unloadModel,
    clearError,
    removeNotification
  };

  return (
    <ModelManagementContext.Provider value={contextValue}>
      {children}
    </ModelManagementContext.Provider>
  );
};

export const useModelManagement = () => {
  const context = useContext(ModelManagementContext);
  if (!context) {
    throw new Error('useModelManagement must be used within a ModelManagementProvider');
  }
  return context;
};

export { actionTypes };
