import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAdmin } from '../../context/AdminContext';
import { useFeedback } from '../../context/feedbackContext';
import { useModelManagement } from '../../context/ModelContext';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import {
  IconUsers, IconMessageCircle, IconBrain, IconFileText,
  IconTrendingUp, IconServer, IconRefresh, IconAlertTriangle,
  IconCheck, IconClock, IconActivity, IconDatabase,
  IconChevronRight, IconShield, IconTarget, IconChartBar,
  IconArrowLeft, IconSearch, IconCrown
} from '@tabler/icons-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area
} from "recharts";

// Professional color scheme
const CHART_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { isDark } = useTheme();
  
  // Admin Context
  const { 
    getDashboardStats, 
    getAnalytics,
    getAllUsers,
    loading: adminLoading, 
    error: adminError
  } = useAdmin();

  // Feedback Context  
  const {
    getAllFeedbacks,
    loading: feedbackLoading,
    error: feedbackError
  } = useFeedback();

  // Model Management Context
  const {
    ingestedDocuments = [],
    notifications = [],
    getIngestedDocuments,
    getModels,
    ingestionLoading,
    modelLoading,
    error: modelError
  } = useModelManagement();

  // Local state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [models, setModels] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Axios instance with interceptors
  const apiClient = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor for auth token
  apiClient.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("adminToken") || 
                    localStorage.getItem("token") || 
                    localStorage.getItem("authToken");
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log('Unauthorized - clearing tokens');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
      }
      return Promise.reject(error);
    }
  );

  // System Health Check
  const fetchSystemHealth = async () => {
    setHealthLoading(true);
    try {
      console.log('🩺 Fetching system health...');
      
      const response = await apiClient.get('/api/admin/health');
      
      console.log('✅ Health data received:', response.data);
      setSystemHealth(response.data);
      setLastHealthCheck(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      
      let errorMessage = 'Health check failed';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Health check timed out';
      } else if (error.response?.status === 404) {
        errorMessage = 'Health endpoint not found';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Cannot connect to server';
      } else {
        errorMessage = error.response?.data?.message || error.message;
      }
      
      setSystemHealth({
        overall: 'unhealthy',
        error: true,
        message: errorMessage,
        services: {
          database: { status: 'unknown', error: errorMessage },
          fastapi: { status: 'unknown', error: errorMessage },
          llama: { status: 'unknown', error: errorMessage },
          rag: { status: 'unknown', error: errorMessage }
        },
        summary: {
          online_services: 0,
          total_services: 4,
          uptime_percentage: 0
        }
      });
      
      setLastHealthCheck(new Date().toLocaleTimeString() + ' (Failed)');
    } finally {
      setHealthLoading(false);
    }
  };

  // Data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsInitialLoading(true);
      try {
        console.log('🔄 Fetching initial dashboard data...');
        
        const [
          statsResult,
          analyticsResult,
          usersResult,
          feedbacksResult,
          documentsResult,
          modelsResult
        ] = await Promise.allSettled([
          getDashboardStats(),
          getAnalytics(),
          getAllUsers(),
          getAllFeedbacks(),
          getIngestedDocuments(),
          getModels()
        ]);

        // Process dashboard stats
        if (statsResult.status === 'fulfilled' && statsResult.value?.data) {
          console.log('📊 Stats data:', statsResult.value.data);
          setDashboardStats(statsResult.value.data);
        }

        // Process analytics
        if (analyticsResult.status === 'fulfilled' && analyticsResult.value) {
          console.log('📈 Analytics data:', analyticsResult.value);
          setAnalytics(analyticsResult.value?.data || analyticsResult.value?.intentAnalytics || []);
        }

        // Process users
        if (usersResult.status === 'fulfilled' && usersResult.value?.data) {
          console.log('👥 Users data:', usersResult.value.data.length);
          setUsers(usersResult.value.data);
        }

        // Process feedbacks
        if (feedbacksResult.status === 'fulfilled' && feedbacksResult.value?.feedbacks) {
          console.log('💬 Feedbacks data:', feedbacksResult.value.feedbacks.length);
          setFeedbacks(feedbacksResult.value.feedbacks);
        } else if (feedbacksResult.status === 'fulfilled' && feedbacksResult.value?.data) {
          console.log('💬 Feedbacks data (alt format):', feedbacksResult.value.data.length);
          setFeedbacks(feedbacksResult.value.data);
        }

        // Process models
        if (modelsResult.status === 'fulfilled' && modelsResult.value) {
          console.log('🤖 Models data:', modelsResult.value);
          setModels(Array.isArray(modelsResult.value) ? modelsResult.value : []);
        }

        console.log('📄 Ingested documents from context:', ingestedDocuments.length);

        // Initial health check
        await fetchSystemHealth();

      } catch (error) {
        console.error('❌ Error fetching initial data:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [getDashboardStats, getAnalytics, getAllUsers, getAllFeedbacks, getIngestedDocuments, getModels]);

  // Calculate real stats from actual data
  const calculateStats = () => {
    const totalUsers = Array.isArray(users) ? users.length : (dashboardStats?.totalUsers || 0);
    const totalSessions = dashboardStats?.totalSessions || 0;
    const totalMessages = dashboardStats?.totalMessages || 0;
    const feedbackCount = Array.isArray(feedbacks) ? feedbacks.length : 0;
    const ingestedDocumentsCount = Array.isArray(ingestedDocuments) ? ingestedDocuments.length : 0;
    const loadedModelsCount = Array.isArray(models) ? models.length : 0;
    const aiResponsesCount = totalMessages;
    const analyticsReportsCount = Array.isArray(analytics) ? analytics.length : 0;

    const stats = {
      totalUsers,
      totalSessions,
      totalMessages,
      feedbackCount,
      ingestedDocumentsCount,
      loadedModelsCount,
      aiResponsesCount,
      analyticsReportsCount
    };
    
    console.log('📊 Calculated dashboard stats:', stats);
    return stats;
  };

  const stats = calculateStats();

  // Process analytics for charts
  const processAnalyticsForCharts = () => {
    if (!Array.isArray(analytics) || !analytics.length) {
      const mockDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date;
      });

      return { 
        conversationsOverTime: mockDates.map((date, index) => ({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          conversations: Math.floor(stats.totalMessages * (0.1 + Math.random() * 0.2)),
          accuracy: 85 + Math.random() * 10,
          id: `mock-conversation-${index}`
        })),
        topIntents: [
          { intent: 'General Chat', count: Math.floor(stats.totalMessages * 0.4), id: 'general' },
          { intent: 'Technical Support', count: Math.floor(stats.totalMessages * 0.3), id: 'tech' },
          { intent: 'Document Analysis', count: Math.floor(stats.totalMessages * 0.2), id: 'docs' },
          { intent: 'Code Help', count: Math.floor(stats.totalMessages * 0.1), id: 'code' }
        ]
      };
    }

    const conversationsOverTime = analytics.slice(-7).map((item, index) => ({
      date: new Date(item.generatedAt || Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      conversations: item.totalQueries || 0,
      accuracy: item.accuracy || 85,
      id: `conversation-${index}`
    }));

    const topIntents = analytics.slice(0, 5).map((item, index) => ({
      intent: item.intent?.replace(/^the intent is:\s*/i, '').trim() || `Topic ${index + 1}`,
      count: item.totalQueries || 0,
      id: `intent-${index}`
    }));

    return { conversationsOverTime, topIntents };
  };

  const processFeedbackStats = () => {
    if (!Array.isArray(feedbacks) || !feedbacks.length) return [
      { status: 'Pending', count: 0, id: 'pending' },
      { status: 'Processed', count: 0, id: 'processed' },
      { status: 'Completed', count: 0, id: 'completed' }
    ];

    const stats = feedbacks.reduce((acc, feedback) => {
      const status = feedback.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(stats).map(([status, count], index) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      id: `feedback-${index}`
    }));
  };

  const processDocumentStats = () => {
    if (!Array.isArray(ingestedDocuments) || !ingestedDocuments.length) return [
      { status: 'Active', count: 0, id: 'active' },
      { status: 'Processing', count: 0, id: 'processing' },
      { status: 'Error', count: 0, id: 'error' }
    ];

    return [
      { status: 'Active', count: ingestedDocuments.length, id: 'active' },
      { status: 'Processing', count: 0, id: 'processing' },
      { status: 'Error', count: 0, id: 'error' }
    ];
  };

  const processUserRoleStats = () => {
    if (!Array.isArray(users) || !users.length) return [
      { role: 'Client', count: 0, id: 'client' },
      { role: 'Admin', count: 0, id: 'admin' }
    ];

    const stats = users.reduce((acc, user) => {
      const role = user.role || 'client';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(stats).map(([role, count], index) => ({
      role: role.charAt(0).toUpperCase() + role.slice(1),
      count,
      id: `role-${index}`
    }));
  };

  // Recent users for table
  const recentUsers = Array.isArray(users) ? users
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5) : [];

  // Filter users based on search
  const filteredUsers = recentUsers.filter(user => 
    (user.username || user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4"
               style={{ 
                 border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                 borderTopColor: isDark ? '#ffffff' : '#000000'
               }}></div>
          <h3 className="text-lg font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Loading Dashboard
          </h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
            Fetching your system overview...
          </p>
        </div>
      </div>
    );
  }

  // Process chart data
  const { conversationsOverTime, topIntents } = processAnalyticsForCharts();
  const feedbackStats = processFeedbackStats();
  const documentStats = processDocumentStats();
  const userRoleStats = processUserRoleStats();

  return (
    <div className="min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* ✅ Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* ✅ SEAMLESS HEADER - EXACTLY LIKE USERS.JSX */}
        <div className="backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 250, 250, 0.8)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Left Section */}
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Hi, {user?.username || user?.name || 'Admin'}! 👋
                  </h1>
                  <p className="text-xs sm:text-sm"
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Welcome back to your admin dashboard
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
                    placeholder="Search recent users..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-0 transition-all focus:ring-2"
                    style={{ 
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      color: isDark ? '#ffffff' : '#000000',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                </div>
                
                {/* Stats & Actions */}
                <div className="flex items-center gap-3">
                  <div className="px-3 py-2 rounded-lg text-sm font-medium"
                       style={{ 
                         backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                         color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
                       }}>
                    {stats.totalUsers} users • {stats.totalMessages} messages
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    disabled={isInitialLoading}
                    className="px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 text-sm"
                    style={{ 
                      backgroundColor: isDark ? '#ffffff' : '#000000',
                      color: isDark ? '#000000' : '#ffffff'
                    }}
                  >
                    <IconRefresh size={16} className={isInitialLoading ? 'animate-spin' : ''} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

          {/* ✅ ERROR STATE */}
          {adminError && (
            <div className="p-4 rounded-2xl flex items-center gap-3 border-0"
                 style={{ 
                   backgroundColor: 'rgba(239, 68, 68, 0.1)',
                   color: isDark ? '#ffffff' : '#000000'
                 }}>
              <IconAlertTriangle size={20} className="text-red-500" />
              <div>
                <p className="font-medium">Error loading dashboard data</p>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  {adminError}
                </p>
              </div>
            </div>
          )}

          {/* ✅ NOTIFICATIONS */}
          {Array.isArray(notifications) && notifications.length > 0 && (
            <div className="space-y-4">
              {notifications.slice(0, 3).map((notification, index) => (
                <div
                  key={`notification-${notification.id || index}`}
                  className={`p-4 rounded-2xl text-sm border-0 ${
                    notification.type === 'error' 
                      ? 'bg-red-500/10 text-red-400'
                      : notification.type === 'warning'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  {notification.message}
                </div>
              ))}
            </div>
          )}

          {/* ✅ STATS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Total Users', value: stats.totalUsers, icon: IconUsers },
              { title: 'Chat Sessions', value: stats.totalSessions, icon: IconMessageCircle },
              { title: 'Total Messages', value: stats.totalMessages, icon: IconActivity },
              { title: 'Feedback Count', value: stats.feedbackCount, icon: IconTarget }
            ].map((stat, index) => (
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
                         backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                         color: isDark ? '#ffffff' : '#000000'
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
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
              </div>
            </div>
          ))}
          </div>

          {/* ✅ SECONDARY STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Data Sheets', value: stats.ingestedDocumentsCount, icon: IconFileText },
              { title: 'AI Models', value: stats.loadedModelsCount, icon: IconBrain },
              { title: 'AI Responses', value: stats.aiResponsesCount, icon: IconDatabase },
              { title: 'Analytics Reports', value: stats.analyticsReportsCount, icon: IconChartBar }
            ].map((stat, index) => (
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
                         backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                         color: isDark ? '#ffffff' : '#000000'
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
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
              </div>
            </div>
          ))}
          </div>

          {/* ✅ CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Activity Overview */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
              <div className="px-6 py-4 border-b border-opacity-10"
                   style={{ 
                     backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                     borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                   }}>
                <div className="flex items-center gap-3">
                  <IconActivity size={18} style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }} />
                  <h3 className="text-base sm:text-lg font-semibold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Activity Overview
                  </h3>
                </div>
              </div>
              <div className="p-6">
                {conversationsOverTime.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={conversationsOverTime}>
                      <defs>
                        <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}
                        axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }} 
                        axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                          border: 'none',
                          borderRadius: '12px',
                          color: isDark ? '#ffffff' : '#000000',
                          backdropFilter: 'blur(10px)',
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="conversations" 
                        stroke="#3B82F6" 
                        fillOpacity={1} 
                        fill="url(#colorConversations)"
                        name="Conversations"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <IconActivity size={48} style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} className="mx-auto mb-4" />
                      <p className="mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>No activity data available</p>
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Start using the chatbot to see analytics
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User Roles */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
              <div className="px-6 py-4 border-b border-opacity-10"
                   style={{ 
                     backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                     borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                   }}>
                <div className="flex items-center gap-3">
                  <IconUsers size={18} style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }} />
                  <h3 className="text-base sm:text-lg font-semibold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    User Roles
                  </h3>
                </div>
              </div>
              <div className="p-6">
                {userRoleStats.length > 0 && users.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={userRoleStats}
                        dataKey="count"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ 
                          fontSize: '11px', 
                          fontWeight: '600',
                          fill: isDark ? '#ffffff' : '#000000'
                        }}
                      >
                        {userRoleStats.map((entry, index) => (
                          <Cell key={`role-cell-${entry.id || index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                          border: 'none',
                          borderRadius: '12px',
                          color: isDark ? '#ffffff' : '#000000',
                          backdropFilter: 'blur(10px)',
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <IconUsers size={48} style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} className="mx-auto mb-4" />
                      <p className="mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>No user data available</p>
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Total users: {stats.totalUsers}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* System Health Monitor */}
            <div className="lg:col-span-3 rounded-2xl overflow-hidden"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
              <div className="px-6 py-4 border-b border-opacity-10"
                   style={{ 
                     backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                     borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                   }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconServer size={18} style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }} />
                    <h3 className="text-base sm:text-lg font-semibold"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      System Health Monitor
                    </h3>
                  </div>
                  <button
                    onClick={fetchSystemHealth}
                    disabled={healthLoading}
                    className="text-sm px-3 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    style={{ 
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
                    }}
                  >
                    <IconRefresh size={14} className={healthLoading ? 'animate-spin' : ''} />
                    {healthLoading ? 'Checking...' : 'Refresh'}
                  </button>
                </div>
              </div>
              <div className="p-6">
                {systemHealth ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-6">
                      {systemHealth?.overall && (
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          systemHealth.overall === 'healthy'
                            ? 'bg-green-500/10 text-green-400'
                            : systemHealth.overall === 'degraded'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {systemHealth.overall.toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(systemHealth.services || {}).map(([service, data]) => (
                        <div key={service} 
                             className="p-4 rounded-xl"
                             style={{ 
                               backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                             }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize"
                                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                              {service}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${
                                data.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                              }`}></span>
                              <span className={`text-sm font-medium ${
                                data.status === 'online' ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {data.status || 'Unknown'}
                              </span>
                            </div>
                          </div>
                          {data.response_time_ms && (
                            <div className="text-xs"
                                 style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                              Response: {data.response_time_ms}ms
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {systemHealth.summary && (
                      <div className="pt-4 border-t text-center"
                           style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                        <p className="text-sm"
                           style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                          {systemHealth.summary.online_services}/{systemHealth.summary.total_services} services online
                          ({systemHealth.summary.uptime_percentage}% uptime)
                        </p>
                      </div>
                    )}

                    {lastHealthCheck && (
                      <div className="text-center pt-2">
                        <p className="text-xs"
                           style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          Last check: {lastHealthCheck}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    {healthLoading ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
                             style={{ color: isDark ? '#ffffff' : '#000000' }}></div>
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                          Checking system health...
                        </span>
                      </div>
                    ) : (
                      <div>
                        <IconAlertTriangle size={48} style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} className="mx-auto mb-4" />
                        <p className="mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>Health status unavailable</p>
                        <button
                          onClick={fetchSystemHealth}
                          className="text-sm underline hover:no-underline transition-colors"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                        >
                          Try checking again
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ✅ RECENT USERS TABLE */}
          {filteredUsers.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
            
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-opacity-10"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                   borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                 }}>
              <div className="flex items-center gap-3">
                <IconUsers size={18} style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }} />
                <h3 className="text-base sm:text-lg font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Recent Users
                </h3>
              </div>
            </div>
            
            {/* Table Header Row */}
            <div className="px-6 py-4 border-b border-opacity-10"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                   borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                 }}>
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold"
                   style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                <div className="col-span-3">User</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">Joined</div>
                <div className="col-span-2">Actions</div>
              </div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-opacity-10"
                 style={{ 
                   borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                 }}>
              {filteredUsers.map((user) => (
                <div key={user._id} 
                     className="px-6 py-4 hover:bg-opacity-50 transition-all duration-200"
                     onMouseEnter={(e) => {
                       e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)';
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.backgroundColor = 'transparent';
                     }}>
                  <div className="grid grid-cols-12 gap-4 text-sm"
                       style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                    
                    {/* User */}
                    <div className="col-span-3 flex items-center gap-3">
                      <img
                        src={user.profilePicture || 'https://assets.aceternity.com/manu.png'}
                        alt={user.username || user.name}
                        className="w-10 h-10 rounded-full object-cover"
                        style={{ 
                          backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                        onError={(e) => {
                          e.target.src = 'https://assets.aceternity.com/manu.png';
                        }}
                      />
                      <div>
                        <div className="font-medium"
                             style={{ color: isDark ? '#ffffff' : '#000000' }}>
                          {user.username || user.name || 'Unknown'}
                        </div>
                        <div className="text-xs"
                             style={{ color: isDark ? '#888888' : '#666666' }}>
                          ID: {user._id?.slice(-8) || 'N/A'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Email */}
                    <div className="col-span-3">
                      <div className="text-sm"
                           style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        {user.email || 'No email'}
                      </div>
                    </div>
                    
                    {/* Role */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${
                        user.role === 'super-admin' 
                          ? isDark ? 'bg-purple-900/20 text-purple-400 border border-purple-400/20' : 'bg-purple-100 text-purple-800 border border-purple-300'
                          : user.role === 'admin'
                          ? isDark ? 'bg-blue-900/20 text-blue-400 border border-blue-400/20' : 'bg-blue-100 text-blue-800 border border-blue-300'
                          : isDark ? 'bg-green-900/20 text-green-400 border border-green-400/20' : 'bg-green-100 text-green-800 border border-green-300'
                      }`}>
                        {user.role === 'super-admin' && <IconCrown size={12} />}
                        {user.role === 'admin' && <IconShield size={12} />}
                        {user.role === 'client' && <IconUsers size={12} />}
                        {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                      </span>
                    </div>
                    
                    {/* Joined Date */}
                    <div className="col-span-2">
                      <div className="text-sm"
                           style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        {user.createdAt 
                          ? new Date(user.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Unknown'}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="col-span-2">
                      <button
                        onClick={() => navigate('/admin/users')}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        style={{ 
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: '#3b82f6'
                        }}
                      >
                        View All
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ QUICK ACTIONS */}
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
            <div className="flex items-center gap-3">
              <IconChevronRight size={18} style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }} />
              <h3 className="text-base sm:text-lg font-semibold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Quick Actions
              </h3>
            </div>
          </div>
          
          {/* Actions */}
          <div className="p-6 space-y-3">
            <button
              className="w-full text-left py-3 px-4 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-between"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                color: isDark ? '#ffffff' : '#000000'
              }}
              onClick={() => navigate('/admin/users')}
            >
              <span>View All Users ({stats.totalUsers})</span>
              <IconChevronRight size={16} />
            </button>
            <button
              className="w-full text-left py-3 px-4 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-between"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                color: isDark ? '#ffffff' : '#000000'
              }}
              onClick={() => navigate('/admin/models')}
            >
              <span>Manage Data Sheets ({stats.ingestedDocumentsCount})</span>
              <IconChevronRight size={16} />
            </button>
            <button
              className="w-full text-left py-3 px-4 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-between"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                color: isDark ? '#ffffff' : '#000000'
              }}
              onClick={() => navigate('/admin/feedback-reply')}
            >
              <span>Review Feedback ({stats.feedbackCount})</span>
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}