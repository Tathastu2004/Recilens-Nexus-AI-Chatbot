import { useTheme } from '../../context/ThemeContext';

export default function ChartCard({ title, children, className = "", actions, icon: Icon, height = "h-64" }) {
  const { isDark } = useTheme();
  
  return (
    <div
      className={`rounded-xl border overflow-hidden ${className}`}
      style={{ 
        backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Header */}
      <div className="p-6 border-b"
           style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && <Icon size={20} style={{ color: isDark ? '#cccccc' : '#666666' }} />}
            <h3 className="text-lg font-semibold"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              {title}
            </h3>
          </div>
          {actions}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6"
           style={{ color: isDark ? '#ffffff' : '#000000' }}>
        <div className={`${height} flex items-center justify-center`}>
          {children}
        </div>
      </div>
    </div>
  );
}
