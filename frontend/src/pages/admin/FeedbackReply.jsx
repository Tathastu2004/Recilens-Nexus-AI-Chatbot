import React, { useState, useEffect } from 'react';
import { 
  IconMessageCircle, IconCheck, IconClock, IconMail, 
  IconUser, IconX, IconSend, IconRefresh, IconAlertCircle,
  IconChevronDown, IconChevronUp
} from '@tabler/icons-react';
import { useFeedback } from '../../context/feedbackContext';
import { useUser } from '../../context/UserContext';

const AdminFeedback = () => {
  const { user } = useUser();
  const { 
    feedbacks, 
    loading, 
    error, 
    getAllFeedbacks,
    replyToFeedback,
    markFeedbackCompleted,
    clearError 
  } = useFeedback();

  // States for reply functionality
  const [replyForms, setReplyForms] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedFeedback, setExpandedFeedback] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [successMessage, setSuccessMessage] = useState('');

  // Load all feedbacks on mount
  const fetchFeedbacks = () => {
    getAllFeedbacks();
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle reply form input
  const handleReplyChange = (feedbackId, value) => {
    setReplyForms(prev => ({
      ...prev,
      [feedbackId]: value
    }));
  };

  // Submit reply
  const handleReplySubmit = async (feedbackId) => {
    const replyMessage = replyForms[feedbackId]?.trim();
    if (!replyMessage) return;

    setReplyingTo(feedbackId);
    try {
      const result = await replyToFeedback(feedbackId, replyMessage);
      if (result.success) {
        setSuccessMessage('Reply sent successfully! User has been notified via email.');
        setReplyForms(prev => ({ ...prev, [feedbackId]: '' }));
        setExpandedFeedback(null);
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      setReplyingTo(null);
    }
  };

  // Mark as completed
  const handleMarkCompleted = async (feedbackId) => {
    try {
      const result = await markFeedbackCompleted(feedbackId);
      if (result.success) {
        setSuccessMessage('Feedback marked as completed!');
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Error marking as completed:', error);
    }
  };

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(feedback => 
    statusFilter === 'all' || feedback.status === statusFilter
  );

  // Get status counts
  const statusCounts = feedbacks.reduce((acc, feedback) => {
    acc[feedback.status] = (acc[feedback.status] || 0) + 1;
    return acc;
  }, { pending: 0, processed: 0, completed: 0 });

  const totalFeedbacks = feedbacks.length;
  const avgResponseRate = totalFeedbacks > 0 
    ? ((statusCounts.processed + statusCounts.completed) / totalFeedbacks * 100)
    : 0;

  return (
    <div className="p-6 bg-green-50 min-h-screen">
      {/* Header */}
      <h2 className="text-green-900 font-bold text-xl mb-6 flex justify-between items-center">
        Feedback Management
        <div className="flex gap-4">
          <button
            onClick={fetchFeedbacks}
            className="bg-green-700 text-white px-2 py-2 rounded hover:bg-green-800 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          {/* Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-green-300 text-green-800 px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processed">Replied</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </h2>

      {/* Loading and Error States */}
      {loading && <p className="text-green-700">Loading feedback data...</p>}
      {error && <p className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 mb-6">{error}</p>}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-600 hover:text-green-800">
            <IconX size={20} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {!loading && feedbacks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Total Feedback</h3>
            <p className="text-2xl font-bold text-green-900">{totalFeedbacks}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Replied</h3>
            <p className="text-2xl font-bold text-blue-600">{statusCounts.processed}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Completed</h3>
            <p className="text-2xl font-bold text-green-600">{statusCounts.completed}</p>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && filteredFeedbacks.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <IconMessageCircle size={64} className="mx-auto text-green-300 mb-4" />
          <p className="text-green-800 text-lg">
            {statusFilter === 'all' ? "No feedback available." : `No ${statusFilter} feedback found.`}
          </p>
        </div>
      )}

      {/* Feedback List */}
      {filteredFeedbacks.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-green-100">
            <h3 className="text-green-800 font-semibold text-lg">
              {statusFilter === 'all' ? 'All Feedback' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Feedback`}
              <span className="text-sm text-green-600 ml-2">({filteredFeedbacks.length} items)</span>
            </h3>
          </div>
          
          <div className="divide-y divide-green-100">
            {filteredFeedbacks.map((feedback) => {
              const isExpanded = expandedFeedback === feedback._id;
              
              return (
                <div key={feedback._id} className="p-6 hover:bg-green-25">
                  {/* Header */}
                  <div 
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedFeedback(isExpanded ? null : feedback._id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-green-900 text-lg">{feedback.subject}</h4>
                        
                        {/* Status Badge */}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          feedback.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            : feedback.status === 'processed'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-green-100 text-green-800 border border-green-300'
                        }`}>
                          {feedback.status === 'pending' && <IconClock size={12} className="inline mr-1" />}
                          {feedback.status === 'processed' && <IconMail size={12} className="inline mr-1" />}
                          {feedback.status === 'completed' && <IconCheck size={12} className="inline mr-1" />}
                          {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-green-600 mb-2">
                        <span className="flex items-center gap-1">
                          <IconUser size={14} />
                          User: {feedback.user?.email || feedback.user?._id}
                        </span>
                        <span>
                          {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      {!isExpanded && (
                        <p className="text-green-800 line-clamp-2">
                          {feedback.message}
                        </p>
                      )}
                    </div>
                    
                    <button className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded">
                      {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-green-100 space-y-6">
                      
                      {/* Full Message */}
                      <div>
                        <h5 className="font-medium text-green-800 mb-2">User Message:</h5>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <p className="text-green-900 leading-relaxed whitespace-pre-wrap">
                            {feedback.message}
                          </p>
                        </div>
                      </div>

                      {/* Existing Reply */}
                      {feedback.reply && (
                        <div>
                          <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                            <IconMail size={16} />
                            Your Reply:
                          </h5>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <p className="text-blue-900 leading-relaxed whitespace-pre-wrap">
                              {feedback.reply}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Reply Form */}
                      {feedback.status === 'pending' && (
                        <div>
                          <h5 className="font-medium text-green-800 mb-2">
                            Send Reply (User will be notified via email):
                          </h5>
                          <div className="space-y-3">
                            <textarea
                              value={replyForms[feedback._id] || ''}
                              onChange={(e) => handleReplyChange(feedback._id, e.target.value)}
                              placeholder="Write your reply to the user..."
                              rows={4}
                              className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                              maxLength={1000}
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-green-600">
                                {(replyForms[feedback._id] || '').length}/1000 characters
                              </span>
                              <button
                                onClick={() => handleReplySubmit(feedback._id)}
                                disabled={!replyForms[feedback._id]?.trim() || replyingTo === feedback._id}
                                className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {replyingTo === feedback._id ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <IconSend size={16} />
                                    Send Reply & Notify User
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mark as Completed */}
                      {feedback.status === 'processed' && (
                        <div className="pt-4 border-t border-green-100">
                          <button
                            onClick={() => handleMarkCompleted(feedback._id)}
                            className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 flex items-center gap-2"
                          >
                            <IconCheck size={16} />
                            Mark as Completed
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;
