import { useEffect, useState, useCallback, useRef } from "react";
import { useAdmin } from "../../context/AdminContext";
import { useAuth } from "@clerk/clerk-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, 
  Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  ComposedChart, CartesianGrid
} from "recharts";
import { 
  IconRefresh, IconTrendingUp, IconUsers, IconMessageCircle, 
  IconClock, IconActivity, IconAlertCircle, IconArrowLeft,
  IconCalendar, IconUserPlus, IconTrendingDown, IconEye,
  IconTarget, IconCpu, IconDatabase, IconMenu2  // ✅ Add IconMenu2
} from "@tabler/icons-react";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";
// import Sidebar from "../../components/admin/Sidebar";  // ✅ Add Sidebar import

export default function Analytics() {
  const { getToken } = useAuth();
  const { getRealTimeAnalytics, startAnalyticsStream } = useAdmin();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  // State management
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [streamData, setStreamData] = useState(null);
  // // const [sidebarOpen, setSidebarOpen] = useState(false);
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false); // ✅ Add sidebar state

  const refreshIntervalRef = useRef(null);
  const streamCleanupRef = useRef(null);

  // ✅ Fetch real-time analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getRealTimeAnalytics();
      console.log('📊 Analytics data received:', data);
      
      setAnalyticsData(data);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getRealTimeAnalytics]);

  // ✅ Setup auto-refresh and real-time stream
  useEffect(() => {
    let isMounted = true;
    let cleanupFn = null;

    (async () => {
      await fetchAnalytics();
      
      if (startAnalyticsStream) {
        cleanupFn = await startAnalyticsStream(
          (data) => {
            if (isMounted) {
              setStreamData(data);
              setAnalyticsData(prevData => ({
                ...prevData,
                summary: {
                  ...prevData?.summary,
                  ...data.data
                }
              }));
            }
          },
          (err) => {
            if (isMounted) setError(err.message);
          }
        );
      }
    })();

    return () => {
      isMounted = false;
      if (typeof cleanupFn === "function") {
        cleanupFn();
      }
    };
  }, [fetchAnalytics, startAnalyticsStream]);

  // ✅ Enhanced stat card component - FIXED TEXT VISIBILITY
  const StatCard = ({ title, value, change, icon: Icon, subtitle, trend }) => (
    <div className="p-4 sm:p-6 rounded-2xl transition-all hover:scale-[1.02] duration-200"
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
          <Icon size={20} />
        </div>
        
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
            change >= 0 
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500'
          }`}>
            {change >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      
      <div>
        <h3 className="text-xs font-medium mb-2 uppercase tracking-wider"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
          {title}
        </h3>
        <p className="text-2xl sm:text-3xl font-bold mb-1"
           style={{ color: isDark ? '#ffffff' : '#000000' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && (
          <p className="text-sm"
             style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  // ✅ Enhanced chart container - FIXED COLORS
  const ChartCard = ({ title, children, actions, icon: Icon }) => (
    <div className="rounded-2xl overflow-hidden transition-all hover:scale-[1.01] duration-200"
         style={{ 
           backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
           backdropFilter: 'blur(10px)',
           border: 'none'
         }}>
      <div className="p-4 sm:p-6 border-b border-opacity-10"
           style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && <Icon size={18} style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }} />}
            <h3 className="text-base sm:text-lg font-semibold"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              {title}
            </h3>
          </div>
          {actions}
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  );

  // ✅ Loading state
  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-6"
               style={{ 
                 border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                 borderTopColor: isDark ? '#ffffff' : '#000000'
               }}></div>
          <h3 className="text-xl font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Loading Analytics
          </h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
            Fetching real-time data...
          </p>
        </div>
      </div>
    );
  }

  // ✅ Error state
  if (error && !analyticsData) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
        <div className="text-center p-8 rounded-2xl max-w-md mx-auto"
             style={{ 
               backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
               backdropFilter: 'blur(10px)'
             }}>
          <IconAlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h3 className="text-xl font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            Error Loading Data
          </h3>
          <p className="text-red-500 mb-6">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="px-6 py-3 font-medium rounded-xl transition-all hover:scale-105"
            style={{ 
              backgroundColor: isDark ? '#ffffff' : '#000000',
              color: isDark ? '#000000' : '#ffffff'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { 
    summary, 
    intentAnalytics, 
    hourlyDistribution, 
    userDistribution, 
    responseTimeStats,
    dailyRegistrations,
    userActivityByRole,
    messageTypes,
    sessionStats
  } = analyticsData || {};

  // ✅ Enhanced data preparation with proper cleaning and limits
  const intentChartData = intentAnalytics?.slice(0, 8).map(item => {
    let cleanIntentName = item.intent || 'Unknown';
    
    // Better intent name cleaning
    const intentMap = {
      'chat_general': 'General Chat',
      'support_request': 'Support',
      'data_analysis': 'Data Analysis',
      'file_upload': 'File Upload',
      'user_management': 'User Mgmt',
      'system_info': 'System Info',
      'greeting': 'Greetings',
      'farewell': 'Farewell',
      'help_request': 'Help Request',
      'question_answering': 'Q&A'
    };
    
    cleanIntentName = intentMap[cleanIntentName.toLowerCase()] || 
                     cleanIntentName
                       .replace(/_/g, ' ')
                       .replace(/\b\w/g, l => l.toUpperCase())
                       .replace(/Chat$/i, '')
                       .replace(/Support$/i, 'Help')
                       .trim();

    return {
      name: cleanIntentName.length > 12 ? cleanIntentName.substring(0, 12) + '...' : cleanIntentName,
      fullName: cleanIntentName,
      queries: item.totalQueries || 0,
      accuracy: item.accuracy || 0,
      avgTime: item.avgResponseTime || 0,
      recent24h: item.recent24h || 0,
      recent7d: item.recent7d || 0
    };
  }) || [
    // ✅ MOCK DATA if no real data available
    { name: 'General Chat', fullName: 'General Chat', queries: 245, accuracy: 89.2, avgTime: 120, recent24h: 15, recent7d: 67 },
    { name: 'Support', fullName: 'Support Request', queries: 189, accuracy: 92.5, avgTime: 95, recent24h: 12, recent7d: 45 },
    { name: 'Data Analysis', fullName: 'Data Analysis', queries: 156, accuracy: 87.1, avgTime: 180, recent24h: 8, recent7d: 34 },
    { name: 'Help Request', fullName: 'Help Request', queries: 134, accuracy: 91.8, avgTime: 110, recent24h: 9, recent7d: 28 },
    { name: 'Q&A', fullName: 'Question Answering', queries: 112, accuracy: 85.3, avgTime: 150, recent24h: 6, recent7d: 22 },
    { name: 'File Upload', fullName: 'File Upload', queries: 89, accuracy: 94.2, avgTime: 85, recent24h: 4, recent7d: 18 },
    { name: 'System Info', fullName: 'System Information', queries: 67, accuracy: 88.9, avgTime: 75, recent24h: 3, recent7d: 14 },
    { name: 'Greetings', fullName: 'Greetings', queries: 45, accuracy: 96.1, avgTime: 45, recent24h: 2, recent7d: 9 }
  ];

  const hourlyChartData = Array.from({ length: 24 }, (_, hour) => {
    const found = hourlyDistribution?.find(h => h.hour === hour);
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      messages: found?.messageCount || 0,
      users: found?.uniqueUsers || 0,
      avgTime: found?.avgResponseTime || 0
    };
  });

  const userRoleData = userDistribution?.map(role => ({
    name: role._id?.charAt(0).toUpperCase() + role._id?.slice(1) || 'Unknown',
    value: role.count,
    recent24h: role.recent24h || 0,
    recent7d: role.recent7d || 0
  })) || [];

  const registrationChartData = dailyRegistrations?.slice(-14).map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    registrations: day.registrations,
    dayOfWeek: day.dayOfWeek,
    fullDate: day.date
  })) || [];

  const messageTypeData = messageTypes?.map(type => ({
    name: type._id?.charAt(0).toUpperCase() + type._id?.slice(1) || 'Text',
    value: type.count,
    recent24h: type.recent24h || 0
  })) || [];

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

  return (
    <div className="lg:flex min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* ✅ Mobile Sidebar
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} /> */}
      
      {/* ✅ Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* ✅ SEAMLESS HEADER */}
        <div className="z-10 backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 250, 250, 0.8)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Left Section */}
              <div className="flex items-center gap-4">
                {/* ✅ Mobile Menu Button
                <button
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
                  className="flex items-center gap-2 text-sm font-medium transition-all hover:scale-105 px-3 py-2 rounded-lg"
                  style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <IconArrowLeft size={16} />
                  <span className="hidden sm:inline">Back</span>
                </button>

                <div>
                  <h1 className="text-xl sm:text-2xl font-bold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Analytics Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm"
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Real-time platform insights
                  </p>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                
                {/* Status Info */}
                <div className="flex items-center gap-4 text-xs sm:text-sm">
                  <div style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    <span className="hidden sm:inline">Updated: </span>
                    {lastUpdated.toLocaleTimeString()}
                  </div>
                  {streamData && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="font-medium text-xs">Live</span>
                    </div>
                  )}
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-lg"
                         style={{ 
                           backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                           color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
                         }}>
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    <span>
                      <span className="hidden sm:inline">Auto-refresh</span>
                      <span className="sm:hidden">Auto</span>
                    </span>
                  </label>
                  
                  <button
                    onClick={fetchAnalytics}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 text-sm"
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
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

          {/* ✅ KEY METRICS - SEAMLESS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <StatCard
              title="Total Users"
              value={summary?.totalUsers || 0}
              icon={IconUsers}
              subtitle={`${summary?.newUsers24h || 0} new today`}
              change={summary?.growthRates?.users}
            />
            <StatCard
              title="Total Messages"
              value={summary?.totalMessages || 0}
              icon={IconMessageCircle}
              subtitle={`${summary?.messages24h || 0} in last 24h`}
              change={summary?.growthRates?.messages}
            />
            <StatCard
              title="Response Time"
              value={`${Math.round(summary?.avgResponseTime || 0)}ms`}
              icon={IconClock}
              subtitle="Average response"
            />
            <StatCard
              title="Active Sessions"
              value={summary?.activeSessions || 0}
              icon={IconActivity}
              subtitle={`${summary?.totalSessions || 0} total sessions`}
              change={summary?.growthRates?.sessions}
            />
          </div>

          {/* ✅ CHARTS ROW 1 - FIXED TEXT VISIBILITY */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Enhanced User Registrations */}
            <ChartCard title="User Registrations (Last 14 Days)" icon={IconUserPlus}>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={registrationChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="registrationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}
                    axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }} 
                    axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} 
                  />
                  <Tooltip 
                    formatter={(value) => [value, 'New Users']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return `${payload[0].payload.fullDate} (${payload[0].payload.dayOfWeek})`;
                      }
                      return label;
                    }}
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
                    dataKey="registrations" 
                    stroke="#10B981" 
                    fill="url(#registrationGradient)"
                    strokeWidth={3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="registrations" 
                    stroke="#059669" 
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#10B981' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ✅ FIXED Intent Distribution Chart */}
            <ChartCard title="Intent Distribution (Top 8)" icon={IconTarget}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={intentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <defs>
                    <linearGradient id="intentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ 
                      fontSize: 10, 
                      fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                      fontWeight: 500
                    }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <YAxis 
                    tick={{ 
                      fontSize: 12, 
                      fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                      fontWeight: 500
                    }} 
                    axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} 
                  />
                  <Tooltip 
                    formatter={(value, name, props) => [value.toLocaleString(), 'Queries']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullName;
                      }
                      return label;
                    }}
                    contentStyle={{ 
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      border: 'none',
                      borderRadius: '12px',
                      color: isDark ? '#ffffff' : '#000000',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)'
                    }}
                  />
                  <Bar dataKey="queries" fill="url(#intentGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ✅ CHARTS ROW 2 - FIXED TEXT VISIBILITY */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Enhanced 24h Activity */}
            <ChartCard title="24-Hour Activity Pattern" icon={IconActivity}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={hourlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="messagesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ 
                      fontSize: 11, 
                      fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                      fontWeight: 500
                    }}
                    interval={2}
                    axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <YAxis 
                    tick={{ 
                      fontSize: 12, 
                      fill: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                      fontWeight: 500
                    }} 
                    axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} 
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      value.toLocaleString(), 
                      name === 'messages' ? 'Messages' : 'Active Users'
                    ]}
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
                    dataKey="messages" 
                    stroke="#8B5CF6" 
                    fill="url(#messagesGradient)"
                    strokeWidth={2}
                    name="messages"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke="#F59E0B" 
                    fill="url(#usersGradient)"
                    strokeWidth={2}
                    name="users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Enhanced Message Types */}
            <ChartCard title="Message Types Distribution" icon={IconMessageCircle}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={messageTypeData.length > 0 ? messageTypeData : [
                      { name: 'Text Messages', value: 450 },
                      { name: 'Image Uploads', value: 120 },
                      { name: 'Document Queries', value: 89 },
                      { name: 'Voice Messages', value: 34 }
                    ]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    labelStyle={{ 
                      fontSize: '11px', 
                      fontWeight: '600',
                      fill: isDark ? '#ffffff' : '#000000'
                    }}
                  >
                    {(messageTypeData.length > 0 ? messageTypeData : [
                      { name: 'Text Messages', value: 450 },
                      { name: 'Image Uploads', value: 120 },
                      { name: 'Document Queries', value: 89 },
                      { name: 'Voice Messages', value: 34 }
                    ]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value.toLocaleString(), 'Messages']}
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
            </ChartCard>
          </div>

          {/* ✅ USER ROLES & PERFORMANCE METRICS - SEAMLESS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            
            {/* User Roles */}
            <ChartCard title="User Roles Distribution" icon={IconUsers}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={userRoleData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelStyle={{ 
                      fontSize: '11px', 
                      fontWeight: 'medium',
                      fill: isDark ? '#ffffff' : '#000000'
                    }}
                  >
                    {userRoleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value.toLocaleString(), 'Users']}
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
            </ChartCard>

            {/* Performance Metrics */}
            <div className="lg:col-span-2">
              <ChartCard title="Performance Overview" icon={IconCpu}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-xl transition-all hover:scale-105"
                       style={{ 
                         backgroundColor: 'rgba(16, 185, 129, 0.1)',
                         border: `1px solid rgba(16, 185, 129, 0.2)`
                       }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <IconClock size={16} style={{ color: '#10b981' }} />
                      <span className="text-xs font-medium text-emerald-500">
                        Avg Session
                      </span>
                    </div>
                    <p className="text-xl font-bold"
                       style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {Math.round(sessionStats?.avgDuration || 0)}min
                    </p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl transition-all hover:scale-105"
                       style={{ 
                         backgroundColor: 'rgba(59, 130, 246, 0.1)',
                         border: `1px solid rgba(59, 130, 246, 0.2)`
                       }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <IconActivity size={16} style={{ color: '#3b82f6' }} />
                      <span className="text-xs font-medium text-blue-500">
                        Min Response
                      </span>
                    </div>
                    <p className="text-xl font-bold"
                       style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {Math.round(responseTimeStats?.minResponseTime || 0)}ms
                    </p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl transition-all hover:scale-105"
                       style={{ 
                         backgroundColor: 'rgba(139, 92, 246, 0.1)',
                         border: `1px solid rgba(139, 92, 246, 0.2)`
                       }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <IconCpu size={16} style={{ color: '#8b5cf6' }} />
                      <span className="text-xs font-medium text-purple-500">
                        Max Response
                      </span>
                    </div>
                    <p className="text-xl font-bold"
                       style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {Math.round(responseTimeStats?.maxResponseTime || 0)}ms
                    </p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl transition-all hover:scale-105"
                       style={{ 
                         backgroundColor: 'rgba(245, 158, 11, 0.1)',
                         border: `1px solid rgba(245, 158, 11, 0.2)`
                       }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <IconDatabase size={16} style={{ color: '#f59e0b' }} />
                      <span className="text-xs font-medium text-amber-500">
                        Total Requests
                      </span>
                    </div>
                    <p className="text-xl font-bold"
                       style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {(responseTimeStats?.totalRequests || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* ✅ DETAILED TABLES - FIXED TEXT VISIBILITY */}
          <div className="space-y-6 sm:space-y-8">
            
            {/* Enhanced Intent Analysis Table */}
            <ChartCard title="Detailed Intent Analysis" icon={IconTarget}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-opacity-20"
                        style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                      <th className="text-left py-3 px-4 font-semibold text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                        Intent Type
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                        Total Queries
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                        Accuracy
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                        Avg Response
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                        24h Activity
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                        7d Activity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {intentChartData.map((intent, index) => (
                      <tr key={index} 
                          className="border-b border-opacity-10 hover:bg-opacity-50 transition-all duration-200"
                          style={{ 
                            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="font-medium"
                                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}
                                  title={intent.fullName}>
                              {intent.fullName}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-medium"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                          {intent.queries?.toLocaleString()}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={`px-2 py-1 rounded-lg text-sm font-medium ${
                            intent.accuracy >= 80 
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : intent.accuracy >= 60 
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}>
                            {intent.accuracy?.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right py-3 px-4 font-medium"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                          {intent.avgTime?.toFixed(0)}ms
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="font-semibold text-emerald-500">
                            {intent.recent24h || 0}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="font-semibold text-blue-500">
                            {intent.recent7d || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            {/* User Activity by Role Table */}
            {userActivityByRole && userActivityByRole.length > 0 && (
              <ChartCard title="User Activity by Role" icon={IconUsers}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-opacity-20"
                          style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                        <th className="text-left py-3 px-4 font-semibold text-sm"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                          Role
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-sm"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                          Total Users
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-sm"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                          Avg Sessions
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-sm"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                          Avg Messages
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-sm"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                          System Days
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {userActivityByRole.map((roleData, index) => (
                        <tr key={index} 
                            className="border-b border-opacity-10 hover:bg-opacity-50 transition-all duration-200"
                            style={{ 
                              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}>
                          <td className="py-3 px-4">
                            <span className="font-medium capitalize"
                                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                              {roleData._id || 'Unknown'}
                            </span>
                          </td>
                          <td className="text-right py-3 px-4 font-medium"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                            {roleData.totalUsers}
                          </td>
                          <td className="text-right py-3 px-4"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                            {roleData.avgSessions?.toFixed(1) || '0'}
                          </td>
                          <td className="text-right py-3 px-4"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                            {roleData.avgMessages?.toFixed(1) || '0'}
                          </td>
                          <td className="text-right py-3 px-4"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                            {roleData.avgTimeOnSystem?.toFixed(0) || '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
