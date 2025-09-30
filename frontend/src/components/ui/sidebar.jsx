"use client";
import { cn } from "../../lib/utils";
import { createContext, useContext, useState } from "react";

const SidebarContext = createContext(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
  isDark = false, // Add theme support
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      <div style={{ 
        '--sidebar-bg-light': '#ffffff',
        '--sidebar-bg-dark': '#171717',
        '--sidebar-border-light': '#e5e5e5', 
        '--sidebar-border-dark': '#4a4a4a',
        '--sidebar-text-light': '#000000',
        '--sidebar-text-dark': '#ffffff',
        '--sidebar-text-secondary-light': '#6b7280',
        '--sidebar-text-secondary-dark': '#d1d5db',
        '--sidebar-hover-light': '#f5f5f5',
        '--sidebar-hover-dark': '#2f2f2f',
        '--sidebar-accent-light': '#000000',
        '--sidebar-accent-dark': '#10a37f'
      }}>
        {children}
      </div>
    </SidebarProvider>
  );
};

export const SidebarBody = ({ className, children, isDark = false, ...props }) => {
  return (
    <div
      className={cn(
        "flex flex-col h-full transition-all duration-300",
        className
      )}
      style={{
        backgroundColor: isDark ? '#171717' : '#ffffff',
        borderRight: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`
      }}
      {...props}
    >
      <DesktopSidebar className={className} isDark={isDark}>{children}</DesktopSidebar>
    </div>
  );
};

// ✅ ENHANCED DESKTOP SIDEBAR
export const DesktopSidebar = ({
  className,
  children,
  isDark = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        "h-full flex flex-col shrink-0 w-full transition-all duration-300",
        // Responsive width classes
        "w-16 md:w-64 lg:w-72",
        className
      )}
      style={{
        backgroundColor: isDark ? '#171717' : '#ffffff',
        borderRight: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const SidebarLink = ({ 
  link, 
  className, 
  onClick, 
  isActive = false,
  isDark = false,
  ...props 
}) => {
  const { open, animate } = useSidebar();

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center gap-3 group/sidebar px-3 py-2.5 mx-2 rounded-xl transition-all duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        // Responsive padding
        "px-2 md:px-3 py-2 md:py-2.5",
        className
      )}
      style={{
        backgroundColor: isActive 
          ? isDark ? 'rgba(16, 163, 127, 0.15)' : 'rgba(0, 0, 0, 0.05)'
          : 'transparent',
        color: isActive
          ? isDark ? '#10a37f' : '#000000'
          : isDark ? '#ffffff' : '#000000',
        border: `1px solid ${
          isActive 
            ? isDark ? 'rgba(16, 163, 127, 0.3)' : 'rgba(0, 0, 0, 0.1)'
            : 'transparent'
        }`
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.target.style.backgroundColor = isDark ? '#2f2f2f' : '#f5f5f5';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.target.style.backgroundColor = 'transparent';
        }
      }}
      onClick={handleClick}
      {...props}
    >
      {/* Icon Container */}
      <div className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 shrink-0">
        {link.icon}
      </div>
      
      {/* Label with responsive visibility */}
      <span
        className={cn(
          "text-sm font-medium group-hover/sidebar:translate-x-1 transition-all duration-300 whitespace-nowrap",
          // Hide on mobile, show on desktop
          "hidden md:inline-block",
          animate && !open && "opacity-0 w-0 overflow-hidden"
        )}
        style={{
          color: 'inherit'
        }}
      >
        {link.label}
      </span>
    </a>
  );
};

// ✅ NEW SIDEBAR HEADER COMPONENT
export const SidebarHeader = ({ 
  children, 
  className, 
  isDark = false,
  ...props 
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-4 border-b transition-all duration-300",
        // Responsive padding
        "px-2 md:px-3 py-3 md:py-4",
        className
      )}
      style={{
        borderBottom: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
        backgroundColor: isDark ? 'rgba(47, 47, 47, 0.5)' : 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(10px)'
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// ✅ NEW SIDEBAR FOOTER COMPONENT  
export const SidebarFooter = ({ 
  children, 
  className, 
  isDark = false,
  ...props 
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-3 py-4 border-t mt-auto transition-all duration-300",
        // Responsive padding
        "px-2 md:px-3 py-3 md:py-4",
        className
      )}
      style={{
        borderTop: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`,
        backgroundColor: isDark ? 'rgba(47, 47, 47, 0.3)' : 'rgba(245, 245, 245, 0.5)'
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// ✅ NEW SIDEBAR SECTION COMPONENT
export const SidebarSection = ({ 
  title,
  children, 
  className, 
  isDark = false,
  collapsible = false,
  defaultCollapsed = false,
  ...props 
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        "flex flex-col transition-all duration-300",
        className
      )}
      {...props}
    >
      {title && (
        <div 
          className={cn(
            "flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider",
            // Responsive padding
            "px-2 md:px-3",
            collapsible && "cursor-pointer hover:opacity-80"
          )}
          style={{
            color: isDark ? '#d1d5db' : '#6b7280'
          }}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
        >
          <span className="hidden md:inline-block">{title}</span>
          {collapsible && (
            <span 
              className={cn(
                "transition-transform duration-200 hidden md:inline-block",
                collapsed && "rotate-180"
              )}
            >
              ↓
            </span>
          )}
        </div>
      )}
      
      <div 
        className={cn(
          "flex flex-col gap-1 transition-all duration-300",
          collapsed && "opacity-0 max-h-0 overflow-hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
};

// ✅ NEW SIDEBAR DIVIDER COMPONENT
export const SidebarDivider = ({ 
  className, 
  isDark = false,
  ...props 
}) => {
  return (
    <div
      className={cn(
        "h-px mx-3 my-2 transition-all duration-300",
        // Responsive margins
        "mx-2 md:mx-3",
        className
      )}
      style={{
        backgroundColor: isDark ? '#4a4a4a' : '#e5e5e5'
      }}
      {...props}
    />
  );
};

// ✅ NEW SIDEBAR TOGGLE BUTTON COMPONENT
export const SidebarToggle = ({ 
  className, 
  isDark = false,
  icon,
  ...props 
}) => {
  const { open, setOpen } = useSidebar();

  return (
    <button
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
        "hover:scale-110 active:scale-95",
        "md:hidden", // Only show on mobile
        className
      )}
      style={{
        backgroundColor: isDark ? '#2f2f2f' : '#f5f5f5',
        color: isDark ? '#ffffff' : '#000000',
        border: `1px solid ${isDark ? '#4a4a4a' : '#e5e5e5'}`
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = isDark ? '#4a4a4a' : '#e5e5e5';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = isDark ? '#2f2f2f' : '#f5f5f5';
      }}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {icon || (
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      )}
    </button>
  );
};
