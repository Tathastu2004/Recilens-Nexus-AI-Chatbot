import React, { useState, useEffect } from 'react';
import { 
  IconSend, IconMessageCircle, IconCheck, IconClock, IconMail, 
  IconUser, IconX, IconPlus, IconRefresh, IconAlertCircle,
  IconFilter, IconChevronDown, IconEdit
} from '@tabler/icons-react';
import { useFeedback } from '../context/FeedbackContext'; // ✅ Fixed path (contexts not context)
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

const FeedBack = () => {
  const { isDark } = useTheme();
  const { user, isAuthenticated } = useUser();
  const { 
    feedbacks, 
    loading, 
    error, 
    createFeedback, 
    getUserFeedbacks,
    getUserFeedbackStats, // ✅ Make sure this exists in your FeedbackContext
    clearError 
  } = useFeedback();

  const userId = user?._id;

  // Stats state
  const [stats, setStats] = useState({
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
  });

  // Form state
  const [showNewFeedbackForm, setShowNewFeedbackForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Filter and view state
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState(null);

  // ✅ Enhanced load function with better error handling
  const loadUserData = async () => {
    if (!userId) return;

    try {
      console.log('🔍 [FEEDBACK] Loading data for user:', userId);
      
      // Load feedbacks
      await getUserFeedbacks(userId);
      
      // Load stats if function exists
      if (getUserFeedbackStats) {
        const statsResult = await getUserFeedbackStats(userId);
        if (statsResult?.success && statsResult?.stats) {
          setStats(statsResult.stats);
          console.log('📊 [FEEDBACK] Stats loaded:', statsResult.stats);
        }
      } else {
        // Fallback: Calculate stats from feedbacks array
        const statusCounts = feedbacks.reduce((acc, feedback) => {
          acc[feedback.status] = (acc[feedback.status] || 0) + 1;
          return acc;
        }, { pending: 0, processed: 0, completed: 0 });
        
        const repliedCount = feedbacks.filter(f => f.reply && f.reply.trim()).length;
        const total = feedbacks.length;
        
        setStats({
          total,
          ...statusCounts,
          replied: repliedCount,
          unreplied: total - repliedCount,
          percentages: {
            pending: total > 0 ? Math.round((statusCounts.pending / total) * 100) : 0,
            processed: total > 0 ? Math.round((statusCounts.processed / total) * 100) : 0,
            completed: total > 0 ? Math.round((statusCounts.completed / total) * 100) : 0,
            replied: total > 0 ? Math.round((repliedCount / total) * 100) : 0
          }
        });
      }
    } catch (error) {
      console.error('❌ [FEEDBACK] Error loading data:', error);
    }
  };

  // Load user feedbacks and stats when user is available
  useEffect(() => {
    loadUserData();
  }, [userId, feedbacks.length]); // ✅ Added feedbacks.length as dependency

  // Clear success message after 3 seconds
  useEffect(() => {
    if (submitSuccess) {
      const timer = setTimeout(() => setSubmitSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ✅ Enhanced form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) return;
    if (!userId) return;

    setIsSubmitting(true);
    try {
      console.log('📤 [FEEDBACK] Submitting feedback:', {
        subject: formData.subject,
        messageLength: formData.message.length
      });

      const result = await createFeedback({
        subject: formData.subject.trim(),
        message: formData.message.trim()
      });

      if (result.success) {
        setFormData({ subject: '', message: '' });
        setShowNewFeedbackForm(false);
        setSubmitSuccess(true);
        
        // Reload data
        await loadUserData();
        
        console.log('✅ [FEEDBACK] Feedback submitted successfully');
      }
    } catch (error) {
      console.error('❌ [FEEDBACK] Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Enhanced status info with better styling
  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': {
        color: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-700',
        icon: <IconClock size={14} />,
        text: 'Pending Review',
        dot: 'bg-yellow-500'
      },
      'processed': {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-700',
        icon: <IconMail size={14} />,
        text: 'Replied',
        dot: 'bg-blue-500'
      },
      'completed': {
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-700',
        icon: <IconCheck size={14} />,
        text: 'Completed',
        dot: 'bg-green-500'
      }
    };

    return statusMap[status] || {
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      border: 'border-gray-200 dark:border-gray-700',
      icon: <IconClock size={14} />,
      text: status || 'Unknown',
      dot: 'bg-gray-500'
    };
  };

  // ✅ Enhanced time formatting
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
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

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(feedback => 
    statusFilter === 'all' || feedback.status === statusFilter
  );

  if (!isAuthenticated || !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-all duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
      }`}>
        <div className="text-center space-y-4 p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
            <IconUser size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            Authentication Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            Please log in to access the feedback system and view your submitted feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    }`}>
      {/* Header with User Info */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <IconMessageCircle size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                  Feedback & Support
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Welcome <span className="font-medium text-blue-600 dark:text-blue-400">{user.name}</span> - Share your thoughts and get help from our team
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
                title="Toggle filters"
              >
                <IconFilter size={18} />
              </button>
              
              <button
                onClick={loadUserData}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Refresh feedbacks"
              >
                <IconRefresh size={18} className={`${loading ? 'animate-spin' : ''} text-gray-500 dark:text-gray-400`} />
              </button>
              
              <button
                onClick={() => setShowNewFeedbackForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 transform hover:scale-105"
              >
                <IconPlus size={16} />
                New Feedback
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex flex-wrap gap-2">
                {['all', 'pending', 'processed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                        : 'bg-white/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50'
                    }`}
                  >
                    {status === 'all' ? 'All Feedback' : status.charAt(0).toUpperCase() + status.slice(1)}
                    {status !== 'all' && stats[status] > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                        {stats[status]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        
        {/* Success Message */}
        {submitSuccess && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <IconCheck size={16} className="text-white" />
            </div>
            <div>
              <p className="text-green-800 dark:text-green-200 font-medium">
                Feedback submitted successfully!
              </p>
              <p className="text-green-600 dark:text-green-400 text-sm">
                We'll review your feedback and get back to you at {user.email} soon.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-start gap-3 animate-fade-in">
            <IconAlertCircle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-800 dark:text-red-200 font-medium">
                Something went wrong
              </p>
              <p className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </p>
            </div>
            <button
              onClick={clearError}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
            >
              <IconX size={16} className="text-red-500" />
            </button>
          </div>
        )}

        {/* ✅ Enhanced Stats Cards with Real Data (Total, Pending, Replied, Completed) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {stats.total}
                </p>
                <p className="text-xs text-gray-500">All feedback</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <IconMessageCircle size={20} className="text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.pending}
                </p>
                <p className="text-xs text-gray-500">{stats.percentages?.pending || 0}% of total</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                <IconClock size={20} className="text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Replied</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.processed}
                </p>
                <p className="text-xs text-gray-500">{stats.percentages?.processed || 0}% of total</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <IconMail size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.completed}
                </p>
                <p className="text-xs text-gray-500">{stats.percentages?.completed || 0}% of total</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <IconCheck size={20} className="text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* New Feedback Form Modal */}
        {showNewFeedbackForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transform animate-scale-in">
              
              {/* Form Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <IconEdit size={14} className="text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Submit New Feedback
                  </h2>
                </div>
                <button
                  onClick={() => setShowNewFeedbackForm(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <IconX size={18} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
                
                {/* Subject Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <IconEdit size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Brief description of your feedback"
                      className="w-full pl-10 pr-16 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                      required
                      maxLength={100}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                      {formData.subject.length}/100
                    </div>
                  </div>
                </div>

                {/* Message Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Please provide detailed feedback or describe any issues you're experiencing..."
                      rows={6}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 resize-none transition-all"
                      required
                      maxLength={1000}
                    />
                    <div className="absolute right-3 bottom-3 text-xs text-gray-400">
                      {formData.message.length}/1000
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowNewFeedbackForm(false)}
                    className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.subject.trim() || !formData.message.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2 transform hover:scale-105 disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <IconSend size={16} />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✅ Enhanced Feedbacks List with Better Formatting */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading your feedbacks...</p>
            </div>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <IconMessageCircle size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {statusFilter === 'all' 
                ? "No feedback submitted yet" 
                : `No ${statusFilter} feedback found`
              }
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
              {statusFilter === 'all'
                ? "Share your thoughts and help us improve your experience."
                : `You don't have any ${statusFilter} feedback at the moment.`
              }
            </p>
            {statusFilter === 'all' && (
              <button
                onClick={() => setShowNewFeedbackForm(true)}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center gap-3 mx-auto transform hover:scale-105"
              >
                <IconPlus size={20} />
                Submit Your First Feedback
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeedbacks.map((feedback) => {
              const statusInfo = getStatusInfo(feedback.status);
              const isExpanded = expandedFeedback === feedback._id;
              
              return (
                <div
                  key={feedback._id}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  {/* Header */}
                  <div 
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedFeedback(isExpanded ? null : feedback._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">
                            {feedback.subject}
                          </h3>
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.text}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                          <span>
                            {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span>•</span>
                          <span>{formatTimeAgo(feedback.createdAt)}</span>
                          {feedback.reply && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium">Replied</span>
                            </>
                          )}
                        </div>
                        {!isExpanded && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {feedback.message}
                          </p>
                        )}
                      </div>
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-4">
                        <IconChevronDown 
                          size={18} 
                          className={`text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`} 
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-200/50 dark:border-gray-700/50">
                      {/* Message */}
                      <div className="mt-4 mb-6">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Your Message
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {feedback.message}
                          </p>
                        </div>
                      </div>

                      {/* Reply */}
                      {feedback.reply && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                            <IconUser size={16} />
                            Support Team Reply
                          </h4>
                          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {feedback.reply}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedBack;
