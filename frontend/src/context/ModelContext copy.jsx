import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Initial State
const initialState = {
  // Training Jobs
  trainingJobs: [],
  activeTraining: null,
  trainingLoading: false,
  
  // Model Management
  loadedModels: [],
  modelStatus: {},
  modelLoading: false,
  
  // Global States
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
          job._id === action.payload._id ? { ...job, ...action.payload } : job
        )
      };
    
    case actionTypes.SET_ACTIVE_TRAINING:
      return { ...state, activeTraining: action.payload };
    
    case actionTypes.REMOVE_TRAINING_JOB:
      return {
        ...state,
        trainingJobs: state.trainingJobs.filter(job => job._id !== action.payload)
      };
    
    // Model Actions
    case actionTypes.SET_LOADED_MODELS:
      return { ...state, loadedModels: action.payload };
    
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
        loadedModels: state.loadedModels.filter(model => model.modelId !== action.payload)
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

  // Use Vite env or fallback
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // ✅ CREATE AXIOS INSTANCE WITH CLERK TOKEN
  const createApiClient = useCallback(async () => {
    const token = await getToken();
    return axios.create({
      baseURL: `${API_BASE}/api/admin`,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    });
  }, [getToken, API_BASE]);

  // **TRAINING MANAGEMENT FUNCTIONS**
  const startModelTraining = useCallback(async (modelName, dataset, parameters = {}) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.post('/training/start', {
        modelName,
        dataset,
        parameters
      });
      
      if (response.data.success) {
        dispatch({ type: actionTypes.ADD_TRAINING_JOB, payload: response.data.training });
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: 'success', message: `Training started for ${modelName}` }
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

  const getTrainingJobs = useCallback(async (filters = {}) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const params = new URLSearchParams(filters);
      const response = await apiClient.get(`/training-jobs?${params}`);
      
      // ✅ FIX: Extract jobs correctly from response
      const jobs = response.data.success ? (response.data.data || []) : [];
      dispatch({ type: actionTypes.SET_TRAINING_JOBS, payload: jobs });
      return jobs;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      dispatch({ type: actionTypes.SET_TRAINING_JOBS, payload: [] }); // ✅ ENSURE EMPTY ARRAY
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, [createApiClient]);

  const getTrainingDetails = useCallback(async (jobId) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/training/${jobId}`);
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
      const response = await apiClient.post(`/training/${jobId}/cancel`);
      
      if (response.data.success) {
        dispatch({
          type: actionTypes.UPDATE_TRAINING_JOB,
          payload: { _id: jobId, status: 'failed' }
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
      await apiClient.delete(`/training/${jobId}`);
      dispatch({ type: actionTypes.REMOVE_TRAINING_JOB, payload: jobId });
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    }
  }, [createApiClient]);

  // **MODEL MANAGEMENT FUNCTIONS** (✅ FIXED PATHS)
  const getLoadedModels = useCallback(async () => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      console.log('🤖 [MODEL CONTEXT] Fetching loaded models...');
      const apiClient = await createApiClient();
      const response = await apiClient.get('/model/loaded');
      
      console.log('📥 [MODEL CONTEXT] Raw response:', response.data);
      
      // ✅ FIX: Extract models correctly from response
      const models = response.data.success ? (response.data.data || []) : [];
      dispatch({ type: actionTypes.SET_LOADED_MODELS, payload: models });
      
      console.log('✅ [MODEL CONTEXT] Loaded models set:', models);
      return models;
    } catch (error) {
      console.error('❌ [MODEL CONTEXT] Get loaded models error:', error);
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      dispatch({ type: actionTypes.SET_LOADED_MODELS, payload: [] }); // ✅ ENSURE EMPTY ARRAY
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient]);

  const getModelStatus = useCallback(async (modelId) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/model/${modelId}/status`);
      
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

  const loadModel = useCallback(async (modelId, modelData) => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.post(`/model/${modelId}/load`, modelData);
      
      if (response.data.success) {
        dispatch({ type: actionTypes.ADD_LOADED_MODEL, payload: response.data });
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: 'success', message: `Model ${modelId} loaded successfully` }
        });
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient]);

  const unloadModel = useCallback(async (modelId) => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.post(`/model/${modelId}/unload`);
      
      if (response.data.success) {
        dispatch({ type: actionTypes.REMOVE_LOADED_MODEL, payload: modelId });
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: 'info', message: `Model ${modelId} unloaded` }
        });
      }
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient]);

  // **UTILITY FUNCTIONS**
  const clearError = useCallback(() => {
    dispatch({ type: actionTypes.CLEAR_ERROR });
  }, []);

  const removeNotification = useCallback((notificationId) => {
    dispatch({ type: actionTypes.REMOVE_NOTIFICATION, payload: notificationId });
  }, []);

  const contextValue = {
    // State
    ...state,
    
    // Training Functions
    startModelTraining,
    getTrainingJobs,
    getTrainingDetails,
    cancelTraining,
    deleteTrainingJob,
    
    // Model Management Functions
    getLoadedModels,
    getModelStatus,
    loadModel,
    unloadModel,
    
    // Utility Functions
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
