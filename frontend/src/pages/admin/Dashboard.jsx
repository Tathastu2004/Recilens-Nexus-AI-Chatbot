import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAdmin } from '../../context/AdminContext';
import { useFeedback } from '../../context/feedbackContext';
import { useModelManagement } from '../../context/ModelContext';
import { useUser } from '../../context/UserContext';
import StatCard from "../../components/admin/Statscard";
import ChartCard from "../../components/admin/chartcard";
import Table from "../../components/admin/Table";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area
} from "recharts";

const COLORS = ["#2F855A", "#68D391", "#81E6D9", "#38B2AC", "#E53E3E", "#DD6B20"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  
  // Admin Context
  const { 
    getDashboardStats, 
    getAnalytics,
    getAllUsers,
    getTrainingJobs,
    loading: adminLoading, 
    error: adminError,
    analyticsLoading,
    analyticsError
  } = useAdmin();

  // Feedback Context
  const {
    getAllFeedbacks,
    loading: feedbackLoading,
    error: feedbackError
  } = useFeedback();

  // Model Management Context
  const {
    trainingJobs,
    loadedModels,
    notifications,
    getLoadedModels,
    trainingLoading,
    modelLoading,
    error: modelError
  } = useModelManagement();

  // Local state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState(null);

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

  // ✅ ENHANCED System Health Check with Axios
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
      
      // Determine error message
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
          blip: { status: 'unknown', error: errorMessage }
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

  // Safe API call wrapper
  const safeApiCall = async (apiFunction, fallbackValue = null) => {
    try {
      const result = await apiFunction();
      return result;
    } catch (error) {
      console.error('API call failed:', error);
      return fallbackValue;
    }
  };

  // Monitor systemHealth changes
  useEffect(() => {
    if (systemHealth) {
      console.log('📊 systemHealth updated:', systemHealth);
    }
  }, [systemHealth]);

  // Health check effect
  useEffect(() => {
    fetchSystemHealth();
    const healthInterval = setInterval(fetchSystemHealth, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('📊 Fetching dashboard data...');
        
        const [statsRes, analyticsRes, usersRes, feedbackRes] = await Promise.allSettled([
          safeApiCall(() => getDashboardStats(), {}),
          safeApiCall(() => getAnalytics(), []),
          safeApiCall(() => getAllUsers(), { users: [] }),
          safeApiCall(() => getAllFeedbacks(), { feedbacks: [] })
        ]);

        setDashboardStats(statsRes.status === 'fulfilled' ? statsRes.value : {});
        setAnalytics(analyticsRes.status === 'fulfilled' ? (analyticsRes.value || []) : []);
        setUsers(usersRes.status === 'fulfilled' ? (usersRes.value?.users || []) : []);
        setFeedbacks(feedbackRes.status === 'fulfilled' ? (feedbackRes.value?.feedbacks || []) : []);

        console.log('✅ Dashboard data loaded');
        safeApiCall(() => getLoadedModels());

      } catch (error) {
        console.error('❌ Dashboard data fetch error:', error);
      }
    };

    fetchDashboardData();
  }, []);

  // Process analytics for charts
  const processAnalyticsForCharts = () => {
    if (!analytics.length) return { conversationsOverTime: [], topIntents: [] };

    const conversationsOverTime = analytics.slice(-7).map((item) => ({
      date: new Date(item.generatedAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      conversations: item.totalQueries,
      accuracy: item.accuracy
    }));

    const topIntents = analytics.slice(0, 5).map(item => ({
      intent: item.intent.replace(/^the intent is:\s*/i, '').trim() || 'General',
      count: item.totalQueries
    }));

    return { conversationsOverTime, topIntents };
  };

  const processFeedbackStats = () => {
    if (!feedbacks.length) return [];
    const stats = feedbacks.reduce((acc, feedback) => {
      acc[feedback.status] = (acc[feedback.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(stats).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count
    }));
  };

  const processTrainingStats = () => {
    if (!trainingJobs.length) return [];
    const stats = trainingJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(stats).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count
    }));
  };

  const processUserRoleStats = () => {
    if (!users.length) return [];
    const stats = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(stats).map(([role, count]) => ({
      role: role.charAt(0).toUpperCase() + role.slice(1),
      count
    }));
  };

  // Recent users for table
  const recentUsers = users
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const tableHeaders = ["Name", "Email", "Role"];
  const tableRows = recentUsers.map(user => [
    user.username || user.name || 'Unknown',
    user.email,
    user.role
  ]);

  // Loading state
  if (adminLoading || feedbackLoading || trainingLoading || modelLoading) {
    return (
      <div className="p-8 bg-green-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
        <span className="ml-4 text-green-700 text-lg">Loading dashboard...</span>
      </div>
    );
  }

  // Critical error state
  if (adminError && adminError.includes('401')) {
    return (
      <div className="p-8 bg-green-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          <strong>Authentication Error:</strong> Please log in again.
        </div>
      </div>
    );
  }

  const { conversationsOverTime, topIntents } = processAnalyticsForCharts();
  const feedbackStats = processFeedbackStats();
  const trainingStats = processTrainingStats();
  const userRoleStats = processUserRoleStats();

  return (
    <div className="p-8 bg-green-50 min-h-screen">
      {/* Header with Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-900 mb-2">
          Hi, {user?.username || user?.name || 'Admin'}! 👋
        </h1>
        <p className="text-green-700">
          Welcome back to your admin dashboard. Here's your system overview.
        </p>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.slice(0, 3).map(notification => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg text-sm ${
                notification.type === 'error' 
                  ? 'bg-red-100 border border-red-300 text-red-800'
                  : notification.type === 'warning'
                  ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                  : 'bg-blue-100 border border-blue-300 text-blue-800'
              }`}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="Total Users" 
          value={dashboardStats?.totalUsers || users.length || 0}
        />
        <StatCard 
          title="Chat Sessions" 
          value={dashboardStats?.totalSessions || 0}
        />
        <StatCard 
          title="Total Messages" 
          value={dashboardStats?.totalMessages || 0}
        />
        <StatCard 
          title="Feedback Count" 
          value={feedbacks.length || 0}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="Training Jobs" 
          value={trainingJobs.length || 0}
        />
        <StatCard 
          title="Loaded Models" 
          value={loadedModels.length || 0}
        />
        <StatCard 
          title="AI Responses" 
          value={dashboardStats?.aiMessages || 0}
        />
        <StatCard 
          title="Analytics Reports" 
          value={analytics.length || 0}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-10">
        
        {/* Activity Overview */}
        <ChartCard title="Activity Overview" className="lg:col-span-2">
          {conversationsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={conversationsOverTime}>
                <defs>
                  <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2F855A" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2F855A" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="conversations" 
                  stroke="#2F855A" 
                  fillOpacity={1} 
                  fill="url(#colorConversations)"
                  name="Conversations"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No activity data available</p>
            </div>
          )}
        </ChartCard>

        {/* User Roles */}
        <ChartCard title="User Roles">
          {userRoleStats.length > 0 ? (
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
                >
                  {userRoleStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No user data available</p>
            </div>
          )}
        </ChartCard>

        {/* Top Intents */}
        <ChartCard title="Popular Topics">
          {topIntents.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topIntents} layout="horizontal">
                <XAxis type="number" />
                <YAxis dataKey="intent" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#68D391" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No intent data available</p>
            </div>
          )}
        </ChartCard>

        {/* Training Status */}
        <ChartCard title="Model Training Status">
          {trainingStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trainingStats}>
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#81E6D9" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No training data available</p>
            </div>
          )}
        </ChartCard>

        {/* Feedback Status */}
        <ChartCard title="Support Feedback">
          {feedbackStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={feedbackStats}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {feedbackStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No feedback data available</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Recent Users Table */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-green-800">Recent Users</h3>
          <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full">
            {users.length} Total Users
          </span>
        </div>
        
        {recentUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table headers={tableHeaders} rows={tableRows} />
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No users found</p>
          </div>
        )}
      </div>

      {/* Bottom Section: Quick Actions and System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h4 className="font-semibold text-green-800 mb-4">Quick Actions</h4>
          <div className="space-y-3">
            <button
              className="w-full text-left text-green-600 hover:text-green-800 py-2 px-3 rounded hover:bg-green-50 transition-colors"
              onClick={() => navigate('/admin/users')}
            >
              → View All Users ({users.length})
            </button>
            <button
              className="w-full text-left text-green-600 hover:text-green-800 py-2 px-3 rounded hover:bg-green-50 transition-colors"
              onClick={() => navigate('/admin/models')}
            >
              → Manage Training Jobs ({trainingJobs.length})
            </button>
            <button
              className="w-full text-left text-green-600 hover:text-green-800 py-2 px-3 rounded hover:bg-green-50 transition-colors"
              onClick={() => navigate('/admin/feedback-reply')}
            >
              → Review Feedback ({feedbacks.length})
            </button>
          </div>
        </div>

        {/* ✅ ENHANCED System Health Monitor */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow md:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-green-800 text-lg">System Health Monitor</h4>
            <div className="flex items-center gap-3">
              {systemHealth?.overall && (
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  systemHealth.overall === 'healthy'
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : systemHealth.overall === 'degraded'
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                  {systemHealth.overall.toUpperCase()}
                </span>
              )}
              <button
                onClick={fetchSystemHealth}
                disabled={healthLoading}
                className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {healthLoading ? 'Checking...' : '↻ Refresh'}
              </button>
            </div>
          </div>
          
          {systemHealth ? (
            <div className="space-y-4">
              {/* Services Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Database */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                      </svg>
                      Database
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        systemHealth.services?.database?.status === 'online' 
                          ? 'bg-green-500 animate-pulse' 
                          : 'bg-red-500'
                      }`}></span>
                      <span className={`text-sm font-medium ${
                        systemHealth.services?.database?.status === 'online'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {systemHealth.services?.database?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {systemHealth.services?.database?.type && (
                      <div>Type: {systemHealth.services.database.type.toUpperCase()}</div>
                    )}
                    {systemHealth.services?.database?.response_time_ms && (
                      <div>Response: {systemHealth.services.database.response_time_ms}ms</div>
                    )}
                    {systemHealth.services?.database?.last_checked && (
                      <div>Checked: {new Date(systemHealth.services.database.last_checked).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>

                {/* FastAPI */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z"/>
                      </svg>
                      FastAPI Service
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        systemHealth.services?.fastapi?.status === 'online' 
                          ? 'bg-green-500 animate-pulse' 
                          : 'bg-red-500'
                      }`}></span>
                      <span className={`text-sm font-medium ${
                        systemHealth.services?.fastapi?.status === 'online'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {systemHealth.services?.fastapi?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {systemHealth.services?.fastapi?.response_time_ms && (
                      <div>Response: {systemHealth.services.fastapi.response_time_ms}ms</div>
                    )}
                    {systemHealth.services?.fastapi?.last_checked && (
                      <div>Checked: {new Date(systemHealth.services.fastapi.last_checked).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>

                {/* Llama Model */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      🦙 Llama Model
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        systemHealth.services?.llama?.status === 'online' 
                          ? 'bg-green-500 animate-pulse' 
                          : 'bg-red-500'
                      }`}></span>
                      <span className={`text-sm font-medium ${
                        systemHealth.services?.llama?.status === 'online'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {systemHealth.services?.llama?.status || 'Unknown'}
                      </span>
                      {systemHealth.services?.llama?.connected && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {systemHealth.services?.llama?.response_time_ms !== undefined && (
                      <div>Response: {systemHealth.services.llama.response_time_ms}ms</div>
                    )}
                    {systemHealth.services?.llama?.last_checked && (
                      <div>Checked: {new Date(systemHealth.services.llama.last_checked).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>

                {/* BLIP Model */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      🖼️ BLIP Model
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        systemHealth.services?.blip?.status === 'online' 
                          ? 'bg-green-500 animate-pulse' 
                          : 'bg-red-500'
                      }`}></span>
                      <span className={`text-sm font-medium ${
                        systemHealth.services?.blip?.status === 'online'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {systemHealth.services?.blip?.status || 'Unknown'}
                      </span>
                      {systemHealth.services?.blip?.connected && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {systemHealth.services?.blip?.response_time_ms && (
                      <div>Response: {systemHealth.services.blip.response_time_ms}ms</div>
                    )}
                    {systemHealth.services?.blip?.last_checked && (
                      <div>Checked: {new Date(systemHealth.services.blip.last_checked).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* System Resources */}
              {systemHealth.system && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h5 className="font-medium text-gray-700 mb-3">System Resources</h5>
                  <div className="grid grid-cols-3 gap-4">
                    {systemHealth.system.cpu_percent !== undefined && (
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-800">{systemHealth.system.cpu_percent}%</div>
                        <div className="text-xs text-gray-500">CPU Usage</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              systemHealth.system.cpu_percent > 80 ? 'bg-red-500' :
                              systemHealth.system.cpu_percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(systemHealth.system.cpu_percent, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {systemHealth.system.memory_percent !== undefined && (
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-800">{systemHealth.system.memory_percent}%</div>
                        <div className="text-xs text-gray-500">Memory Usage</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              systemHealth.system.memory_percent > 80 ? 'bg-red-500' :
                              systemHealth.system.memory_percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(systemHealth.system.memory_percent, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {systemHealth.system.disk_percent !== undefined && (
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-800">{systemHealth.system.disk_percent}%</div>
                        <div className="text-xs text-gray-500">Disk Usage</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              systemHealth.system.disk_percent > 80 ? 'bg-red-500' :
                              systemHealth.system.disk_percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(systemHealth.system.disk_percent, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              {systemHealth.summary && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Overall Status</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                        systemHealth.overall === 'healthy'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : systemHealth.overall === 'degraded'
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {systemHealth.summary.uptime_percentage}% Uptime
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {systemHealth.summary.online_services}/{systemHealth.summary.total_services} services online
                  </p>
                </div>
              )}

              {lastHealthCheck && (
                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    Last health check: {lastHealthCheck}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              {healthLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                  <span className="text-gray-600">Checking system health...</span>
                </div>
              ) : (
                <div className="text-gray-500">
                  <p className="mb-2">Health status unavailable</p>
                  <button
                    onClick={fetchSystemHealth}
                    className="text-sm text-green-600 hover:text-green-800 underline"
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
  );
}
