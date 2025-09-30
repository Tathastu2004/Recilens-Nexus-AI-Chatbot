import { useTheme } from '../../context/ThemeContext';

export default function Table({ 
  headers, 
  rows, 
  title,
  className = "",
  showSearch = false,
  searchPlaceholder = "Search...",
  onSearch,
  actions
}) {
  const { isDark } = useTheme();
  
  return (
    <div className={`rounded-xl border overflow-hidden ${className}`}
         style={{ 
           backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
           borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
         }}>
      
      {/* Header */}
      {(title || showSearch || actions) && (
        <div className="p-6 border-b"
             style={{ borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  {title}
                </h3>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Search */}
              {showSearch && (
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  onChange={(e) => onSearch?.(e.target.value)}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{ 
                    backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                />
              )}
              
              {/* Actions */}
              {actions}
            </div>
          </div>
        </div>
      )}
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                  borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }}>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="text-left py-4 px-6 font-semibold text-sm"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b transition-colors hover:bg-opacity-50"
                style={{ 
                  borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  '&:hover': { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)' }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="py-4 px-6 text-sm"
                    style={{ color: isDark ? '#cccccc' : '#666666' }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Empty State */}
        {rows.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              No data available
            </h3>
            <p style={{ color: isDark ? '#cccccc' : '#666666' }}>
              There are no records to display at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
