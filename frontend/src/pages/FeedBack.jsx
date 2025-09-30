import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  IconSend, IconMessageCircle, IconCheck, IconClock, IconMail, 
  IconUser, IconX, IconPlus, IconRefresh, IconAlertCircle,
  IconArrowLeft, IconSun, IconMoon, IconEdit
} from '@tabler/icons-react';
import { useFeedback } from '../context/feedbackContext';
import { useTheme } from '../context/ThemeContext';
import { useClerkUser } from '../context/ClerkUserContext';

const FeedBack = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { dbUser: user, isAuthenticated, loading: userLoading } = useClerkUser();
  
  const { 
    feedbacks, 
    loading, 
    error, 
    createFeedback, 
    getUserFeedbacks,
    getUserFeedbackStats,
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
  const [expandedFeedback, setExpandedFeedback] = useState(null);

  // Load user data function
  const loadUserData = async () => {
    if (!userId) {
      console.log('⚠️ [FEEDBACK] No userId available');
      return;
    }

    try {
      console.log('🔍 [FEEDBACK] Loading data for user:', userId);
      
      const feedbackResult = await getUserFeedbacks(userId);
      
      if (feedbackResult?.success) {
        console.log('✅ [FEEDBACK] Feedbacks loaded successfully');
      }
      
      if (getUserFeedbackStats) {
        try {
          const statsResult = await getUserFeedbackStats(userId);
          if (statsResult?.success && statsResult?.stats) {
            setStats(statsResult.stats);
            console.log('📊 [FEEDBACK] Stats loaded:', statsResult.stats);
          } else {
            calculateStatsFromFeedbacks();
          }
        } catch (statsError) {
          console.warn('⚠️ [FEEDBACK] Stats loading failed, calculating from feedbacks:', statsError);
          calculateStatsFromFeedbacks();
        }
      } else {
        calculateStatsFromFeedbacks();
      }
    } catch (error) {
      console.error('❌ [FEEDBACK] Error loading data:', error);
    }
  };

  // Calculate stats from feedbacks
  const calculateStatsFromFeedbacks = () => {
    if (feedbacks.length === 0) return;

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
  };

  useEffect(() => {
    if (isAuthenticated && userId && !userLoading) {
      console.log('🔄 [FEEDBACK] User authenticated, loading data...');
      loadUserData();
    }
  }, [isAuthenticated, userId, userLoading]);

  useEffect(() => {
    if (feedbacks.length > 0) {
      calculateStatsFromFeedbacks();
    }
  }, [feedbacks]);

  useEffect(() => {
    if (submitSuccess) {
      const timer = setTimeout(() => setSubmitSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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
        
        await loadUserData();
        
        console.log('✅ [FEEDBACK] Feedback submitted successfully');
      } else {
        console.error('❌ [FEEDBACK] Submit failed:', result.message);
      }
    } catch (error) {
      console.error('❌ [FEEDBACK] Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': {
        color: isDark ? '#fbbf24' : '#d97706',
        bg: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(217, 119, 6, 0.1)',
        icon: <IconClock size={14} />,
        text: 'Pending',
        dot: '#fbbf24'
      },
      'processed': {
        color: isDark ? '#3b82f6' : '#2563eb',
        bg: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)',
        icon: <IconMail size={14} />,
        text: 'Replied',
        dot: '#3b82f6'
      },
      'completed': {
        color: isDark ? '#10b981' : '#059669',
        bg: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
        icon: <IconCheck size={14} />,
        text: 'Completed',
        dot: '#10b981'
      }
    };

    return statusMap[status] || {
      color: isDark ? '#6b7280' : '#4b5563',
      bg: isDark ? 'rgba(107, 114, 128, 0.1)' : 'rgba(75, 85, 99, 0.1)',
      icon: <IconClock size={14} />,
      text: status || 'Unknown',
      dot: '#6b7280'
    };
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInDays > 0) {
      return `${diffInDays}d ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours}h ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const filteredFeedbacks = feedbacks.filter(feedback => 
    statusFilter === 'all' || feedback.status === statusFilter
  );

  // ✅ LOADING STATE
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto"
               style={{ 
                 border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                 borderTopColor: isDark ? '#ffffff' : '#000000'
               }}></div>
          <div className="text-sm"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // ✅ AUTH ERROR STATE
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
        <div className="text-center space-y-6 p-8 rounded-xl max-w-md w-full"
             style={{ 
               backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
               border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
             }}>
          <div className="text-4xl">🔒</div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              Authentication Required
            </h3>
            <p className="text-sm"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
              Please log in to access the feedback system.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/signin')}
              className="px-6 py-2 font-medium rounded-lg transition-colors"
              style={{ 
                backgroundColor: isDark ? '#ffffff' : '#000000',
                color: isDark ? '#000000' : '#ffffff'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="px-6 py-2 font-medium rounded-lg transition-colors"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#cccccc' : '#666666'
              }}
            >
              Back to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen"
         style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
      
      {/* ✅ HEADER */}
      <div className="border-b"
           style={{ 
             backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
             borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
           }}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                <IconArrowLeft size={16} />
                Back
              </button>

              <div>
                <h1 className="text-lg font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Feedback
                </h1>
                <p className="text-sm"
                   style={{ color: isDark ? '#cccccc' : '#666666' }}>
                  Share your thoughts and get help
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadUserData}
                disabled={loading}
                className="p-2 rounded-lg transition-colors hover:opacity-70"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
                title="Refresh"
              >
                <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-colors hover:opacity-70"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
              </button>

              <button
                onClick={() => setShowNewFeedbackForm(true)}
                className="px-4 py-2 font-medium rounded-lg transition-colors flex items-center gap-2"
                style={{ 
                  backgroundColor: isDark ? '#ffffff' : '#000000',
                  color: isDark ? '#000000' : '#ffffff'
                }}
              >
                <IconPlus size={16} />
                New Feedback
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {['all', 'pending', 'processed', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? isDark ? 'bg-white text-black' : 'bg-black text-white'
                    : isDark ? 'text-cccccc hover:bg-white/10' : 'text-666666 hover:bg-black/5'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && stats[status] > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    {stats[status]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        
        {/* Success Message */}
        {submitSuccess && (
          <div className="mb-6 p-4 rounded-lg border flex items-center gap-3"
               style={{ 
                 backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                 borderColor: '#10b981',
                 color: isDark ? '#ffffff' : '#000000'
               }}>
            <IconCheck size={20} style={{ color: '#10b981' }} />
            <div>
              <p className="font-medium">Feedback submitted successfully!</p>
              <p className="text-sm" style={{ color: isDark ? '#cccccc' : '#666666' }}>
                We'll review your feedback and get back to you soon.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border flex items-start gap-3"
               style={{ 
                 backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                 borderColor: '#ef4444',
                 color: isDark ? '#ffffff' : '#000000'
               }}>
            <IconAlertCircle size={20} style={{ color: '#ef4444' }} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Error</p>
              <p className="text-sm" style={{ color: isDark ? '#cccccc' : '#666666' }}>
                {error}
              </p>
            </div>
            <button
              onClick={clearError}
              className="p-1 rounded transition-colors hover:opacity-70"
            >
              <IconX size={16} style={{ color: '#ef4444' }} />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: IconMessageCircle, color: isDark ? '#ffffff' : '#000000' },
            { label: 'Pending', value: stats.pending, icon: IconClock, color: '#fbbf24' },
            { label: 'Replied', value: stats.processed, icon: IconMail, color: '#3b82f6' },
            { label: 'Completed', value: stats.completed, icon: IconCheck, color: '#10b981' }
          ].map((stat, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: isDark ? '#cccccc' : '#666666' }}>
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon size={24} style={{ color: stat.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* New Feedback Form Modal */}
        {showNewFeedbackForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl rounded-2xl shadow-xl"
                 style={{ 
                   backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                   border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                 }}>
              
              {/* Form Header */}
              <div className="flex items-center justify-between p-6 border-b"
                   style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                <h2 className="text-lg font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Submit Feedback
                </h2>
                <button
                  onClick={() => setShowNewFeedbackForm(false)}
                  className="p-2 rounded-lg transition-colors hover:opacity-70"
                  style={{ color: isDark ? '#cccccc' : '#666666' }}
                >
                  <IconX size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                
                {/* Subject Field */}
                <div>
                  <label className="block text-sm font-medium mb-2"
                         style={{ color: isDark ? '#cccccc' : '#666666' }}>
                    Subject *
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    placeholder="Brief description of your feedback"
                    className="w-full p-3 rounded-lg border transition-colors"
                    style={{ 
                      backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#000000'
                    }}
                    required
                    maxLength={100}
                  />
                  <div className="text-xs mt-1" style={{ color: isDark ? '#888888' : '#888888' }}>
                    {formData.subject.length}/100
                  </div>
                </div>

                {/* Message Field */}
                <div>
                  <label className="block text-sm font-medium mb-2"
                         style={{ color: isDark ? '#cccccc' : '#666666' }}>
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Please provide detailed feedback..."
                    rows={6}
                    className="w-full p-3 rounded-lg border transition-colors resize-none"
                    style={{ 
                      backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#000000'
                    }}
                    required
                    maxLength={1000}
                  />
                  <div className="text-xs mt-1" style={{ color: isDark ? '#888888' : '#888888' }}>
                    {formData.message.length}/1000
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewFeedbackForm(false)}
                    className="px-6 py-2 rounded-lg transition-colors"
                    style={{ 
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      color: isDark ? '#cccccc' : '#666666'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.subject.trim() || !formData.message.trim()}
                    className="px-6 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    style={{ 
                      backgroundColor: isDark ? '#ffffff' : '#000000',
                      color: isDark ? '#000000' : '#ffffff'
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <IconSend size={16} />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feedbacks List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 rounded-full animate-spin mx-auto"
                   style={{ 
                     border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                     borderTopColor: isDark ? '#ffffff' : '#000000'
                   }}></div>
              <p className="text-sm" style={{ color: isDark ? '#cccccc' : '#666666' }}>
                Loading your feedbacks...
              </p>
            </div>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-6">💬</div>
            <h3 className="text-xl font-semibold mb-3"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              {statusFilter === 'all' 
                ? "No feedback yet" 
                : `No ${statusFilter} feedback`
              }
            </h3>
            <p className="mb-8 max-w-md mx-auto"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
              {statusFilter === 'all'
                ? "Share your thoughts and help us improve."
                : `You don't have any ${statusFilter} feedback.`
              }
            </p>
            {statusFilter === 'all' && (
              <button
                onClick={() => setShowNewFeedbackForm(true)}
                className="px-6 py-3 font-medium rounded-lg transition-colors flex items-center gap-2 mx-auto"
                style={{ 
                  backgroundColor: isDark ? '#ffffff' : '#000000',
                  color: isDark ? '#000000' : '#ffffff'
                }}
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
                  className="rounded-lg border transition-colors"
                  style={{ 
                    backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {/* Header */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedFeedback(isExpanded ? null : feedback._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold"
                              style={{ color: isDark ? '#ffffff' : '#000000' }}>
                            {feedback.subject}
                          </h3>
                          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium"
                               style={{
                                 backgroundColor: statusInfo.bg,
                                 color: statusInfo.color
                               }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
                            {statusInfo.text}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm mb-2"
                             style={{ color: isDark ? '#888888' : '#666666' }}>
                          <span>
                            {new Date(feedback.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>{formatTimeAgo(feedback.createdAt)}</span>
                          {feedback.reply && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#3b82f6' }}>Replied</span>
                            </>
                          )}
                        </div>
                        {!isExpanded && (
                          <p className="text-sm line-clamp-2"
                             style={{ color: isDark ? '#cccccc' : '#666666' }}>
                            {feedback.message}
                          </p>
                        )}
                      </div>
                      <button className="p-2 rounded-lg transition-colors hover:opacity-70 ml-4">
                        <svg 
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                          style={{ color: isDark ? '#888888' : '#666666' }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t"
                         style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                      
                      {/* Message */}
                      <div className="mt-4 mb-6">
                        <h4 className="text-sm font-medium mb-3"
                            style={{ color: isDark ? '#cccccc' : '#666666' }}>
                          Your Message
                        </h4>
                        <div className="p-4 rounded-lg"
                             style={{ backgroundColor: isDark ? '#1F1F1F' : '#f8f9fa' }}>
                          <p className="whitespace-pre-wrap"
                             style={{ color: isDark ? '#ffffff' : '#000000' }}>
                            {feedback.message}
                          </p>
                        </div>
                      </div>

                      {/* Reply */}
                      {feedback.reply && (
                        <div>
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2"
                              style={{ color: isDark ? '#cccccc' : '#666666' }}>
                            <IconUser size={16} />
                            Support Team Reply
                          </h4>
                          <div className="p-4 rounded-lg border"
                               style={{ 
                                 backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                                 borderColor: '#10b981'
                               }}>
                            <p className="whitespace-pre-wrap"
                               style={{ color: isDark ? '#ffffff' : '#000000' }}>
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
