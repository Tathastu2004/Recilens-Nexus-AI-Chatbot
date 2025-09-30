import React, { useState, useEffect } from 'react';
import { 
  IconMessageCircle, IconCheck, IconClock, IconMail, 
  IconUser, IconX, IconSend, IconRefresh, IconAlertCircle,
  IconChevronDown, IconChevronUp, IconSearch, IconFilter,
  IconArrowLeft, IconMenu2
} from '@tabler/icons-react';
import { useFeedback } from '../../context/feedbackContext';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
// import Sidebar from '../../components/admin/Sidebar';

const AdminFeedback = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
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
  const [searchTerm, setSearchTerm] = useState('');
  // ✅ Add mobile sidebar state
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Filter feedbacks based on search and status
  const filteredFeedbacks = feedbacks.filter(feedback => {
    const matchesStatus = statusFilter === 'all' || feedback.status === statusFilter;
    const matchesSearch = !searchTerm || 
      feedback.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.userInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Get status counts
  const statusCounts = feedbacks.reduce((acc, feedback) => {
    acc[feedback.status] = (acc[feedback.status] || 0) + 1;
    return acc;
  }, { pending: 0, processed: 0, completed: 0 });

  const totalFeedbacks = feedbacks.length;

  // Stats cards data
  const statsCards = [
    {
      title: 'Total Feedback',
      value: totalFeedbacks,
      icon: IconMessageCircle,
      color: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
      textColor: '#3b82f6'
    },
    {
      title: 'Pending',
      value: statusCounts.pending,
      icon: IconClock,
      color: isDark ? 'rgba(251, 146, 60, 0.1)' : 'rgba(251, 146, 60, 0.1)',
      textColor: '#f59e0b'
    },
    {
      title: 'Replied',
      value: statusCounts.processed,
      icon: IconMail,
      color: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
      textColor: '#8b5cf6'
    },
    {
      title: 'Completed',
      value: statusCounts.completed,
      icon: IconCheck,
      color: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
      textColor: '#10b981'
    }
  ];

  // Wrap the return content:
  return (
    <div className="lg:flex min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* ✅ Mobile Sidebar
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} /> */}
      
      {/* ✅ Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* ✅ SEAMLESS HEADER - Same as Users */}
        <div className="backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 250, 250, 0.8)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Left Section */}
              <div className="flex items-center gap-4">
                {/* ✅ Mobile Menu Button */}
                {/* <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg transition-colors"
                  style={{ 
                    color: isDark ? '#ffffff' : '#000000',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <IconMenu2 size={20} />
                </button> */}

                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  <IconArrowLeft size={16} />
                  <span className="hidden sm:inline">Back</span>
                </button>

                <div>
                  <h1 className="text-xl sm:text-2xl font-bold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Feedback Management
                  </h1>
                  <p className="text-xs sm:text-sm"
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Manage {feedbacks.length} feedback submissions
                  </p>
                </div>
              </div>

              {/* Right Section - Same as before */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              
              {/* Search */}
              <div className="relative flex-1 sm:min-w-80">
                <IconSearch 
                  size={18} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search feedback..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-0 transition-all focus:ring-2"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    color: isDark ? '#ffffff' : '#000000',
                    backdropFilter: 'blur(10px)'
                  }}
                />
              </div>

              {/* Filter & Actions */}
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border-0 text-sm font-medium transition-all focus:ring-2"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    color: isDark ? '#ffffff' : '#000000',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processed">Replied</option>
                  <option value="completed">Completed</option>
                </select>

                <button
                  onClick={fetchFeedbacks}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 text-sm"
                  style={{ 
                    backgroundColor: isDark ? '#ffffff' : '#000000',
                    color: isDark ? '#000000' : '#ffffff'
                  }}
                >
                  <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

          {/* ✅ SUCCESS MESSAGE */}
          {successMessage && (
            <div className="p-4 rounded-2xl flex justify-between items-center border-0"
                 style={{ 
                   backgroundColor: 'rgba(16, 185, 129, 0.1)',
                   color: isDark ? '#ffffff' : '#000000'
                 }}>
              <span className="text-green-400">{successMessage}</span>
              <button 
                onClick={() => setSuccessMessage('')} 
                className="text-green-400 hover:text-green-500 p-1 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <IconX size={20} />
              </button>
            </div>
          )}

          {/* ✅ ERROR MESSAGE */}
          {error && (
            <div className="p-4 rounded-2xl flex items-center gap-3 border-0"
                 style={{ 
                   backgroundColor: 'rgba(239, 68, 68, 0.1)',
                   color: isDark ? '#ffffff' : '#000000'
                 }}>
              <IconAlertCircle size={20} className="text-red-500" />
              <div>
                <p className="font-medium">Error loading feedback</p>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* ✅ STATS CARDS - Professional styling */}
          {!loading && feedbacks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsCards.map((stat, index) => (
                <div key={index} 
                     className="p-6 rounded-2xl transition-all hover:scale-[1.02] duration-200"
                     style={{ 
                       backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                       backdropFilter: 'blur(10px)',
                       border: 'none'
                     }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl"
                         style={{
                           backgroundColor: stat.color,
                           color: stat.textColor
                         }}>
                      <stat.icon size={20} />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-medium mb-2 uppercase tracking-wider"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      {stat.title}
                    </h3>
                    <p className="text-2xl sm:text-3xl font-bold"
                       style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ✅ LOADING STATE */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4"
                     style={{ 
                       border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                       borderTopColor: isDark ? '#ffffff' : '#000000'
                     }}></div>
                <h3 className="text-lg font-semibold mb-2"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Loading Feedback
                </h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  Fetching feedback data...
                </p>
              </div>
            </div>
          )}

          {/* ✅ NO DATA STATE */}
          {!loading && filteredFeedbacks.length === 0 && (
            <div className="text-center py-16 rounded-2xl"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
              <IconMessageCircle size={64} 
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} 
                                className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                {statusFilter === 'all' ? "No feedback available" : `No ${statusFilter} feedback found`}
              </h3>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                {searchTerm ? 'Try adjusting your search terms.' : 'Feedback will appear here when users submit them.'}
              </p>
            </div>
          )}

          {/* ✅ FEEDBACK LIST - Professional styling */}
          {filteredFeedbacks.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-opacity-10"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                   borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                 }}>
              <h3 className="text-lg font-semibold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                {statusFilter === 'all' ? 'All Feedback' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Feedback`}
                <span className="text-sm font-normal ml-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  ({filteredFeedbacks.length} items)
                </span>
              </h3>
            </div>
            
            {/* Feedback Items */}
            <div className="divide-y divide-opacity-10"
                 style={{ 
                   borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                 }}>
              {filteredFeedbacks.map((feedback) => {
                const isExpanded = expandedFeedback === feedback._id;
                
                return (
                  <div key={feedback._id} 
                       className="p-6 transition-all duration-200"
                       onMouseEnter={(e) => {
                         e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.backgroundColor = 'transparent';
                       }}>
                    
                    {/* Header */}
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedFeedback(isExpanded ? null : feedback._id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-lg"
                              style={{ color: isDark ? '#ffffff' : '#000000' }}>
                            {feedback.subject}
                          </h4>
                          
                          {/* Status Badge */}
                          <span className={`px-3 py-1 text-xs font-medium rounded-lg border ${
                            feedback.status === 'pending' 
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              : feedback.status === 'processed'
                              ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                              : 'bg-green-500/10 text-green-500 border-green-500/20'
                          }`}>
                            {feedback.status === 'pending' && <IconClock size={12} className="inline mr-1" />}
                            {feedback.status === 'processed' && <IconMail size={12} className="inline mr-1" />}
                            {feedback.status === 'completed' && <IconCheck size={12} className="inline mr-1" />}
                            {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm mb-2"
                             style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          <span className="flex items-center gap-1">
                            <IconUser size={14} />
                            {feedback.userInfo?.email || feedback.user?.email || feedback.email || 'Unknown'}
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
                          <p className="line-clamp-2"
                             style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                            {feedback.message}
                          </p>
                        )}
                      </div>
                      
                      <button className="p-2 rounded-xl transition-all hover:scale-105"
                              style={{
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
                              }}>
                        {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-opacity-10 space-y-6"
                           style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                        
                        {/* Full Message */}
                        <div>
                          <h5 className="font-medium mb-2"
                              style={{ color: isDark ? '#ffffff' : '#000000' }}>
                            User Message:
                          </h5>
                          <div className="p-4 rounded-xl"
                               style={{ 
                                 backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                                 border: '1px solid rgba(59, 130, 246, 0.2)'
                               }}>
                            <p className="leading-relaxed whitespace-pre-wrap"
                               style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                              {feedback.message}
                            </p>
                          </div>
                        </div>

                        {/* Existing Reply */}
                        {feedback.reply && (
                          <div>
                            <h5 className="font-medium mb-2 flex items-center gap-2"
                                style={{ color: isDark ? '#ffffff' : '#000000' }}>
                              <IconMail size={16} />
                              Your Reply:
                            </h5>
                            <div className="p-4 rounded-xl"
                                 style={{ 
                                   backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
                                   border: '1px solid rgba(139, 92, 246, 0.2)'
                                 }}>
                              <p className="leading-relaxed whitespace-pre-wrap"
                                 style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                                {feedback.reply}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Reply Form */}
                        {feedback.status === 'pending' && (
                          <div>
                            <h5 className="font-medium mb-2"
                                style={{ color: isDark ? '#ffffff' : '#000000' }}>
                              Send Reply (User will be notified via email):
                            </h5>
                            <div className="space-y-3">
                              <textarea
                                value={replyForms[feedback._id] || ''}
                                onChange={(e) => handleReplyChange(feedback._id, e.target.value)}
                                placeholder="Write your reply to the user..."
                                rows={4}
                                className="w-full px-4 py-3 border-0 rounded-xl resize-none transition-all focus:ring-2"
                                style={{ 
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                  color: isDark ? '#ffffff' : '#000000',
                                  backdropFilter: 'blur(10px)'
                                }}
                                maxLength={1000}
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-sm"
                                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                  {(replyForms[feedback._id] || '').length}/1000 characters
                                </span>
                                <button
                                  onClick={() => handleReplySubmit(feedback._id)}
                                  disabled={!replyForms[feedback._id]?.trim() || replyingTo === feedback._id}
                                  className="px-6 py-2 rounded-xl font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  style={{ 
                                    backgroundColor: isDark ? '#ffffff' : '#000000',
                                    color: isDark ? '#000000' : '#ffffff'
                                  }}
                                >
                                  {replyingTo === feedback._id ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
                          <div className="pt-4 border-t border-opacity-10"
                               style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                            <button
                              onClick={() => handleMarkCompleted(feedback._id)}
                              className="px-6 py-2 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2"
                              style={{ 
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                              }}
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
    </div>
    </div>
    </div>
  );
};

export default AdminFeedback;


