import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();

  const navLinks = [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/feedback-reply", label: "Feedback" },
    { to: "/admin/analytics", label: "Analytics" },
    { to: "/admin/models", label: "Model Management" },
    { to: "/admin/users", label: "Users" },
  ];

  return (
    <aside className="w-56 bg-green-700 text-white min-h-screen flex flex-col shadow-md">
      <div className="p-6 font-bold text-xl border-b border-green-600">
        Admin Panel
      </div>
      <nav className="mt-4 flex-1 flex flex-col gap-1 px-4">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`block py-2 px-3 rounded transition ${
              location.pathname === link.to
                ? "bg-green-900 font-bold"
                : "hover:bg-green-600"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
