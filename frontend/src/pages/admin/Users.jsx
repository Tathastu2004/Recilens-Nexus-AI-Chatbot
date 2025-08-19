import { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminContext";
import Table from "@/components/admin/Table";

export default function Users() {
  const {
    getAllUsers,
    promoteUserToAdmin,
    demoteAdminToClient,
    deleteUser,
    loading,
    error,
  } = useAdmin();
  const [users, setUsers] = useState([]);

  const fetchUsers = () => {
    const token = localStorage.getItem("token");
    getAllUsers(token).then((res) => setUsers(res.users || []));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePromote = (id) => {
    const token = localStorage.getItem("token");
    promoteUserToAdmin(token, id).then(fetchUsers);
  };

  const handleDemote = (id) => {
    const token = localStorage.getItem("token");
    demoteAdminToClient(token, id).then(fetchUsers);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete user and all related data?")) {
      const token = localStorage.getItem("token");
      deleteUser(token, id).then(fetchUsers);
    }
  };

  const headers = ["User ID", "Role", "Actions"];

  const rows = users.map((user) => [
    user.name,
    user.role,
    user.role === "super-admin" ? (
      <span className="px-4 py-2  text-black font-semibold  cursor-not-allowed select-none">
      No Action Allowed 
    </span>
    ) : (
      <div className="flex gap-3">
        {user.role === "admin" ? (
          <button
            className="px-4 py-2 rounded-full bg-orange-100 text-orange-700 font-semibold shadow hover:bg-orange-200 transition"
            onClick={() => handleDemote(user._id)}
          >
            Demote
          </button>
        ) : (
          <button
            className="px-4 py-2 rounded-full bg-green-500 text-white font-semibold shadow hover:bg-green-600 transition"
            onClick={() => handlePromote(user._id)}
          >
            Promote
          </button>
        )}
        <button
          className="px-4 py-2 rounded-full bg-red-500 text-white font-semibold shadow hover:bg-red-600 transition"
          onClick={() => handleDelete(user._id)}
        >
          Delete
        </button>
      </div>
    ),
  ]);

  return (
    <div className="p-8 bg-green-50 min-h-screen">
      <h2 className="text-green-900 font-bold text-2xl mb-6">User Management</h2>
      <div className="bg-white p-6 rounded-lg shadow">
        {loading && <div>Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}
        <Table headers={headers} rows={rows} />
      </div>
    </div>
  );
}
