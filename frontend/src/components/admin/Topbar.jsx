import { useTheme } from '../../context/ThemeContext';
import { useClerkUser } from '../../context/ClerkUserContext';
import { 
  IconBell, IconSearch, IconSun, IconMoon, IconUser,
  IconSettings, IconMenu2
} from '@tabler/icons-react';
import { useState } from 'react';

export default function Topbar({ 
  title, 
  subtitle, 
  showSearch = false,
  onSearch,
  onMenuToggle,
  actions 
}) {
  const { isDark } = useTheme();
  const { dbUser: user, clerkUser } = useClerkUser();
  const [searchValue, setSearchValue] = useState('');
  
  // Use real user data
  const displayUser = user || {
    name: `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() || clerkUser?.username || 'Admin',
    profilePicture: clerkUser?.imageUrl || user?.profilePicture
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  return (
    <header className="border-b"
            style={{ 
              backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }}>
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="lg:hidden p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: isDark ? '#ffffff' : '#000000'
                }}
              >
                <IconMenu2 size={20} />
              </button>
            )}
            
            {/* Title */}
            <div>
              {title && (
                <h1 className="text-xl sm:text-2xl font-bold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm"
                   style={{ color: isDark ? '#cccccc' : '#666666' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Center Section - Search */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <IconSearch 
                  size={18} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: isDark ? '#888888' : '#888888' }}
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border transition-colors"
                  style={{ 
                    backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                />
              </div>
            </div>
          )}

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Custom Actions */}
            {actions}
            
            {/* Mobile Search Toggle */}
            {showSearch && (
              <button
                className="md:hidden p-2.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: isDark ? '#ffffff' : '#000000'
                }}
                title="Search"
              >
                <IconSearch size={18} />
              </button>
            )}

            {/* User Profile - Hidden on mobile */}
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l"
                 style={{ borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <img
                src={displayUser.profilePicture || 'https://assets.aceternity.com/manu.png'}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
                style={{ 
                  backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
                onError={(e) => {
                  e.target.src = 'https://assets.aceternity.com/manu.png';
                }}
              />
              <span className="text-sm font-medium hidden md:block"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                {displayUser.name}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {showSearch && (
          <div className="md:hidden mt-4">
            <div className="relative">
              <IconSearch 
                size={18} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
                style={{ color: isDark ? '#888888' : '#888888' }}
              />
              <input
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border transition-colors"
                style={{ 
                  backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}