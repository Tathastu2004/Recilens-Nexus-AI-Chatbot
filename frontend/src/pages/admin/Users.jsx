import Table from "../../components/admin/Table";

export default function Users() {
  const headers = ["User ID", "Role", "Actions"];
  const rows = [
    ["1", "Super Admin", "Cannot edit"],
    ["2", "Admin", "Edit / Remove"],
  ];

  return (
    <div className="bg-gradient-to-br from-green-50 via-blue-100 to-purple-50 min-h-screen p-8">
      <h2 className="text-2xl font-extrabold mb-6 text-green-700 drop-shadow">
        User Management
      </h2>
      <div className="bg-white/90 rounded-xl shadow-lg p-6">
        <Table headers={headers} rows={rows} />
      </div>
    </div>
  );
}
