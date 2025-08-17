import Table from "../../components/admin/Table";

export default function Analytics() {
  const headers = ["Query", "Intent", "Accuracy", "Timestamp"];
  const rows = [
    ["Hello", "Greeting", "100%", "2025-08-17 10:00"],
    ["Book flight", "Travel", "95%", "2025-08-17 10:05"],
  ];

  return (
    <div className="bg-gradient-to-br from-pink-50 via-purple-100 to-blue-50 min-h-screen p-8">
      <h2 className="text-2xl font-extrabold mb-6 text-purple-700 drop-shadow">
        Analytics
      </h2>
      <div className="bg-white/90 rounded-xl shadow-lg p-6">
        <Table headers={headers} rows={rows} />
      </div>
    </div>
  );
}
