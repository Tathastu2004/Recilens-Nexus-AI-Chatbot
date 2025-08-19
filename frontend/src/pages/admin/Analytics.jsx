import { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminContext";
import Table from "../../components/admin/Table";
import ChartCard from "../../components/admin/ChartCard";
import StatCard from "../../components/admin/StatsCard";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#2F855A", "#68D391", "#81E6D9", "#38B2AC"];

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

  // Compute summary stats
  const totalQueriesSum = analytics.reduce((acc, cur) => acc + cur.totalQueries, 0);
  const avgAccuracy = analytics.length > 0
    ? analytics.reduce((acc, cur) => acc + cur.accuracy, 0) / analytics.length
    : 0;

  // Prepare line chart data (reverse for chronological)
  const lineData = analytics
    .map(({ intent, accuracy, totalQueries }) => ({
      date: intent,  // Or use generatedAt date if available
      accuracy,
      totalQueries
    }))
    .reverse();

  // Pie chart by intent
  const pieData = analytics.map(({ intent, totalQueries }) => ({
    name: intent,
    value: totalQueries,
  }));

  const headers = [
    "Intent", "Total Queries", "Accuracy (%)", "Avg Response Time (ms)", "Generated At"
  ];
  const rows = analytics.map(({ intent, totalQueries, accuracy, avgResponseTime, generatedAt }) => [
    intent, totalQueries, accuracy.toFixed(2), avgResponseTime.toFixed(2), generatedAt ? new Date(generatedAt).toLocaleString() : ''
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
            Refresh
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

      {(loading || generating) && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && analytics.length === 0 && <p>No analytics data available.</p>}

      {analytics.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <StatCard title="Total Queries" value={totalQueriesSum} />
            <StatCard title="Average Accuracy" value={`${avgAccuracy.toFixed(2)}%`} />
            <StatCard title="Reports Count" value={analytics.length} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <ChartCard title="Accuracy & Queries Over Intents">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData}>
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend verticalAlign="top" />
                  <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="#2F855A" name="Accuracy (%)" />
                  <Line yAxisId="right" type="monotone" dataKey="totalQueries" stroke="#3182CE" name="Total Queries" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Queries by Intent">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-4">Analytics Reports</h3>
            <Table headers={headers} rows={rows} />
          </div>
        </>
      )}
    </div>
  );
}
