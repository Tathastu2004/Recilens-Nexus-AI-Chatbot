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
  IconCalendar, IconUserPlus, IconTrendingDown
} from "@tabler/icons-react";

const COLORS = {
  primary: "#10B981",
  secondary: "#3B82F6", 
  accent: "#8B5CF6",
  warning: "#F59E0B",
  danger: "#EF4444",
  success: "#059669",
  info: "#0EA5E9"
};

const INTENT_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#F97316"];

export default function Analytics() {
  const { getToken } = useAuth();
  const { getRealTimeAnalytics, startAnalyticsStream } = useAdmin();
  
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
      
      const token = await getToken();
      const data = await getRealTimeAnalytics(token);
      
      setAnalyticsData(data);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, getRealTimeAnalytics]);

  // ✅ Setup auto-refresh and real-time stream
  useEffect(() => {
    fetchAnalytics();

    if (autoRefresh) {
      // Refresh every 2 minutes
      refreshIntervalRef.current = setInterval(fetchAnalytics, 120000);
      
      // Setup real-time stream for live updates
      const setupStream = async () => {
        try {
          const token = await getToken();
          streamCleanupRef.current = startAnalyticsStream(token, (data) => {
            setStreamData(data);
          });
        } catch (error) {
          console.error('Stream setup error:', error);
        }
      };
      
      setupStream();
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
      }
    };
  }, [autoRefresh, fetchAnalytics, getToken, startAnalyticsStream]);

  // ✅ Enhanced stat card component with growth indicators
  const StatCard = ({ title, value, change, icon: Icon, color = "primary", subtitle, trend }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 lg:w-5 lg:h-5 text-${color === 'primary' ? 'green' : color}-600`} />
            <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">{title}</p>
          </div>
          <p className="text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 mb-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
        {(change !== undefined || trend) && (
          <div className="flex flex-col items-end gap-1">
            {change !== undefined && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                change >= 0 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {change >= 0 ? <IconTrendingUp className="w-3 h-3" /> : <IconTrendingDown className="w-3 h-3" />}
                {Math.abs(change).toFixed(1)}%
              </div>
            )}
            {trend && (
              <span className="text-xs text-gray-400">{trend}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ✅ Chart container with responsive design
  const ChartCard = ({ title, children, actions }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
      <div className="p-4 lg:p-6">
        <div className="w-full overflow-x-auto">
          {children}
        </div>
      </div>
    </div>
  );

  // ✅ Loading state
  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <IconLoader className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Error state
  if (error && !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <IconAlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Retry
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

  // ✅ Prepare chart data
  const intentChartData = intentAnalytics?.map(item => ({
    name: item.intent?.charAt(0).toUpperCase() + item.intent?.slice(1) || 'Unknown',
    queries: item.totalQueries,
    accuracy: item.accuracy,
    avgTime: item.avgResponseTime,
    recent24h: item.recent24h,
    recent7d: item.recent7d
  })) || [];

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

  // ✅ NEW: Daily registration chart data
  const registrationChartData = dailyRegistrations?.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    registrations: day.registrations,
    dayOfWeek: day.dayOfWeek,
    fullDate: day.date
  })) || [];

  // ✅ NEW: Message type chart data
  const messageTypeData = messageTypes?.map(type => ({
    name: type._id || 'text',
    value: type.count,
    recent24h: type.recent24h || 0
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        {/* ✅ Header Section */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                Comprehensive Analytics Dashboard
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <IconActivity className="w-4 h-4" />
                  <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                </div>
                {streamData && (
                  <span className="flex items-center gap-1 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Live Data
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Auto-refresh
              </label>
              
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all duration-200"
              >
                <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Enhanced Stats Grid with Growth Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <StatCard
            title="Total Users"
            value={summary?.totalUsers || 0}
            icon={IconUsers}
            color="primary"
            subtitle={`${summary?.newUsers24h || 0} new today`}
            change={summary?.growthRates?.users}
            trend="Daily growth"
          />
          <StatCard
            title="Total Messages"
            value={summary?.totalMessages || 0}
            icon={IconMessageCircle}
            color="secondary"
            subtitle={`${summary?.messages24h || 0} in last 24h`}
            change={summary?.growthRates?.messages}
            trend="Message growth"
          />
          <StatCard
            title="Avg Response Time"
            value={`${Math.round(summary?.avgResponseTime || 0)}ms`}
            icon={IconClock}
            color="accent"
            subtitle="Last 7 days"
          />
          <StatCard
            title="Active Sessions"
            value={summary?.activeSessions || 0}
            icon={IconActivity}
            color="warning"
            subtitle={`${summary?.totalSessions || 0} total`}
            change={summary?.growthRates?.sessions}
            trend="Session activity"
          />
        </div>

        {/* ✅ NEW: Day-wise User Registration Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
          <ChartCard title="Daily User Registrations (Last 30 Days)">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={registrationChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [value, name === 'registrations' ? 'New Users' : name]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `${payload[0].payload.fullDate} (${payload[0].payload.dayOfWeek})`;
                    }
                    return label;
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Bar dataKey="registrations" fill={COLORS.primary} name="registrations" radius={[4, 4, 0, 0]} />
                <Line 
                  type="monotone" 
                  dataKey="registrations" 
                  stroke={COLORS.secondary} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Intent Analytics */}
          <ChartCard title="Intent Analytics">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={intentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name === 'queries' ? 'Queries' : name === 'accuracy' ? 'Accuracy %' : 'Avg Time (ms)'
                  ]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Bar dataKey="queries" fill={COLORS.primary} name="queries" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ✅ Hourly Distribution and Message Types */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
          {/* Hourly Distribution */}
          <ChartCard title="24-Hour Activity Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 12 }}
                  interval={2}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [
                    value.toLocaleString(), 
                    name === 'messages' ? 'Messages' : name === 'users' ? 'Active Users' : 'Avg Response Time (ms)'
                  ]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="messages" 
                  stroke={COLORS.secondary} 
                  fill={COLORS.secondary}
                  fillOpacity={0.3}
                  name="messages"
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke={COLORS.accent} 
                  fill={COLORS.accent}
                  fillOpacity={0.2}
                  name="users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Message Types Distribution */}
          <ChartCard title="Message Types Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={messageTypeData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelStyle={{ fontSize: '12px' }}
                >
                  {messageTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INTENT_COLORS[index % INTENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [value.toLocaleString(), 'Count']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ✅ User Activity by Role */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-6 lg:mb-8">
          {/* User Role Distribution */}
          <ChartCard title="User Distribution by Role">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={userRoleData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelStyle={{ fontSize: '12px' }}
                >
                  {userRoleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INTENT_COLORS[index % INTENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Session Statistics */}
          <div className="lg:col-span-2">
            <ChartCard title="Session & Performance Metrics">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Avg Session</p>
                  <p className="text-2xl font-bold text-green-800">
                    {Math.round(sessionStats?.avgDuration || 0)}m
                  </p>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Min Response</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {Math.round(responseTimeStats?.minResponseTime || 0)}ms
                  </p>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Max Response</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {Math.round(responseTimeStats?.maxResponseTime || 0)}ms
                  </p>
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                  <p className="text-sm text-orange-600 font-medium">Total Requests</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {(responseTimeStats?.totalRequests || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </ChartCard>
          </div>
        </div>

        {/* ✅ Enhanced Detailed Intent Table */}
        <ChartCard title="Detailed Intent Analysis">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold">Intent</th>
                  <th className="text-right py-3 px-4 font-semibold">Total Queries</th>
                  <th className="text-right py-3 px-4 font-semibold">Accuracy</th>
                  <th className="text-right py-3 px-4 font-semibold">Avg Time</th>
                  <th className="text-right py-3 px-4 font-semibold">24h Activity</th>
                  <th className="text-right py-3 px-4 font-semibold">7d Activity</th>
                </tr>
              </thead>
              <tbody>
                {intentAnalytics?.map((intent, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: INTENT_COLORS[index % INTENT_COLORS.length] }}
                        />
                        <span className="font-medium capitalize">
                          {intent.intent || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">{intent.totalQueries?.toLocaleString()}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        intent.accuracy >= 80 ? 'bg-green-100 text-green-800' :
                        intent.accuracy >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {intent.accuracy?.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">{intent.avgResponseTime?.toFixed(0)}ms</td>
                    <td className="text-right py-3 px-4">
                      <span className="text-green-600 font-medium">
                        {intent.recent24h || 0}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="text-blue-600 font-medium">
                        {intent.recent7d || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* ✅ User Activity by Role Table */}
        {userActivityByRole && userActivityByRole.length > 0 && (
          <ChartCard title="User Activity Breakdown by Role">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold">Role</th>
                    <th className="text-right py-3 px-4 font-semibold">Total Users</th>
                    <th className="text-right py-3 px-4 font-semibold">Avg Sessions</th>
                    <th className="text-right py-3 px-4 font-semibold">Avg Messages</th>
                    <th className="text-right py-3 px-4 font-semibold">Avg Days on System</th>
                  </tr>
                </thead>
                <tbody>
                  {userActivityByRole.map((roleData, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium capitalize">
                          {roleData._id || 'Unknown'}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4">{roleData.totalUsers}</td>
                      <td className="text-right py-3 px-4">{roleData.avgSessions?.toFixed(1) || '0'}</td>
                      <td className="text-right py-3 px-4">{roleData.avgMessages?.toFixed(1) || '0'}</td>
                      <td className="text-right py-3 px-4">{roleData.avgTimeOnSystem?.toFixed(0) || '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
