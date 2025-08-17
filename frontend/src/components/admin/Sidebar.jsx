import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 shadow-xl flex flex-col min-h-screen">
      <div className="p-6 font-extrabold text-2xl text-white border-b border-blue-700 drop-shadow">Admin Panel</div>
      <nav className="flex-1 p-4 space-y-3">
        <Link to="/admin" className="block p-2 rounded-lg text-white font-semibold hover:bg-blue-700 transition">Dashboard</Link>
        <Link to="/admin/system-setup" className="block p-2 rounded-lg text-white font-semibold hover:bg-blue-700 transition">System Setup</Link>
        <Link to="/admin/analytics" className="block p-2 rounded-lg text-white font-semibold hover:bg-blue-700 transition">Analytics</Link>
        <Link to="/admin/models" className="block p-2 rounded-lg text-white font-semibold hover:bg-blue-700 transition">Model Management</Link>
        <Link to="/admin/users" className="block p-2 rounded-lg text-white font-semibold hover:bg-blue-700 transition">Users</Link>
      </nav>
    </aside>
  );
}
