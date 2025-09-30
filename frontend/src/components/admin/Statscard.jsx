import { useTheme } from '../../context/ThemeContext';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  change, 
  icon: Icon, 
  trend,
  className = "" 
}) {
  const { isDark } = useTheme();
  
  return (
    <div
      className={`p-6 rounded-xl border transition-all hover:shadow-lg ${className}`}
      style={{ 
        backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }}
    >
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        {Icon && (
          <div className="p-3 rounded-xl"
               style={{
                 backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                 color: isDark ? '#ffffff' : '#000000'
               }}>
            <Icon size={24} />
          </div>
        )}
        
        {/* Change Indicator */}
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
            change >= 0 
              ? isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'
              : isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'
          }`}>
            {change >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      
      <div>
        <h3 className="text-sm font-medium mb-2"
            style={{ color: isDark ? '#cccccc' : '#666666' }}>
          {title}
        </h3>
        <p className="text-3xl font-bold mb-1"
           style={{ color: isDark ? '#ffffff' : '#000000' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && (
          <p className="text-sm"
             style={{ color: isDark ? '#888888' : '#888888' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
