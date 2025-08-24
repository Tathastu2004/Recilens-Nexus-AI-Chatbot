import { createContext, useContext, useState } from "react";

// Use NODE_BACKEND_URL from env
const BASE_URL = import.meta.env.VITE_NODE_BACKEND_URL + "/api/admin";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const authHeader = (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  /**
   * ===============================
   *  SYSTEM CONFIG
   * ===============================
   */
  const getSystemConfig = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/system`, {
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSystemConfig = async (token, config) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/system`, {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(config),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ===============================
   *  DASHBOARD & ANALYTICS
   * ===============================
   */

  const getDashboardStats = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/dashboard`, {
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  const getAnalytics = async (token) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`${BASE_URL}/analytics`, {
        headers: authHeader(token),
        cache: "no-store", // ensure fresh fetch from network
      });
      const data = await res.json();
      return data;
    } catch (err) {
      setAnalyticsError(err.message);
      throw err;
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const generateAnalytics = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/analytics/generate`, {
        method: "POST",
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateRealAnalytics = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/analytics/generate-real`, {
        method: "POST",
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * ===============================
   *  MODEL MANAGEMENT
   * ===============================
   */
  const startModelTraining = async (token, payload) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/model/training`, {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTrainingJobs = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/model/training`, {
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateTrainingStatus = async (token, id, status) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/model/training/${id}`, {
        method: "PUT",
        headers: authHeader(token),
        body: JSON.stringify({ status }),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ===============================
   *  USER & ADMIN MANAGEMENT
   * ===============================
   */
  const getAllUsers = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users`, {
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAllAdmins = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/admins`, {
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const promoteUserToAdmin = async (token, userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users/${userId}/promote`, {
        method: "PUT",
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const demoteAdminToClient = async (token, userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users/${userId}/demote`, {
        method: "PUT",
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (token, userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users/${userId}`, {
        method: "DELETE",
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add getSystemHealth using the correct BASE_URL
 const getSystemHealth = async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('adminToken') || 
                  localStorage.getItem('authToken') || '';
    
    const response = await fetch(`${BASE_URL}/health`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch system health`);
    }

    const data = await response.json();
    console.log('✅ System health data received:', data);
    return data;
    
  } catch (error) {
    const errorMessage = `System health check failed: ${error.message}`;
    setError(errorMessage);
    console.error('❌ System health error:', error);
    
    // Return fallback data structure
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
    setLoading(false);
  }
};


  return (
    <AdminContext.Provider
      value={{
        loading,
        error,
        getSystemConfig,
        updateSystemConfig,
        getDashboardStats,
        getAnalytics,
        analyticsLoading,
        analyticsError,
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
        getSystemHealth, // ← Add this
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);
