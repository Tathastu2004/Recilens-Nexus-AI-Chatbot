import { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminContext";
import Table from "../../components/admin/Table";

export default function Users() {
  const {
    getAllUsers,
    updateUserRole,
    deleteUser,
    loading,
    error,
  } = useAdmin();
  
  const [users, setUsers] = useState([]);
  const [actionLoading, setActionLoading] = useState({});

  const fetchUsers = async () => {
    try {
      console.log('👥 Fetching users...');
      const response = await getAllUsers();
      console.log('✅ Users response:', response);
      
      if (response && response.data) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePromote = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await updateUserRole(userId, 'admin');
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('❌ Error promoting user:', error);
      alert('Failed to promote user: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDemote = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await updateUserRole(userId, 'client');
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('❌ Error demoting user:', error);
      alert('Failed to demote user: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm("Delete user and all related data? This action cannot be undone.")) {
      setActionLoading(prev => ({ ...prev, [userId]: true }));
      try {
        await deleteUser(userId);
        await fetchUsers(); // Refresh the list
      } catch (error) {
        console.error('❌ Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
      } finally {
        setActionLoading(prev => ({ ...prev, [userId]: false }));
      }
    }
  };

  const headers = ["Name", "Email", "Role", "Created", "Actions"];

  const rows = users.map((user) => [
    user.username || user.name || 'Unknown',
    user.email || 'No email',
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
      user.role === 'super-admin' 
        ? 'bg-purple-100 text-purple-800 border border-purple-300'
        : user.role === 'admin'
        ? 'bg-blue-100 text-blue-800 border border-blue-300'
        : 'bg-green-100 text-green-800 border border-green-300'
    }`}>
      {user.role}
    </span>,
    user.createdAt 
      ? new Date(user.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : 'Unknown',
    user.role === "super-admin" ? (
      <span className="px-3 py-2 text-gray-600 font-medium cursor-not-allowed select-none rounded-lg bg-gray-100">
        Protected Account
      </span>
    ) : (
      <div className="flex gap-2">
        {actionLoading[user._id] ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Processing...</span>
          </div>
        ) : (
          <>
            {user.role === "admin" ? (
              <button
                className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-medium shadow-sm hover:bg-orange-200 hover:shadow-md transition-all duration-200 text-sm"
                onClick={() => handleDemote(user._id)}
              >
                Demote to Client
              </button>
            ) : (
              <button
                className="px-3 py-1.5 rounded-lg bg-green-500 text-white font-medium shadow-sm hover:bg-green-600 hover:shadow-md transition-all duration-200 text-sm"
                onClick={() => handlePromote(user._id)}
              >
                Promote to Admin
              </button>
            )}
            <button
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium shadow-sm hover:bg-red-600 hover:shadow-md transition-all duration-200 text-sm"
              onClick={() => handleDelete(user._id)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    ),
  ]);

  return (
    <div className="p-6 bg-green-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-green-900 font-bold text-3xl">User Management</h2>
          <div className="flex items-center gap-4">
            <span className="text-green-700 bg-green-100 px-3 py-1 rounded-full text-sm font-medium">
              {users.length} Total Users
            </span>
            <button 
              onClick={fetchUsers}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {loading && users.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-700">Loading users...</span>
            </div>
          )}
          
          {error && (
            <div className="m-6 text-red-600 bg-red-50 border border-red-200 p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <strong>Error loading users:</strong> {error}
              </div>
            </div>
          )}
          
          {!loading && users.length > 0 && (
            <div className="p-6">
              <Table headers={headers} rows={rows} />
            </div>
          )}
          
          {!loading && users.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">No users found</p>
              <p className="text-gray-500 mb-4">There are no users in the system yet.</p>
              <button 
                onClick={fetchUsers}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Refresh Users
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
