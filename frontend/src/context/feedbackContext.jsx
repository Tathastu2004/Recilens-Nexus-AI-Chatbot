import React, { createContext, useContext, useState, useCallback } from "react";
import axios from "axios";

// Base URL for feedback API
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const FEEDBACK_API_BASE = `${BACKEND_URL}/api/feedback`;

const FeedbackContext = createContext();

export const FeedbackProvider = ({ children }) => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to get auth token from localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 1. CLIENT: Create new feedback
  // POST /api/feedback/
// Remove email from createFeedback function
const createFeedback = useCallback(async ({ subject, message }) => {
  setLoading(true);
  setError(null);
  try {
    const response = await axios.post(
      `${FEEDBACK_API_BASE}/user`,
      { subject, message }, // No email needed
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    setError(errorMsg);
    return { success: false, message: errorMsg };
  } finally {
    setLoading(false);
  }
}, []);


  // 2. CLIENT: Get user's feedbacks
  // GET /api/feedback/user/:userId
  const getUserFeedbacks = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${FEEDBACK_API_BASE}/user/${userId}`,
        { headers: getAuthHeaders() }
      );
      setFeedbacks(response.data.feedbacks || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. ADMIN: Get all feedbacks
  // GET /api/feedback/
  const getAllFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${FEEDBACK_API_BASE}/`,
        { headers: getAuthHeaders() }
      );
      setFeedbacks(response.data.feedbacks || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // 4. ADMIN: Reply to feedback
  // POST /api/feedback/:feedbackId/reply
  const replyToFeedback = useCallback(async (feedbackId, replyMessage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${FEEDBACK_API_BASE}/${feedbackId}/reply`,
        { replyMessage },
        { headers: getAuthHeaders() }
      );
      
      // Update the local feedback state
      setFeedbacks(prev => 
        prev.map(feedback => 
          feedback._id === feedbackId 
            ? { ...feedback, reply: replyMessage, status: "processed" }
            : feedback
        )
      );
      
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. ADMIN: Mark feedback as completed
  // PUT /api/feedback/:id/complete
  const markFeedbackCompleted = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(
        `${FEEDBACK_API_BASE}/${id}/complete`,
        {},
        { headers: getAuthHeaders() }
      );
      
      // Update the local feedback state
      setFeedbacks(prev => 
        prev.map(feedback => 
          feedback._id === id 
            ? { ...feedback, status: "completed" }
            : feedback
        )
      );
      
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error manually
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value
  const value = {
    feedbacks,
    loading,
    error,
    createFeedback,
    getUserFeedbacks,
    getAllFeedbacks,
    replyToFeedback,
    markFeedbackCompleted,
    clearError,
    setFeedbacks,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
};

export default FeedbackContext;
