import React, { createContext, useContext, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from '@clerk/clerk-react';

// Base URL for feedback API
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const FEEDBACK_API_BASE = `${BACKEND_URL}/api/feedback`;

const FeedbackContext = createContext();

export const FeedbackProvider = ({ children }) => {
  const { getToken } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Helper to get Clerk auth headers
  const getAuthHeaders = useCallback(async () => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch (error) {
      console.error('❌ [FEEDBACK CONTEXT] Auth token error:', error);
      return {};
    }
  }, [getToken]);

  // ✅ Create axios instance with Clerk token
  const createApiClient = useCallback(async () => {
    const headers = await getAuthHeaders();
    return axios.create({
      baseURL: FEEDBACK_API_BASE,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  }, [getAuthHeaders]);

  // 1. CLIENT: Create new feedback
  const createFeedback = useCallback(async ({ subject, message }) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📤 [FEEDBACK CONTEXT] Creating feedback:', { subject, messageLength: message.length });
      
      const apiClient = await createApiClient();
      const response = await apiClient.post('/user', { 
        subject, 
        message 
      });
      
      console.log('✅ [FEEDBACK CONTEXT] Feedback created:', response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ [FEEDBACK CONTEXT] Create feedback error:', errorMsg);
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [createApiClient]);

  // 2. CLIENT: Get user's feedbacks
  const getUserFeedbacks = useCallback(async (userId) => {
    console.log('🔍 [FEEDBACK CONTEXT] Fetching feedbacks for user:', userId);
    setLoading(true);
    setError(null);
    
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/user/${userId}`);
      
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
  }, [createApiClient]);

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

  // ✅ Fixed getUserFeedbackStats function
  const getUserFeedbackStats = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📊 [FEEDBACK CONTEXT] Fetching stats for user:', userId);
      
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/stats/user/${userId}`);
      
      console.log('📈 [FEEDBACK CONTEXT] Stats response:', response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ [FEEDBACK CONTEXT] Stats error:', errorMsg);
      
      // Don't set error for stats - it's optional
      // Instead, return fallback stats
      return { 
        success: false, 
        message: errorMsg,
        stats: {
          total: 0,
          pending: 0,
          processed: 0,
          completed: 0,
          replied: 0,
          unreplied: 0,
          percentages: {
            pending: 0,
            processed: 0,
            completed: 0,
            replied: 0
          }
        }
      };
    } finally {
      setLoading(false);
    }
  }, [createApiClient]);

  // 3. ADMIN: Get all feedbacks
  const getAllFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📋 [FEEDBACK CONTEXT] Fetching all feedbacks...');
      
      const apiClient = await createApiClient();
      const response = await apiClient.get('/');
      
      console.log('📥 [FEEDBACK CONTEXT] All feedbacks response:', response.data);
      
      setFeedbacks(response.data.feedbacks || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ [FEEDBACK CONTEXT] Get all feedbacks error:', errorMsg);
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [createApiClient]);

  // 4. ADMIN: Reply to feedback
  const replyToFeedback = useCallback(async (feedbackId, replyMessage) => {
    setLoading(true);
    setError(null);
    try {
      console.log('💬 [FEEDBACK CONTEXT] Replying to feedback:', feedbackId);
      
      const apiClient = await createApiClient();
      const response = await apiClient.post(`/${feedbackId}/reply`, { 
        replyMessage 
      });
      
      // Update the local feedback state
      setFeedbacks(prev => 
        prev.map(feedback => 
          feedback._id === feedbackId 
            ? { ...feedback, reply: replyMessage, status: "processed" }
            : feedback
        )
      );
      
      console.log('✅ [FEEDBACK CONTEXT] Reply sent:', response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ [FEEDBACK CONTEXT] Reply error:', errorMsg);
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [createApiClient]);

  // 5. ADMIN: Mark feedback as completed
  const markFeedbackCompleted = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      console.log('✅ [FEEDBACK CONTEXT] Marking feedback completed:', id);
      
      const apiClient = await createApiClient();
      const response = await apiClient.put(`/${id}/complete`);
      
      // Update the local feedback state
      setFeedbacks(prev => 
        prev.map(feedback => 
          feedback._id === id 
            ? { ...feedback, status: "completed" }
            : feedback
        )
      );
      
      console.log('✅ [FEEDBACK CONTEXT] Feedback marked completed:', response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('❌ [FEEDBACK CONTEXT] Complete error:', errorMsg);
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [createApiClient]);

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
