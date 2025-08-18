import { createContext, useContext, useState } from "react";

const AdminContext = createContext();

const BASE_URL = import.meta.env.VITE_BACKEND_URL + "/api/admin";

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

  const getAnalytics = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/analytics`, {
        headers: authHeader(token),
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  return (
    <AdminContext.Provider
      value={{
        loading,
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
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);
