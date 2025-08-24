import { createContext, useContext, useState, useMemo, useCallback } from "react";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_URL + "/api/admin";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  // ✅ FIX: Separate loading states to prevent unnecessary re-renders
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ FIX: Create axios instance with timeout
  const apiClient = useMemo(() => axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { "Content-Type": "application/json" }
  }), []);

  // ✅ FIX: Optimize token retrieval
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('token') || 
           localStorage.getItem('adminToken') || 
           localStorage.getItem('authToken');
  }, []);

  const authHeader = useCallback(() => {
    const token = getAuthToken();
    return token ? {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    } : { "Content-Type": "application/json" };
  }, [getAuthToken]);

  // SYSTEM CONFIG
  const getSystemConfig = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await apiClient.get("/system", {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [apiClient, authHeader]);

  const updateSystemConfig = useCallback(async (config) => {
    setDashboardLoading(true);
    try {
      const res = await apiClient.post("/system", config, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [apiClient, authHeader]);

  // ✅ FIX: DASHBOARD & ANALYTICS with proper error handling
  const getDashboardStats = useCallback(async () => {
    setDashboardLoading(true);
    setError(null);
    try {
      console.log('📊 Fetching dashboard stats...');
      const res = await apiClient.get("/dashboard", {
        headers: authHeader(),
      });
      console.log('✅ Dashboard stats received:', res.data);
      return res.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ Dashboard stats error:', errorMsg);
      setError(errorMsg);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [apiClient, authHeader]);

  const getAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setError(null);
    try {
      console.log('📊 Fetching analytics...');
      const res = await apiClient.get("/analytics", {
        headers: authHeader(),
      });
      console.log('✅ Analytics received:', res.data);
      return Array.isArray(res.data) ? res.data : res.data.analytics || [];
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ Analytics error:', errorMsg);
      setError(errorMsg);
      return []; // Return empty array instead of throwing
    } finally {
      setAnalyticsLoading(false);
    }
  }, [apiClient, authHeader]);

  const generateAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await apiClient.post("/analytics/generate", {}, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [apiClient, authHeader]);

  const generateRealAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await apiClient.post("/analytics/generate-real", {}, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [apiClient, authHeader]);

  // MODEL MANAGEMENT
  const startModelTraining = useCallback(async (payload) => {
    setDashboardLoading(true);
    try {
      const res = await apiClient.post("/model/training", payload, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [apiClient, authHeader]);

  const getTrainingJobs = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await apiClient.get("/model/training", {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [apiClient, authHeader]);

  const updateTrainingStatus = useCallback(async (id, status) => {
    setDashboardLoading(true);
    try {
      const res = await apiClient.put(`/model/training/${id}`, { status }, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [apiClient, authHeader]);

  // ✅ FIX: USER & ADMIN MANAGEMENT with proper error handling
  const getAllUsers = useCallback(async () => {
    setUsersLoading(true);
    setError(null);
    try {
      console.log('👥 Fetching all users...');
      const res = await apiClient.get("/users", {
        headers: authHeader(),
      });
      console.log('✅ Users received:', res.data);
      return res.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ Users fetch error:', errorMsg);
      setError(errorMsg);
      return { users: [] }; // Return empty users instead of throwing
    } finally {
      setUsersLoading(false);
    }
  }, [apiClient, authHeader]);

  const getAllAdmins = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await apiClient.get("/admins", {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [apiClient, authHeader]);

  const promoteUserToAdmin = useCallback(async (userId) => {
    setUsersLoading(true);
    try {
      const res = await apiClient.put(`/users/${userId}/promote`, {}, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [apiClient, authHeader]);

  const demoteAdminToClient = useCallback(async (userId) => {
    setUsersLoading(true);
    try {
      const res = await apiClient.put(`/users/${userId}/demote`, {}, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [apiClient, authHeader]);

  const deleteUser = useCallback(async (userId) => {
    setUsersLoading(true);
    try {
      const res = await apiClient.delete(`/users/${userId}`, {
        headers: authHeader(),
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [apiClient, authHeader]);

  // ✅ FIX: SYSTEM HEALTH with better error handling
  const getSystemHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      console.log('🩺 Fetching system health...');
      const res = await apiClient.get("/health", {
        headers: authHeader(),
      });
      console.log('✅ System health data received:', res.data);
      return res.data;
    } catch (error) {
      const errorMessage = `System health check failed: ${error.message}`;
      console.error('❌ System health error:', error);
      
      return {
        error: true,
        message: errorMessage,
        overall: 'unhealthy',
        services: {
          database: { status: 'unknown' },
          fastapi: { status: 'unknown' },
          llama: { status: 'unknown' },
          blip: { status: 'unknown' }
        },
        timestamp: new Date().toISOString()
      };
    } finally {
      setHealthLoading(false);
    }
  }, [apiClient, authHeader]);

  // ✅ FIX: Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Loading states
    loading: dashboardLoading || usersLoading || healthLoading,
    dashboardLoading,
    analyticsLoading,
    usersLoading,
    healthLoading,
    error,
    
    // Functions
    getSystemConfig,
    updateSystemConfig,
    getDashboardStats,
    getAnalytics,
    generateAnalytics,
    startModelTraining,
    getTrainingJobs,
    updateTrainingStatus,
    getAllUsers,
    getAllAdmins,
    promoteUserToAdmin,
    demoteAdminToClient,
    deleteUser,
    generateRealAnalytics,
    getSystemHealth,
  }), [
    dashboardLoading,
    analyticsLoading,
    usersLoading,
    healthLoading,
    error,
    getSystemConfig,
    updateSystemConfig,
    getDashboardStats,
    getAnalytics,
    generateAnalytics,
    startModelTraining,
    getTrainingJobs,
    updateTrainingStatus,
    getAllUsers,
    getAllAdmins,
    promoteUserToAdmin,
    demoteAdminToClient,
    deleteUser,
    generateRealAnalytics,
    getSystemHealth,
  ]);

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);
