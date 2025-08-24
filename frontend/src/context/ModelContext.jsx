import React, { createContext, useContext, useReducer, useCallback } from 'react';
import axios from 'axios';

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

  // Use Vite env or fallback
  const API_BASE = (import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : 'http://localhost:3000') + '/api';

  // Improved token retrieval
  const getAuthToken = () => {
    return localStorage.getItem('adminToken') ||
           localStorage.getItem('token') ||
           localStorage.getItem('authToken');
  };

  // Axios instance with improved interceptors
  const apiClient = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' }
  });

  // Request interceptor for auth header
  apiClient.interceptors.request.use(
    (config) => {
      const token = getAuthToken();
      console.log('Token found:', token ? 'Yes' : 'No'); // Debug log
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Authorization header set:', config.headers.Authorization); // Debug log
      } else {
        console.log('No token found in localStorage'); // Debug log
      }
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log('Unauthorized - clearing token');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        // Optionally redirect to login
        // window.location.href = '/login';
      }
      const message = error.response?.data?.error || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: message });
      return Promise.reject(error);
    }
  );

  // **TRAINING MANAGEMENT FUNCTIONS**
  // Maps to: POST /admin/model/training/start
  const startModelTraining = useCallback(async (modelName, dataset, parameters = {}) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const response = await apiClient.post('/admin/model/training/start', {
        modelName,
        dataset,
        parameters
      });
      dispatch({ type: actionTypes.ADD_TRAINING_JOB, payload: response.data.training });
      dispatch({
        type: actionTypes.ADD_NOTIFICATION,
        payload: { type: 'success', message: `Training started for ${modelName}` }
      });
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, []);

  // Maps to: GET /admin/model/training
  const getTrainingJobs = useCallback(async (filters = {}) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const params = new URLSearchParams(filters);
      const response = await apiClient.get(`/admin/model/training?${params}`);
      dispatch({ type: actionTypes.SET_TRAINING_JOBS, payload: response.data });
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, []);

  // Maps to: GET /admin/model/training/:id
  const getTrainingDetails = useCallback(async (jobId) => {
    try {
      const response = await apiClient.get(`/admin/model/training/${jobId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }, []);

  // Maps to: PUT /admin/model/training/:id/cancel
  const cancelTraining = useCallback(async (jobId) => {
    try {
      const response = await apiClient.put(`/admin/model/training/${jobId}/cancel`);
      dispatch({
        type: actionTypes.UPDATE_TRAINING_JOB,
        payload: { _id: jobId, status: 'failed' }
      });
      dispatch({
        type: actionTypes.ADD_NOTIFICATION,
        payload: { type: 'warning', message: 'Training job cancelled' }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }, []);

  // Maps to: DELETE /admin/model/training/:id
  const deleteTrainingJob = useCallback(async (jobId) => {
    try {
      await apiClient.delete(`/admin/model/training/${jobId}`);
      dispatch({ type: actionTypes.REMOVE_TRAINING_JOB, payload: jobId });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }, []);

  // Maps to: GET /admin/model/training/search
  const searchTrainingJobs = useCallback(async (searchParams) => {
    dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: true });
    try {
      const params = new URLSearchParams(searchParams);
      const response = await apiClient.get(`/admin/model/training/search?${params}`);
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_TRAINING_LOADING, payload: false });
    }
  }, []);

  // Maps to: GET /admin/model/training/:id/export
  const exportTrainingLogs = useCallback(async (jobId, format = 'json') => {
    try {
      const response = await apiClient.get(`/admin/model/training/${jobId}/export?format=${format}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `training_${jobId}_logs.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }, []);

  // **MODEL MANAGEMENT FUNCTIONS**
  // Maps to: GET /admin/model/loaded
  const getLoadedModels = useCallback(async () => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const response = await apiClient.get('/admin/model/loaded');
      dispatch({ type: actionTypes.SET_LOADED_MODELS, payload: response.data.loadedModels });
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, []);

  // Maps to: GET /admin/model/:modelId/status
  const getModelStatus = useCallback(async (modelId) => {
    try {
      const response = await apiClient.get(`/admin/model/${modelId}/status`);
      dispatch({
        type: actionTypes.SET_MODEL_STATUS,
        payload: { modelId, status: response.data }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }, []);

  // Maps to: POST /admin/model/:modelId/load
  const loadModel = useCallback(async (modelId, modelData) => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const response = await apiClient.post(`/admin/model/${modelId}/load`, modelData);
      dispatch({ type: actionTypes.ADD_LOADED_MODEL, payload: response.data });
      dispatch({
        type: actionTypes.ADD_NOTIFICATION,
        payload: { type: 'success', message: `Model ${modelId} loaded successfully` }
      });
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, []);

  // Maps to: POST /admin/model/:modelId/unload
  const unloadModel = useCallback(async (modelId) => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const response = await apiClient.post(`/admin/model/${modelId}/unload`);
      dispatch({ type: actionTypes.REMOVE_LOADED_MODEL, payload: modelId });
      dispatch({
        type: actionTypes.ADD_NOTIFICATION,
        payload: { type: 'info', message: `Model ${modelId} unloaded` }
      });
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, []);

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
    startModelTraining,       // POST /admin/model/training/start
    getTrainingJobs,          // GET /admin/model/training
    getTrainingDetails,       // GET /admin/model/training/:id
    cancelTraining,           // PUT /admin/model/training/:id/cancel
    deleteTrainingJob,        // DELETE /admin/model/training/:id
    searchTrainingJobs,       // GET /admin/model/training/search
    exportTrainingLogs,       // GET /admin/model/training/:id/export
    
    // Model Management Functions
    getLoadedModels,          // GET /admin/model/loaded
    getModelStatus,           // GET /admin/model/:modelId/status
    loadModel,                // POST /admin/model/:modelId/load
    unloadModel,              // POST /admin/model/:modelId/unload
    
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
