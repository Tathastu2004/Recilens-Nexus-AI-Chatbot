import { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminContext";
import Table from "../../components/admin/Table";
import ChartCard from "../../components/admin/ChartCard";
import StatCard from "../../components/admin/StatsCard";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#2F855A", "#68D391", "#81E6D9", "#38B2AC", "#E53E3E", "#DD6B20", "#805AD5"];

export default function Analytics() {
  const { getAnalytics, generateRealAnalytics, loading, error } = useAdmin();
  const [analytics, setAnalytics] = useState([]);
  const [generating, setGenerating] = useState(false);

  const fetchAnalytics = () => {
    const token = localStorage.getItem("token");
    getAnalytics(token).then(setAnalytics);
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleGenerateRealAnalytics = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem("token");
      await generateRealAnalytics(token);
      fetchAnalytics();
    } catch (e) {
      alert("Failed to generate analytics: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ✅ FIX 1: Compute weighted average accuracy
  const totalQueriesSum = analytics.reduce((acc, cur) => acc + cur.totalQueries, 0);
  const avgAccuracy = (analytics.length > 0 && totalQueriesSum > 0)
    ? analytics.reduce((acc, cur) => acc + (cur.accuracy * cur.totalQueries), 0) / totalQueriesSum
    : 0;

  // ✅ FIX 2: Use generatedAt dates for line chart instead of intent
  const lineData = analytics
    .filter(item => item.generatedAt)
    .map(({ generatedAt, accuracy, totalQueries }, index) => ({
      date: new Date(generatedAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      accuracy,
      totalQueries,
      index // Add index for better sorting
    }))
    .sort((a, b) => a.index - b.index); // Sort chronologically

  // ✅ FIX 3: Aggregate pie data to show unique intents
  const pieData = Object.values(
    analytics.reduce((acc, { intent, totalQueries }) => {
      // Clean up intent names - remove "the intent is:" prefix if it exists
      const cleanIntent = intent.replace(/^the intent is:\s*/i, '').trim() || 'Unknown';
      
      if (!acc[cleanIntent]) {
        acc[cleanIntent] = { name: cleanIntent, value: 0 };
      }
      acc[cleanIntent].value += totalQueries;
      return acc;
    }, {})
  ).filter(item => item.value > 0); // Remove zero-value items

  // ✅ FIX 4: Better table formatting
  const headers = [
    "Intent", "Total Queries", "Accuracy (%)", "Avg Response Time (ms)", "Generated At"
  ];
  
  const rows = analytics.map(({ intent, totalQueries, accuracy, avgResponseTime, generatedAt }) => [
    intent.replace(/^the intent is:\s*/i, '').trim() || 'Unknown', // Clean intent name
    totalQueries, 
    accuracy.toFixed(2), 
    avgResponseTime?.toFixed(2) || '0.00', 
    generatedAt ? new Date(generatedAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A'
  ]);

  return (
    <div className="p-8 bg-green-50 min-h-screen">
      <h2 className="text-green-900 font-bold text-2xl mb-6 flex justify-between items-center">
        Analytics Overview
        <div className="flex gap-4">
          <button
            onClick={fetchAnalytics}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50"
            disabled={loading || generating}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            onClick={handleGenerateRealAnalytics}
            className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 disabled:opacity-50"
            disabled={loading || generating}
          >
            {generating ? "Generating..." : "Generate Real Analytics"}
          </button>
        </div>
      </h2>

      {(loading || generating) && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
          <span className="ml-3 text-green-700">
            {generating ? "Generating analytics..." : "Loading..."}
          </span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !generating && analytics.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-600 text-lg">No analytics data available.</p>
          <p className="text-gray-500 text-sm mt-2">Click "Generate Real Analytics" to create some data.</p>
        </div>
      )}

      {analytics.length > 0 && (
        <>
          {/* ✅ FIXED STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <StatCard 
              title="Total Queries" 
              value={totalQueriesSum.toLocaleString()} 
            />
            <StatCard 
              title="Average Accuracy" 
              value={`${avgAccuracy.toFixed(2)}%`} 
            />
            <StatCard 
              title="Reports Count" 
              value={analytics.length.toLocaleString()} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* ✅ FIXED LINE CHART */}
            <ChartCard title="Accuracy & Queries Over Time">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis yAxisId="left" domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => `Time: ${value}`}
                    formatter={(value, name) => [
                      name === 'Accuracy (%)' ? `${value}%` : value,
                      name
                    ]}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#2F855A" 
                    name="Accuracy (%)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="totalQueries" 
                    stroke="#3182CE" 
                    name="Total Queries"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ✅ FIXED PIE CHART */}
            <ChartCard title="Queries by Intent">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie 
                    data={pieData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80}
                    label={({ name, value, percent }) => 
                      `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} queries`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ✅ IMPROVED TABLE */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold text-lg mb-4">Analytics Reports</h3>
            <div className="overflow-x-auto">
              <Table headers={headers} rows={rows} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
