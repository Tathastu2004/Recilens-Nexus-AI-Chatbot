import React, { createContext, useContext, useReducer, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Initial State
const initialState = {
  ingestedDocuments: [],
  ingestionLoading: false,
  modelStatus: {},
  modelLoading: false,
  error: null,
  notifications: [],
  isConnected: true,
  ragStatus: {
    available: false,
    message: "RAG status unknown"
  }
};

// Action Types
const actionTypes = {
  SET_INGESTION_LOADING: 'SET_INGESTION_LOADING',
  SET_MODEL_LOADING: 'SET_MODEL_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  
  // RAG Document Actions
  SET_INGESTED_DOCUMENTS: 'SET_INGESTED_DOCUMENTS',
  ADD_INGESTED_DOCUMENT: 'ADD_INGESTED_DOCUMENT',
  REMOVE_INGESTED_DOCUMENT: 'REMOVE_INGESTED_DOCUMENT',
  
  // Model Actions
  SET_MODEL_STATUS: 'SET_MODEL_STATUS',
  SET_RAG_STATUS: 'SET_RAG_STATUS',
};

const modelManagementReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_INGESTION_LOADING:
      return { ...state, ingestionLoading: action.payload };
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
    case actionTypes.SET_INGESTED_DOCUMENTS:
      return { ...state, ingestedDocuments: action.payload };
    case actionTypes.ADD_INGESTED_DOCUMENT:
      return {
        ...state,
        ingestedDocuments: [action.payload, ...(state.ingestedDocuments || [])]
      };
    case actionTypes.REMOVE_INGESTED_DOCUMENT:
      return {
        ...state,
        ingestedDocuments: (state.ingestedDocuments || []).filter(doc => 
          doc.docId !== action.payload
        )
      };
    case actionTypes.SET_MODEL_STATUS:
      return {
        ...state,
        modelStatus: {
          ...state.modelStatus,
          [action.payload.modelId]: action.payload.status
        }
      };
    case actionTypes.SET_RAG_STATUS:
      return { ...state, ragStatus: action.payload };
    default:
      return state;
  }
};

const ModelManagementContext = createContext();

export const ModelManagementProvider = ({ children }) => {
  const [state, dispatch] = useReducer(modelManagementReducer, initialState);
  const { getToken } = useAuth();

  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  const createApiClient = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication token not available. Please sign in again.');
      const baseURL = `${API_BASE}/api/admin`;
      const client = axios.create({
        baseURL,
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

  // **RAG DOCUMENT MANAGEMENT FUNCTIONS**
  const getIngestedDocuments = useCallback(async () => {
    dispatch({ type: actionTypes.SET_INGESTION_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get('/model/ingested-documents');
      
      if (response.data.success) {
        dispatch({ type: actionTypes.SET_INGESTED_DOCUMENTS, payload: response.data.data || [] });
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Failed to fetch documents');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      dispatch({ type: actionTypes.SET_INGESTED_DOCUMENTS, payload: [] });
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_INGESTION_LOADING, payload: false });
    }
  }, [createApiClient]);

  const ingestDataSheet = useCallback(async (docId, dataSheetFile) => {
    dispatch({ type: actionTypes.SET_INGESTION_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const formData = new FormData();
      formData.append('dataSheetFile', dataSheetFile);
      formData.append('docId', docId);
      
      const response = await apiClient.post('/model/ingest-data', formData);
      
      if (response.data.success) {
        const { data } = response.data;
        
        let notificationType = 'success';
        let message = response.data.message;
        
        // ✅ Determine notification type based on status
        if (data.ragIndexed) {
          notificationType = 'success';
          message = `✅ ${data.fileName} fully processed and indexed for search.`;
        } else {
          notificationType = 'warning';
          message = `⚠️ ${data.fileName} uploaded successfully, but RAG indexing is unavailable.`;
        }
        
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: notificationType, message }
        });
        
        // ✅ Refresh the document list
        await getIngestedDocuments();
        
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
      
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ 
        type: actionTypes.SET_ERROR, 
        payload: `Upload failed: ${errorMsg}` 
      });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_INGESTION_LOADING, payload: false });
    }
  }, [createApiClient, getIngestedDocuments]);

  const deleteDataSheet = useCallback(async (docId) => {
    dispatch({ type: actionTypes.SET_INGESTION_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      
      // ✅ FIXED: Send docId in request body for DELETE request
      const response = await apiClient.delete('/model/delete-data', {
        data: { docId }
      });
      
      if (response.data.success) {
        const { data } = response.data;
        
        // ✅ Show appropriate message based on deletion result
        let message = `✅ Document deleted successfully: ${data?.fileName || docId}`;
        let notificationType = 'success';
        
        if (!data?.deletedFromRAG && data?.ragAvailable !== false) {
          message += ` (RAG cleanup partially failed but document is no longer accessible)`;
          notificationType = 'warning';
        }
        
        dispatch({
          type: actionTypes.ADD_NOTIFICATION,
          payload: { type: notificationType, message }
        });
        
        // ✅ Refresh the document list
        await getIngestedDocuments();
        
      } else {
        throw new Error(response.data.message || 'Delete failed');
      }
      
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ 
        type: actionTypes.SET_ERROR, 
        payload: `Delete failed: ${errorMsg}` 
      });
      throw error;
    } finally {
      dispatch({ type: actionTypes.SET_INGESTION_LOADING, payload: false });
    }
  }, [createApiClient, getIngestedDocuments]);

  // **MODEL MANAGEMENT FUNCTIONS**
  const getModels = useCallback(async () => {
    dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: true });
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get('/model/models');
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Failed to fetch models');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMsg });
      return [];
    } finally {
      dispatch({ type: actionTypes.SET_MODEL_LOADING, payload: false });
    }
  }, [createApiClient]);

  const getModelStatus = useCallback(async (modelId) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/model/models/${modelId}/status`);
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

  const getRagStatus = useCallback(async () => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get('/model/models/rag_llama3/status');
      if (response.data.success) {
        dispatch({ type: actionTypes.SET_RAG_STATUS, payload: {
          available: response.data.status === 'available',
          message: response.data.description || 'RAG status unknown'
        }});
      }
    } catch (error) {
      dispatch({ type: actionTypes.SET_RAG_STATUS, payload: {
        available: false,
        message: 'RAG status unavailable'
      }});
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
    ...state,
    ingestDataSheet,
    deleteDataSheet,
    getIngestedDocuments,
    getModels,
    getModelStatus,
    getRagStatus,
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
