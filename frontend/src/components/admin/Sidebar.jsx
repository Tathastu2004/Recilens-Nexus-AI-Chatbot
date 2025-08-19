import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="w-56 bg-green-700 text-white min-h-screen flex flex-col shadow-md">
      <div className="p-6 font-bold text-xl border-b border-green-600">
        Admin Panel
      </div>
      <nav className="mt-4 flex-1 flex flex-col gap-1 px-4">
        <Link
          to="/admin"
          className="block py-2 px-3 rounded hover:bg-green-600 transition"
        >
          Dashboard
        </Link>
        <Link
          to="/admin/system-setup"
          className="block py-2 px-3 rounded hover:bg-green-600 transition"
        >
          System Setup
        </Link>
        <Link
          to="/admin/analytics"
          className="block py-2 px-3 rounded hover:bg-green-600 transition"
        >
          Analytics
        </Link>
        <Link
          to="/admin/models"
          className="block py-2 px-3 rounded hover:bg-green-600 transition"
        >
          Model Management
        </Link>
        <Link
          to="/admin/users"
          className="block py-2 px-3 rounded hover:bg-green-600 transition"
        >
          Users
        </Link>
      </nav>
    </aside>
  );
}
