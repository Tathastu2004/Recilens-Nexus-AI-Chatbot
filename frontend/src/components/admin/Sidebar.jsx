import { Link, useLocation, useNavigate } from "react-router-dom";
import { useClerkUser } from "../../context/ClerkUserContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react"; // ✅ Add this import
import { 
  IconDashboard, IconMessageCircle, IconChartBar, IconRobot, 
  IconUsers, IconLogout, IconSun, IconMoon, IconSettings, IconX
} from "@tabler/icons-react";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { dbUser: user, clerkUser } = useClerkUser();
  const { isDark, toggleTheme } = useTheme();

  // ✅ Add isDesktop detection
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use real user data
  const displayUser = user || {
    name: `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() || clerkUser?.username || 'Admin',
    email: clerkUser?.primaryEmailAddress?.emailAddress || user?.email,
    profilePicture: clerkUser?.imageUrl || user?.profilePicture,
    role: user?.role || 'admin'
  };

  const navLinks = [
    { to: "/admin", label: "Dashboard", icon: IconDashboard },
    { to: "/admin/feedback-reply", label: "Feedback", icon: IconMessageCircle },
    { to: "/admin/analytics", label: "Analytics", icon: IconChartBar },
    { to: "/admin/models", label: "Models", icon: IconRobot },
    { to: "/admin/users", label: "Users", icon: IconUsers },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.clear();
      navigate("/signin");
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.clear();
      navigate("/signin");
      window.location.reload();
    }
  };

  const handleLinkClick = () => {
    // Close mobile sidebar when link is clicked
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {!isDesktop && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`${isDesktop ? 'w-64 h-screen relative' : 'lg:hidden'} ${
        !isDesktop && !isOpen ? 'pointer-events-none' : ''
      }`}>
        <aside 
          className={`${
            isDesktop 
              ? 'h-screen flex flex-col w-64' 
              : `fixed left-0 top-0 h-screen w-80 transform transition-transform duration-300 ease-in-out flex flex-col z-50 ${
                  isOpen ? 'translate-x-0' : '-translate-x-full'
                }`
          }`}
          style={{ 
            backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
            borderRightColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }}
        >
          
          {/* ✅ HEADER */}
          <div className="p-4 sm:p-6 border-b"
               style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                     style={{ 
                       backgroundColor: isDark ? '#ffffff' : '#000000',
                       color: isDark ? '#000000' : '#ffffff'
                     }}>
                  A
                </div>
                <div>
                  <h1 className="text-lg font-semibold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Admin Panel
                  </h1>
                </div>
              </div>
              
              {/* Mobile Close Button */}
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg transition-colors"
                style={{ 
                  color: isDark ? '#cccccc' : '#666666',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                }}
              >
                <IconX size={20} />
              </button>
            </div>
          </div>

          {/* ✅ NAVIGATION */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              const Icon = link.icon;
              
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={handleLinkClick}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? isDark 
                        ? "bg-white text-black" 
                        : "bg-black text-white"
                      : isDark
                        ? "text-cccccc hover:bg-white/10"
                        : "text-666666 hover:bg-black/5"
                  }`}
                  style={!isActive ? {
                    color: isDark ? '#cccccc' : '#666666'
                  } : {}}
                >
                  <Icon size={18} />
                  <span className="font-medium">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* ✅ BOTTOM SECTION - Theme, User, Settings, Logout */}
          <div className="mt-auto">
            {/* Theme Toggle */}
            <div className="p-3 sm:p-4 border-t"
                 style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: isDark ? '#cccccc' : '#666666'
                }}
              >
                {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
                <span className="font-medium">
                  {isDark ? 'Light mode' : 'Dark mode'}
                </span>
              </button>
            </div>

            {/* User Profile */}
            <div className="p-3 sm:p-4 border-t"
                 style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              
              {/* Profile Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg mb-3"
                   style={{ 
                     backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                   }}>
                <img
                  src={displayUser.profilePicture || 'https://assets.aceternity.com/manu.png'}
                  alt="Profile"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                  style={{ 
                    backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  onError={(e) => {
                    e.target.src = 'https://assets.aceternity.com/manu.png';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate"
                     style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {displayUser.name}
                  </p>
                  <p className="text-xs truncate"
                     style={{ color: isDark ? '#888888' : '#666666' }}>
                    {displayUser.role?.charAt(0).toUpperCase() + displayUser.role?.slice(1) || 'Admin'}
                  </p>
                </div>
              </div>

              {/* Settings Link */}
              <Link
                to="/profile"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mb-2"
                style={{ 
                  color: isDark ? '#cccccc' : '#666666',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <IconSettings size={18} />
                <span className="font-medium">Settings</span>
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}
              >
                <IconLogout size={18} />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
