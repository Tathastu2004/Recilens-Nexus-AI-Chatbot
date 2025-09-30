import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/admin/Sidebar";
import { useTheme } from "../context/ThemeContext";
import { IconMenu2 } from "@tabler/icons-react";

export default function AdminLayout() {
  const { isDark } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* ✅ Desktop Sidebar - Fixed Position */}
      <div className="hidden lg:block lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:z-30">
        <Sidebar isOpen={true} onClose={() => {}} />
      </div>
      
      {/* ✅ Mobile Sidebar - Overlay */}
      <div className="lg:hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      {/* ✅ Main Content Area */}
      <div className="lg:pl-64">
        {/* ✅ Mobile Header with Menu Button */}
        <div className="lg:hidden sticky top-0 z-20 backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.9)' : 'rgba(250, 250, 250, 0.9)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg transition-colors"
              style={{ 
                color: isDark ? '#ffffff' : '#000000',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
              }}
            >
              <IconMenu2 size={20} />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                   style={{ 
                     backgroundColor: isDark ? '#ffffff' : '#000000',
                     color: isDark ? '#000000' : '#ffffff'
                   }}>
                A
              </div>
              <span className="font-semibold text-sm"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Admin Panel
              </span>
            </div>
            
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </div>
        
        {/* ✅ Page Content */}
        <Outlet context={{ isSidebarOpen, setIsSidebarOpen }} />
      </div>
    </div>
  );
}
