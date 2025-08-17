export default function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 shadow-xl rounded-xl p-6 ${className}`}>
      <h3 className="text-lg font-bold mb-4 text-indigo-700 drop-shadow">{title}</h3>
      <div className="h-64 flex items-center justify-center">{children}</div>
    </div>
  );
}
