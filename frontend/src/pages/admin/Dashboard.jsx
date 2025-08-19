import { useEffect, useState } from "react";
import { useAdmin } from '../../context/AdminContext';
import StatCard from "../../components/admin/Statscard";
import ChartCard from "../../components/admin/chartcard";

export default function Dashboard() {
  const { getDashboardStats, loading, error } = useAdmin();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    getDashboardStats(token).then(setStats);
  }, []);

  return (
    <div className="p-8 bg-green-50 min-h-screen">
      <h2 className="text-green-900 font-bold text-2xl mb-6">Dashboard Overview</h2>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {stats && (
        <>
          <div className="grid grid-cols-4 gap-6 mb-8">
            <StatCard title="Users" value={stats.totalUsers} />
            <StatCard title="Chat Sessions" value={stats.totalSessions} />
            <StatCard title="Messages" value={stats.totalMessages} />
            <StatCard title="AI Messages" value={stats.aiMessages} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <ChartCard title="Conversations Over Time">
              <div className="text-green-400 font-semibold">[Chart Placeholder]</div>
            </ChartCard>
            <ChartCard title="Top Intents">
              <div className="text-green-400 font-semibold">[Chart Placeholder]</div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
