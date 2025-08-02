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
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "flex flex-col h-full",
        className
      )}
      {...props}
    >
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
    </div>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen, animate } = useSidebar();
  
  return (
    <div
      className={cn(
        "h-full hidden md:flex md:flex-col shrink-0 w-full",
        className
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </div>
  );
};

export const SidebarLink = ({ link, className, onClick, ...props }) => {
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
        "flex items-center justify-start gap-2 group/sidebar py-2",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {link.icon}
      <span
        className={cn(
          "text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-300 whitespace-pre inline-block !p-0 !m-0",
          animate && !open && "opacity-0 w-0 overflow-hidden"
        )}
      >
        {link.label}
      </span>
    </a>
  );
};
