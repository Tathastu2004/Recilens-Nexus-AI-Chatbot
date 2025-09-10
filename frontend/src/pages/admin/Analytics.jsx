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
  IconClock, IconActivity, IconAlertCircle, IconLoader,
  IconCalendar, IconUserPlus, IconTrendingDown, IconEye,
  IconTarget, IconCpu, IconDatabase
} from "@tabler/icons-react";

const COLORS = {
  primary: "#10B981",
  secondary: "#3B82F6", 
  accent: "#8B5CF6",
  warning: "#F59E0B",
  danger: "#EF4444",
  success: "#059669",
  info: "#0EA5E9",
  gradient: {
    primary: "from-emerald-500 to-green-600",
    secondary: "from-blue-500 to-indigo-600",
    accent: "from-purple-500 to-violet-600",
    warning: "from-amber-500 to-orange-600"
  }
};

const INTENT_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#F97316"];

export default function Analytics() {
  const { getToken } = useAuth();
  const { getRealTimeAnalytics, startAnalyticsStream, getAnalytics } = useAdmin();
  
  // State management
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [streamData, setStreamData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
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
    })();

    return () => {
      isMounted = false;
      if (typeof cleanupFn === "function") {
        cleanupFn();
      }
    };
  }, [fetchAnalytics, startAnalyticsStream]);

  // ✅ Enhanced stat card component with modern design
  const StatCard = ({ title, value, change, icon: Icon, color = "primary", subtitle, trend, gradient }) => (
    <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient || COLORS.gradient.primary} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient || COLORS.gradient.primary} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {(change !== undefined || trend) && (
            <div className="flex flex-col items-end gap-1">
              {change !== undefined && (
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  change >= 0 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {change >= 0 ? <IconTrendingUp className="w-3 h-3" /> : <IconTrendingDown className="w-3 h-3" />}
                  {Math.abs(change).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );

  // ✅ Modern chart container
  const ChartCard = ({ title, children, actions, icon: Icon }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && <Icon className="w-5 h-5 text-gray-600" />}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );

  // ✅ Loading state with modern design
  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-emerald-600 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Analytics</h3>
              <p className="text-gray-600">Fetching real-time data from the server...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Error state with modern design
  if (error && !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
              <IconAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-red-600 mb-6">{error}</p>
              <button 
                onClick={fetchAnalytics}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
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

  // ✅ Clean intent names and prepare chart data
  const intentChartData = intentAnalytics?.map(item => {
    let cleanIntentName = item.intent || 'Unknown';
    
    // Clean up intent names
    cleanIntentName = cleanIntentName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/Chat$/i, '')
      .replace(/Support$/i, 'Help')
      .replace(/Analysis$/i, 'Processing')
      .trim();

    return {
      name: cleanIntentName,
      queries: item.totalQueries,
      accuracy: item.accuracy,
      avgTime: item.avgResponseTime,
      recent24h: item.recent24h,
      recent7d: item.recent7d
    };
  }) || [];

  const hourlyChartData = Array.from({ length: 24 }, (_, hour) => {
    const found = hourlyDistribution?.find(h => h.hour === hour);
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      messages: found?.messageCount || 0,
      avgTime: found?.avgResponseTime || 0,
      users: found?.uniqueUsers || 0
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        {/* ✅ Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
                Analytics Dashboard
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm">
                  <IconClock className="w-4 h-4" />
                  <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                </div>
                {streamData && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Live</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm bg-white px-4 py-2 rounded-lg shadow-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Auto-refresh
              </label>
              
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-lg"
              >
                <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Enhanced Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={summary?.totalUsers || 0}
            icon={IconUsers}
            gradient={COLORS.gradient.primary}
            subtitle={`${summary?.newUsers24h || 0} new today`}
            change={summary?.growthRates?.users}
          />
          <StatCard
            title="Total Messages"
            value={summary?.totalMessages || 0}
            icon={IconMessageCircle}
            gradient={COLORS.gradient.secondary}
            subtitle={`${summary?.messages24h || 0} in last 24h`}
            change={summary?.growthRates?.messages}
          />
          <StatCard
            title="Response Time"
            value={`${Math.round(summary?.avgResponseTime || 0)}ms`}
            icon={IconClock}
            gradient={COLORS.gradient.accent}
            subtitle="Average response"
          />
          <StatCard
            title="Active Sessions"
            value={summary?.activeSessions || 0}
            icon={IconActivity}
            gradient={COLORS.gradient.warning}
            subtitle={`${summary?.totalSessions || 0} total sessions`}
            change={summary?.growthRates?.sessions}
          />
        </div>

        {/* ✅ Charts Grid - Row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* User Registrations */}
          <ChartCard title="User Registrations (Last 14 Days)" icon={IconUserPlus}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={registrationChartData}>
                <defs>
                  <linearGradient id="registrationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip 
                  formatter={(value) => [value, 'New Users']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `${payload[0].payload.fullDate} (${payload[0].payload.dayOfWeek})`;
                    }
                    return label;
                  }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
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
                  dot={{ r: 5, fill: '#10B981' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Intent Analytics */}
          <ChartCard title="Intent Distribution" icon={IconTarget}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={intentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <defs>
                  <linearGradient id="intentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip 
                  formatter={(value) => [value.toLocaleString(), 'Queries']}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="queries" fill="url(#intentGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ✅ Charts Grid - Row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Hourly Activity */}
          <ChartCard title="24-Hour Activity Pattern" icon={IconActivity}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={hourlyChartData}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={2}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip 
                  formatter={(value, name) => [
                    value.toLocaleString(), 
                    name === 'messages' ? 'Messages' : 'Active Users'
                  ]}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="#8B5CF6" 
                  fill="url(#messagesGradient)"
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#F59E0B" 
                  fill="url(#usersGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Message Types */}
          <ChartCard title="Message Types" icon={IconMessageCircle}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={messageTypeData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelStyle={{ fontSize: '13px', fontWeight: 'medium' }}
                >
                  {messageTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INTENT_COLORS[index % INTENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [value.toLocaleString(), 'Messages']}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ✅ Performance Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* User Roles */}
          <ChartCard title="User Roles" icon={IconUsers}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={userRoleData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelStyle={{ fontSize: '12px', fontWeight: 'medium' }}
                >
                  {userRoleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INTENT_COLORS[index % INTENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [value.toLocaleString(), 'Users']}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Performance Metrics */}
          <div className="lg:col-span-2">
            <ChartCard title="Performance Overview" icon={IconCpu}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-3 mb-3">
                    <IconClock className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Avg Session</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">
                    {Math.round(sessionStats?.avgDuration || 0)}min
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <IconActivity className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Min Response</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {Math.round(responseTimeStats?.minResponseTime || 0)}ms
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3 mb-3">
                    <IconCpu className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Max Response</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {Math.round(responseTimeStats?.maxResponseTime || 0)}ms
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
                  <div className="flex items-center gap-3 mb-3">
                    <IconDatabase className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-700">Total Requests</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">
                    {(responseTimeStats?.totalRequests || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </ChartCard>
          </div>
        </div>

        {/* ✅ Detailed Tables */}
        <div className="space-y-8">
          {/* Intent Analysis Table */}
          <ChartCard title="Detailed Intent Analysis" icon={IconTarget}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-4 px-4 font-semibold text-gray-900">Intent Type</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-900">Total Queries</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-900">Accuracy</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-900">Avg Response</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-900">24h Activity</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-900">7d Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {intentChartData.map((intent, index) => (
                    <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full shadow-sm"
                            style={{ backgroundColor: INTENT_COLORS[index % INTENT_COLORS.length] }}
                          />
                          <span className="font-medium text-gray-900">
                            {intent.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-4 px-4 font-medium text-gray-900">
                        {intent.queries?.toLocaleString()}
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          intent.accuracy >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          intent.accuracy >= 60 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {intent.accuracy?.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right py-4 px-4 text-gray-900 font-medium">
                        {intent.avgTime?.toFixed(0)}ms
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="text-emerald-600 font-semibold">
                          {intent.recent24h || 0}
                        </span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="text-blue-600 font-semibold">
                          {intent.recent7d || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* User Activity Table */}
          {userActivityByRole && userActivityByRole.length > 0 && (
            <ChartCard title="User Activity by Role" icon={IconUsers}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-4 px-4 font-semibold text-gray-900">Role</th>
                      <th className="text-right py-4 px-4 font-semibold text-gray-900">Total Users</th>
                      <th className="text-right py-4 px-4 font-semibold text-gray-900">Avg Sessions</th>
                      <th className="text-right py-4 px-4 font-semibold text-gray-900">Avg Messages</th>
                      <th className="text-right py-4 px-4 font-semibold text-gray-900">System Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivityByRole.map((roleData, index) => (
                      <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <span className="font-medium text-gray-900 capitalize">
                            {roleData._id || 'Unknown'}
                          </span>
                        </td>
                        <td className="text-right py-4 px-4 font-medium text-gray-900">
                          {roleData.totalUsers}
                        </td>
                        <td className="text-right py-4 px-4 text-gray-700">
                          {roleData.avgSessions?.toFixed(1) || '0'}
                        </td>
                        <td className="text-right py-4 px-4 text-gray-700">
                          {roleData.avgMessages?.toFixed(1) || '0'}
                        </td>
                        <td className="text-right py-4 px-4 text-gray-700">
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
  );
}
