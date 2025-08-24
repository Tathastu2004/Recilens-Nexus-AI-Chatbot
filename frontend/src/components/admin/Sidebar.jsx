import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logoutUser } = useUser();

  const navLinks = [
    { to: "/admin", label: "Dashboard", icon: "📊" },
    { to: "/admin/feedback-reply", label: "Feedback", icon: "💬" },
    { to: "/admin/analytics", label: "Analytics", icon: "📈" },
    { to: "/admin/models", label: "Model Management", icon: "🤖" },
    { to: "/admin/users", label: "Users", icon: "👥" },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      // Force logout even if API fails
      localStorage.clear();
      navigate("/");
      window.location.reload();
    }
  };

  return (
    <aside className="w-64 min-h-screen relative">
      {/* Glassy background with blur effect */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-xl border-r border-white/30 shadow-xl"></div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-white/20">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <span className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              A
            </span>
            Admin Panel
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${
                  isActive
                    ? "text-white shadow-lg"
                    : "text-gray-700 hover:text-gray-900 hover:bg-white/30"
                }`}
              >
                {/* Active background gradient */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl"></div>
                )}
                
                {/* Hover effect */}
                <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* Content */}
                <span className="relative text-lg">{link.icon}</span>
                <span className="relative font-medium">{link.label}</span>
                
                {/* Active indicator dot */}
                {isActive && (
                  <div className="relative ml-auto w-2 h-2 bg-white rounded-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout Section */}
        <div className="p-4 border-t border-white/20 space-y-3">
          {/* User Profile Info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0) || user?.username?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.name || user?.username || 'Admin User'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Administrator'}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Subtle glow effect */}
      <div className="absolute -inset-px bg-gradient-to-b from-white/20 to-transparent rounded-lg pointer-events-none"></div>
    </aside>
  );
}
