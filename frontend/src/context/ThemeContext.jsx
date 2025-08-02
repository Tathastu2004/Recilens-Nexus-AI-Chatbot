import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // ✅ GET INITIAL THEME FROM LOCALSTORAGE OR SYSTEM PREFERENCE
  const getInitialTheme = () => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ✅ APPLY THEME TO DOCUMENT
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ✅ LISTEN FOR SYSTEM THEME CHANGES
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only update if user hasn't manually set a theme
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ✅ TOGGLE THEME WITH SMOOTH TRANSITION
  const toggleTheme = () => {
    setIsTransitioning(true);
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // ✅ SET SPECIFIC THEME
  const setSpecificTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setIsTransitioning(true);
      setTheme(newTheme);
      
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }
  };

  // ✅ CHECK IF DARK MODE
  const isDark = theme === 'dark';

  // ✅ GET SYSTEM PREFERENCE
  const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  // ✅ RESET TO SYSTEM PREFERENCE
  const resetToSystem = () => {
    localStorage.removeItem('theme');
    setSpecificTheme(getSystemTheme());
  };

  const value = {
    theme,
    isDark,
    isTransitioning,
    toggleTheme,
    setTheme: setSpecificTheme,
    resetToSystem,
    getSystemTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;