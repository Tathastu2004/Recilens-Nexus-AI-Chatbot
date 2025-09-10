import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const { getToken } = useAuth();
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [loading, setLoading] = useState(false); // ✅ Add missing loading state
  const [error, setError] = useState(null);
  const [realTimeData, setRealTimeData] = useState(null);

  const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // ✅ Add missing authHeader function
  const authHeader = useCallback((token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), []);

  // ✅ CREATE AXIOS INSTANCE WITH CLERK TOKEN
  const createApiClient = useCallback(async () => {
    const token = await getToken();
    return axios.create({
      baseURL: `${baseURL}/api/admin`,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    });
  }, [getToken, baseURL]);

  // ✅ SYSTEM CONFIG
  const getSystemConfig = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.get("/system");
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [createApiClient]);

  const updateSystemConfig = useCallback(async (config) => {
    setDashboardLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.post("/system", config);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [createApiClient]);

  // ✅ DASHBOARD & ANALYTICS
  const getDashboardStats = useCallback(async () => {
    setDashboardLoading(true);
    setError(null);
    try {
      console.log('📊 Fetching dashboard stats...');
      const apiClient = await createApiClient();
      const res = await apiClient.get("/dashboard");
      console.log('✅ Dashboard stats received:', res.data);
      return res.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ Dashboard stats error:', errorMsg);
      setError(errorMsg);
      // Return fallback data instead of throwing
      return {
        totalUsers: 0,
        totalSessions: 0,
        totalMessages: 0,
        aiMessages: 0
      };
    } finally {
      setDashboardLoading(false);
    }
  }, [createApiClient]);

  const getAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setError(null);
    try {
      console.log('📊 Fetching analytics...');
      const apiClient = await createApiClient();
      const res = await apiClient.get("/analytics");
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
  }, [createApiClient]);

  const generateAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.post("/analytics/generate");
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [createApiClient]);

  const generateRealAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.post("/analytics/generate-real");
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [createApiClient]);

  // ✅ MODEL TRAINING
  const startModelTraining = useCallback(async (trainingData) => {
    setDashboardLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.post("/training/start", trainingData);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [createApiClient]);

  const getTrainingJobs = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.get("/training");
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      // Return fallback data
      return [];
    } finally {
      setDashboardLoading(false);
    }
  }, [createApiClient]);

  const updateTrainingStatus = useCallback(async (id, status) => {
    setDashboardLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.put(`/training/${id}`, { status });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setDashboardLoading(false);
    }
  }, [createApiClient]);

  // ✅ USER MANAGEMENT
  const getAllUsers = useCallback(async () => {
    setUsersLoading(true);
    setError(null);
    try {
      console.log('👥 Fetching all users...');
      const apiClient = await createApiClient();
      const res = await apiClient.get("/users");
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
  }, [createApiClient]);

  const getAllAdmins = useCallback(async () => {
    setUsersLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.get("/admins");
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [createApiClient]);

  const promoteUserToAdmin = useCallback(async (userId) => {
    setUsersLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.put(`/users/${userId}/promote`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [createApiClient]);

  const demoteAdminToClient = useCallback(async (userId) => {
    setUsersLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.put(`/users/${userId}/demote`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [createApiClient]);

  const deleteUser = useCallback(async (userId) => {
    setUsersLoading(true);
    try {
      const apiClient = await createApiClient();
      const res = await apiClient.delete(`/users/${userId}`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setUsersLoading(false);
    }
  }, [createApiClient]);

  // ✅ SYSTEM HEALTH
  const getSystemHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      console.log('🩺 Fetching system health...');
      const apiClient = await createApiClient();
      const res = await apiClient.get("/health");
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
  }, [createApiClient]);

  // ✅ Get real-time analytics (Fixed)
  const getRealTimeAnalytics = useCallback(async (token) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📊 [ADMIN CONTEXT] Fetching real-time analytics...');
      
      const res = await fetch(`${baseURL}/api/admin/analytics/realtime`, {
        headers: authHeader(token),
        cache: "no-store",
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('✅ [ADMIN CONTEXT] Real-time analytics received:', data);
      setRealTimeData(data);
      return data;
    } catch (err) {
      const errorMsg = err.message;
      console.error('❌ [ADMIN CONTEXT] Real-time analytics error:', errorMsg);
      setError(errorMsg);
      
      // Return fallback data instead of throwing
      return {
        success: false,
        summary: {
          totalMessages: 0,
          messages24h: 0,
          messages7d: 0,
          totalUsers: 0,
          activeUsers: 0,
          newUsers24h: 0,
          totalSessions: 0,
          activeSessions: 0,
          avgResponseTime: 500
        },
        intentAnalytics: [],
        hourlyDistribution: [],
        userDistribution: [],
        responseTimeStats: {
          avgResponseTime: 500,
          minResponseTime: 100,
          maxResponseTime: 2000,
          totalRequests: 0
        }
      };
    } finally {
      setLoading(false);
    }
  }, [baseURL, authHeader]);

  // ✅ Set up Server-Sent Events for live updates (Fixed Authentication)
  const startAnalyticsStream = useCallback((token, onUpdate) => {
    try {
      console.log('🔄 [ADMIN CONTEXT] Starting analytics stream...');
      
      // ✅ PASS TOKEN IN URL QUERY PARAMETER (EventSource workaround)
      const url = `${baseURL}/api/admin/analytics/stream?token=${encodeURIComponent(token)}`;
      console.log('📡 [ADMIN CONTEXT] Stream URL configured');
      
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('✅ [ADMIN CONTEXT] Stream connection opened');
      };

      eventSource.onmessage = (event) => {
        try {
          console.log('📨 [ADMIN CONTEXT] Stream data received:', event.data);
          const data = JSON.parse(event.data);
          onUpdate(data);
        } catch (error) {
          console.error('❌ [ADMIN CONTEXT] Stream data parse error:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ [ADMIN CONTEXT] Stream connection error:', error);
        // Log more details about the error
        console.log('EventSource readyState:', eventSource.readyState);
        // Don't close automatically, let the component handle reconnection
      };

      // Return cleanup function
      return () => {
        console.log('🔌 [ADMIN CONTEXT] Closing analytics stream');
        eventSource.close();
      };
      
    } catch (error) {
      console.error('❌ [ADMIN CONTEXT] Stream setup error:', error);
      return () => {}; // Return empty cleanup function
    }
  }, [baseURL]);

  // ✅ MEMOIZE CONTEXT VALUE
  const contextValue = useMemo(() => ({
    // Loading states
    loading: loading || dashboardLoading || usersLoading || healthLoading,
    dashboardLoading,
    analyticsLoading,
    usersLoading,
    healthLoading,
    error,
    realTimeData,
    setRealTimeData,
    
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
    getRealTimeAnalytics,
    startAnalyticsStream,
  }), [
    loading,
    dashboardLoading,
    analyticsLoading,
    usersLoading,
    healthLoading,
    error,
    realTimeData,
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
    getRealTimeAnalytics,
    startAnalyticsStream,
  ]);

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
