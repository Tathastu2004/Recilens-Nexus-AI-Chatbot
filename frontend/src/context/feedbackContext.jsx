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
  console.log('🔍 [FEEDBACK CONTEXT] Fetching feedbacks for user:', userId);
  setLoading(true);
  setError(null);
  
  try {
    const response = await axios.get(
      `${FEEDBACK_API_BASE}/user/${userId}`,
      { headers: getAuthHeaders() }
    );
    
    console.log('📥 [FEEDBACK CONTEXT] Raw response:', response.data);
    
    const rawFeedbacks = response.data.feedbacks || [];
    
    // Format and enhance feedbacks for UI display
    const formattedFeedbacks = rawFeedbacks.map(feedback => ({
      // Core data
      _id: feedback._id,
      subject: feedback.subject,
      message: feedback.message,
      fullMessage: feedback.message, // Keep full message for expanded view
      reply: feedback.reply,
      status: feedback.status,
      
      // Formatted data for UI
      messagePreview: feedback.message.length > 150 
        ? feedback.message.substring(0, 150) + '...' 
        : feedback.message,
      
      // Enhanced date formatting
      createdAt: feedback.createdAt,
      formattedDate: new Date(feedback.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timeAgo: getTimeAgo(new Date(feedback.createdAt)),
      
      // Status helpers for UI
      statusInfo: {
        pending: {
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-700',
          text: 'Pending Review',
          dot: 'bg-yellow-500'
        },
        processed: {
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-700',
          text: 'Replied',
          dot: 'bg-blue-500'
        },
        completed: {
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-700',
          text: 'Completed',
          dot: 'bg-green-500'
        }
      }[feedback.status],
      
      // Additional UI helpers
      hasReply: !!(feedback.reply && feedback.reply.trim()),
      isNew: (new Date() - new Date(feedback.createdAt)) < (24 * 60 * 60 * 1000), // Less than 24 hours
      urgentKeywords: ['urgent', 'critical', 'important', 'asap'].some(word => 
        feedback.subject.toLowerCase().includes(word) || 
        feedback.message.toLowerCase().includes(word)
      )
    }));
    
    // Sort by creation date descending (newest first)
    formattedFeedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log('✅ [FEEDBACK CONTEXT] Formatted feedbacks:', formattedFeedbacks.length);
    
    setFeedbacks(formattedFeedbacks);
    return { success: true, feedbacks: formattedFeedbacks };
    
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    console.error('❌ [FEEDBACK CONTEXT] Error:', errorMsg);
    setError(errorMsg);
    return { success: false, message: errorMsg };
  } finally {
    setLoading(false);
  }
}, []);

// Helper function for time ago formatting
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInMs = now - date;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  
  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};



  const getUserFeedbackStats = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${FEEDBACK_API_BASE}/stats/user/${userId}`,
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
    getUserFeedbackStats
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
