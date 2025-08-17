import StatCard from "@/components/admin/Statscard";
import ChartCard from "@/components/admin/Chartcard";

export default function Dashboard() {
  return (
    <div className="bg-gradient-to-br from-indigo-50 via-blue-100 to-purple-50 min-h-screen p-8">
      <h2 className="text-2xl font-extrabold mb-6 text-indigo-700 drop-shadow">
        Dashboard Overview
      </h2>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Users"
          value="120"
          className="bg-gradient-to-r from-green-400 to-blue-400 text-white shadow-lg"
        />
        <StatCard
          title="Conversations Today"
          value="450"
          className="bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg"
        />
        <StatCard
          title="Avg Response Time"
          value="1.2s"
          className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg"
        />
        <StatCard
          title="Accuracy"
          value="92%"
          className="bg-gradient-to-r from-teal-400 to-cyan-400 text-white shadow-lg"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="Conversations Over Time"
          className="bg-gradient-to-br from-blue-100 to-indigo-200 shadow-md"
        >
          <div className="flex items-center justify-center h-full text-indigo-400 font-bold text-lg">
            [LineChart Placeholder]
          </div>
        </ChartCard>
        <ChartCard
          title="Top Intents"
          className="bg-gradient-to-br from-pink-100 to-purple-200 shadow-md"
        >
          <div className="flex items-center justify-center h-full text-purple-400 font-bold text-lg">
            [PieChart Placeholder]
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
