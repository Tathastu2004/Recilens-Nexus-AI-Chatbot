export default function StatCard({ title, value, className = "" }) {
  return (
    <div
      className={`bg-green-100 text-green-900 rounded-lg p-6 shadow-sm text-center ${className}`}
    >
      <p className="text-md font-medium mb-1">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  );
}
