import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  IconTarget, IconCpu, IconDatabase, IconMenu2
} from "@tabler/icons-react";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";

export default function Analytics() {
  // ✅ ALL HOOKS MUST BE DECLARED FIRST - NO CONDITIONAL EXECUTION
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

  const refreshIntervalRef = useRef(null);
  const streamCleanupRef = useRef(null);

  // ✅ SAFE DATA DESTRUCTURING - Always runs, never conditional
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

  // ✅ ALL useMemo and useCallback hooks - Always executed
  const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'];
  
  const registrationChartData = useMemo(() => {
    if (!dailyRegistrations || dailyRegistrations.length === 0) return [];
    return dailyRegistrations.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: new Date(item.date).toLocaleDateString(),
      dayOfWeek: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
      registrations: item.count || 0
    }));
  }, [dailyRegistrations]);

  const hourlyChartData = useMemo(() => {
    if (!hourlyDistribution || hourlyDistribution.length === 0) return [];
    return hourlyDistribution.map(item => ({
      hour: item.hour.toString().padStart(2, '0'),
      userActivity: item.userCount || 0,
      messageActivity: item.messageCount || 0
    }));
  }, [hourlyDistribution]);

  const userActivityChartData = useMemo(() => {
    if (!userActivityByRole || userActivityByRole.length === 0) return [];
    return userActivityByRole.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      adminActivity: item.adminActivity || 0,
      userActivity: item.userActivity || 0
    }));
  }, [userActivityByRole]);

  const intentChartData = useMemo(() => {
    console.log('🔄 Processing intent chart data...');
    console.log('📊 Raw intentAnalytics:', intentAnalytics);
    
    if (!intentAnalytics || intentAnalytics.length === 0) {
      console.log('⚠️ No intent analytics data to process');
      return [];
    }
    
    const processed = intentAnalytics.slice(0, 8).map((item, index) => {
      let cleanIntentName = item.intent || 'Unknown';
      
      console.log(`🎯 Processing intent ${index + 1}: "${cleanIntentName}"`);
      
      // Clean the intent field - extract from "the intent is: general" format
      if (typeof cleanIntentName === 'string') {
        const original = cleanIntentName;
        cleanIntentName = cleanIntentName
          .replace(/^the intent is:\s*/i, '')
          .trim();
        
        if (original !== cleanIntentName) {
          console.log(`🧹 Cleaned intent: "${original}" → "${cleanIntentName}"`);
        }
      }
      
      // Better intent name mapping
      const intentMap = {
        'general': 'General Chat',
        'document_analysis': 'Document Analysis', 
        'technical_support': 'Tech Support',
        'code_help': 'Code Help',
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
      
      const displayName = intentMap[cleanIntentName.toLowerCase()] || 
                         cleanIntentName
                           .replace(/_/g, ' ')
                           .replace(/\b\w/g, l => l.toUpperCase())
                           .replace(/Chat$/i, '')
                           .replace(/Support$/i, 'Help')
                           .trim();

      const result = {
        name: displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName,
        fullName: displayName,
        queries: item.totalQueries || 0,
        accuracy: item.accuracy || 0,
        avgTime: item.avgResponseTime || 0,
        recent24h: item.recent24h || 0,
        recent7d: item.recent7d || 0
      };
      
      console.log(`✅ Processed intent: ${result.fullName} (${result.queries} queries)`);
      return result;
    });
    
    console.log(`🎯 Final processed intent data: ${processed.length} items`);
    return processed;
  }, [intentAnalytics]);

  // Fetch real-time analytics data
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

  // Setup auto-refresh and real-time stream
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

  // Debug logging
  useEffect(() => {
    console.log('📊 Analytics Data State Updated:', {
      analyticsData: analyticsData,
      intentAnalytics: intentAnalytics,
      intentAnalyticsLength: intentAnalytics?.length || 0,
      messageTypes: messageTypes,
      userDistribution: userDistribution,
      hourlyDistribution: hourlyDistribution
    });
    
    if (intentAnalytics?.length > 0) {
      console.log('🎯 Intent Analytics Details:');
      intentAnalytics.forEach((intent, index) => {
        console.log(`  ${index + 1}. Intent: "${intent.intent}", Queries: ${intent.totalQueries}, Accuracy: ${intent.accuracy}%`);
      });
    } else {
      console.log('⚠️ No intent analytics available in state');
    }
  }, [analyticsData, intentAnalytics, messageTypes, userDistribution, hourlyDistribution]);

  // ✅ COMPONENT DEFINITIONS - Not hooks, safe to define anywhere
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

  const renderIntentDistributionChart = () => {
    console.log('🎨 Rendering Intent Distribution Chart');
    console.log('📊 Intent Chart Data:', intentChartData);
    console.log('📊 Data Length:', intentChartData?.length || 0);
    
    if (intentChartData && intentChartData.length > 0) {
      return (
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
      );
    } else {
      console.log('🎨 Rendering Empty State for Intent Chart');
      return (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <IconTarget size={48} className="mx-auto mb-4 opacity-30" 
                       style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
            <p className="text-lg font-medium mb-2"
               style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
              No Intent Data Available
            </p>
            <p className="text-sm"
               style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
              Start chatting to see intent analytics
            </p>
          </div>
        </div>
      );
    }
  };

  const renderIntentAnalysisTable = () => {
    console.log('📋 Rendering Intent Analysis Table');
    console.log('📊 Intent Chart Data for Table:', intentChartData);
    
    if (intentChartData && intentChartData.length > 0) {
      return (
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
      );
    } else {
      console.log('📋 Rendering Empty State for Intent Table');
      return (
        <div className="py-12 text-center">
          <IconTarget size={48} className="mx-auto mb-4 opacity-30" 
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
          <p className="text-lg font-medium mb-2"
             style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
            No Intent Analysis Data
          </p>
          <p className="text-sm"
             style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
            Detailed intent analytics will appear here once users start chatting
          </p>
        </div>
      );
    }
  };

  // ✅ EARLY RETURNS ONLY AFTER ALL HOOKS ARE DECLARED
  // Loading state
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

  // Error state
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

  return (
    <div className="lg:flex min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* Header */}
        <div className="z-10 backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 250, 250, 0.8)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Left Section */}
              <div className="flex items-center gap-4">
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

          {/* Key Metrics */}
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

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
            
            {/* User Registrations */}
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

            {/* Intent Distribution Chart */}
            <ChartCard title="Intent Distribution (Top 8)" icon={IconTarget}>
              {renderIntentDistributionChart()}
            </ChartCard>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
            
            {/* 24h Activity */}
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
                    formatter={(value) => [value, 'Activity']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return `${payload[0].payload.hour}:00`;
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
                    dataKey="userActivity" 
                    stroke="#8B5CF6" 
                    fill="url(#messagesGradient)"
                    strokeWidth={3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="messageActivity" 
                    stroke="#F59E0B" 
                    fill="url(#usersGradient)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* User Activity by Role */}
            <ChartCard title="User Activity by Role (Last 7 Days)" icon={IconUsers}>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={userActivityChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="adminGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
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
                    formatter={(value) => [value, 'Activity']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return `${payload[0].payload.date}`;
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
                  <Bar dataKey="adminActivity" fill="url(#adminGradient)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="userActivity" fill="url(#userGradient)" radius={[6, 6, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Detailed Intent Analysis */}
          <div className="grid grid-cols-1 gap-6 sm:gap-8">
            <ChartCard title="Detailed Intent Analysis" icon={IconTarget}>
              {renderIntentAnalysisTable()}
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}
