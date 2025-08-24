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
      <span className="px-3 py-2 text-gray-600 font-medium cursor-not-allowed select-none rounded-lg bg-gray-100">
        No Action Allowed 
      </span>
    ) : (
      <div className="flex gap-2">
        {user.role === "admin" ? (
          <button
            className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-medium shadow-sm hover:bg-orange-200 hover:shadow-md transition-all duration-200 text-sm"
            onClick={() => handleDemote(user._id)}
          >
            Demote
          </button>
        ) : (
          <button
            className="px-3 py-1.5 rounded-lg bg-green-500 text-white font-medium shadow-sm hover:bg-green-600 hover:shadow-md transition-all duration-200 text-sm"
            onClick={() => handlePromote(user._id)}
          >
            Promote
          </button>
        )}
        <button
          className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium shadow-sm hover:bg-red-600 hover:shadow-md transition-all duration-200 text-sm"
          onClick={() => handleDelete(user._id)}
        >
          Delete
        </button>
      </div>
    ),
  ]);

  return (
    <div className="p-6 bg-green-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-green-900 font-bold text-2xl mb-6">User Management</h2>
        <div className="bg-white/30 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/20">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-700">Loading users...</span>
            </div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-xl mb-4">
              Error: {error}
            </div>
          )}
          {!loading && users.length > 0 && <Table headers={headers} rows={rows} />}
          {!loading && users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No users found</p>
              <button 
                onClick={fetchUsers}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
