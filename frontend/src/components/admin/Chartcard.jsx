export default function ChartCard({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white border border-green-300 rounded-lg p-6 shadow-sm ${className}`}
    >
      <h3 className="text-md font-semibold mb-4 text-green-800">{title}</h3>
      <div className="h-64 flex items-center justify-center">{children}</div>
    </div>
  );
}
