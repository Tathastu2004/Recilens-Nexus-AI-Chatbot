import { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminContext";
import { useTheme } from "../../context/ThemeContext";
import { 
  IconUsers, IconRefresh, IconShield, 
  IconCrown, IconTrash, IconArrowDown, IconArrowUp, IconAlertCircle,
  IconSearch
} from "@tabler/icons-react";

export default function Users() {
  const { isDark } = useTheme();
  const {
    getAllUsers,
    updateUserRole,
    deleteUser,
    loading,
    error,
  } = useAdmin();
  
  const [users, setUsers] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

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
      await fetchUsers();
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
      await fetchUsers();
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
        await fetchUsers();
      } catch (error) {
        console.error('❌ Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
      } finally {
        setActionLoading(prev => ({ ...prev, [userId]: false }));
      }
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    (user.username || user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* ✅ Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* ✅ SEAMLESS HEADER */}
        <div className=" z-10 backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 250, 250, 0.8)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Left Section */}
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    User Management
                  </h1>
                  <p className="text-xs sm:text-sm"
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Manage {users.length} registered users
                  </p>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                
                {/* Search */}
                <div className="relative flex-1 sm:min-w-80">
                  <IconSearch 
                    size={18} 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-0 transition-all focus:ring-2"
                    style={{ 
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      color: isDark ? '#ffffff' : '#000000',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                </div>
                
                {/* Stats & Actions */}
                <div className="flex items-center gap-3">
                  <div className="px-3 py-2 rounded-lg text-sm font-medium"
                       style={{ 
                         backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                         color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
                       }}>
                    {filteredUsers.length} of {users.length} users
                  </div>
                  <button 
                    onClick={fetchUsers}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 text-sm"
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl flex items-center gap-3 border-0"
                 style={{ 
                   backgroundColor: 'rgba(239, 68, 68, 0.1)',
                   color: isDark ? '#ffffff' : '#000000'
                 }}>
              <IconAlertCircle size={20} className="text-red-500" />
              <div>
                <p className="font-medium">Error loading users</p>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4"
                     style={{ 
                       border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                       borderTopColor: isDark ? '#ffffff' : '#000000'
                     }}></div>
                <h3 className="text-lg font-semibold mb-2"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Loading Users
                </h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  Fetching user data...
                </p>
              </div>
            </div>
          ) : users.length === 0 && !loading ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-6">👥</div>
              <h3 className="text-xl font-semibold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                No users found
              </h3>
              <p className="mb-8"
                 style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                There are no users in the system yet.
              </p>
              <button 
                onClick={fetchUsers}
                className="px-6 py-3 font-medium rounded-xl transition-all hover:scale-105 flex items-center gap-2 mx-auto"
                style={{ 
                  backgroundColor: isDark ? '#ffffff' : '#000000',
                  color: isDark ? '#000000' : '#ffffff'
                }}
              >
                <IconRefresh size={20} />
                Refresh Users
              </button>
            </div>
          ) : (
            /* ✅ SEAMLESS USERS TABLE */
            <div className="rounded-2xl overflow-hidden"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                   backdropFilter: 'blur(10px)',
                   border: 'none'
                 }}>
              
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-opacity-10"
                   style={{ 
                     backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                     borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                   }}>
                <div className="grid grid-cols-12 gap-4 text-sm font-semibold"
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  <div className="col-span-3">User</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-2">Joined</div>
                  <div className="col-span-2">Actions</div>
                </div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-opacity-10"
                   style={{ 
                     borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                   }}>
                {filteredUsers.map((user) => (
                  <div key={user._id} 
                       className="px-6 py-4 hover:bg-opacity-50 transition-all duration-200"
                       onMouseEnter={(e) => {
                         e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.backgroundColor = 'transparent';
                       }}>
                    <div className="grid grid-cols-12 gap-4 text-sm"
                         style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                      
                      {/* User */}
                      <div className="col-span-3 flex items-center gap-3">
                        <img
                          src={user.profilePicture || 'https://assets.aceternity.com/manu.png'}
                          alt={user.username || user.name}
                          className="w-10 h-10 rounded-full object-cover"
                          style={{ 
                            backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                          }}
                          onError={(e) => {
                            e.target.src = 'https://assets.aceternity.com/manu.png';
                          }}
                        />
                        <div>
                          <div className="font-medium"
                               style={{ color: isDark ? '#ffffff' : '#000000' }}>
                            {user.username || user.name || 'Unknown'}
                          </div>
                          <div className="text-xs"
                               style={{ color: isDark ? '#888888' : '#666666' }}>
                            ID: {user._id?.slice(-8) || 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Email */}
                      <div className="col-span-3">
                        <div className="text-sm"
                             style={{ color: isDark ? '#ffffff' : '#000000' }}>
                          {user.email || 'No email'}
                        </div>
                      </div>
                      
                      {/* Role */}
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${
                          user.role === 'super-admin' 
                            ? isDark ? 'bg-purple-900/20 text-purple-400 border border-purple-400/20' : 'bg-purple-100 text-purple-800 border border-purple-300'
                            : user.role === 'admin'
                            ? isDark ? 'bg-blue-900/20 text-blue-400 border border-blue-400/20' : 'bg-blue-100 text-blue-800 border border-blue-300'
                            : isDark ? 'bg-green-900/20 text-green-400 border border-green-400/20' : 'bg-green-100 text-green-800 border border-green-300'
                        }`}>
                          {user.role === 'super-admin' && <IconCrown size={12} />}
                          {user.role === 'admin' && <IconShield size={12} />}
                          {user.role === 'client' && <IconUsers size={12} />}
                          {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                        </span>
                      </div>
                      
                      {/* Joined Date */}
                      <div className="col-span-2">
                        <div className="text-sm"
                             style={{ color: isDark ? '#ffffff' : '#000000' }}>
                          {user.createdAt 
                            ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'Unknown'}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-2">
                        {user.role === "super-admin" ? (
                          <span className="px-3 py-2 text-xs font-medium rounded-lg cursor-not-allowed select-none"
                                style={{ 
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                  color: isDark ? '#888888' : '#666666'
                                }}>
                          Protected Account
                        </span>
                        ) : (
                          <div className="flex gap-2">
                            {actionLoading[user._id] ? (
                              <div className="flex items-center gap-2 px-3 py-1.5">
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                                     style={{ color: isDark ? '#ffffff' : '#000000' }}></div>
                                <span className="text-sm" style={{ color: isDark ? '#cccccc' : '#666666' }}>
                                  Processing...
                                </span>
                              </div>
                            ) : (
                              <>
                                {user.role === "admin" ? (
                                  <button
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                    style={{ 
                                      backgroundColor: isDark ? 'rgba(251, 146, 60, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                                      color: '#f59e0b'
                                    }}
                                    onClick={() => handleDemote(user._id)}
                                  >
                                    <IconArrowDown size={14} />
                                    Demote
                                  </button>
                                ) : (
                                  <button
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                    style={{ 
                                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                      color: '#10b981'
                                    }}
                                    onClick={() => handlePromote(user._id)}
                                  >
                                    <IconArrowUp size={14} />
                                    Promote
                                  </button>
                                )}
                                <button
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                  style={{ 
                                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444'
                                  }}
                                  onClick={() => handleDelete(user._id)}
                                >
                                  <IconTrash size={14} />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
