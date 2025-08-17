export default function StatCard({ title, value, className = "" }) {
  return (
    <div className={`bg-gradient-to-r from-green-400 to-blue-400 text-white shadow-xl rounded-xl p-6 text-center ${className}`}>
      <p className="text-lg font-semibold mb-2 drop-shadow">{title}</p>
      <h2 className="text-3xl font-extrabold">{value}</h2>
    </div>
  );
}
