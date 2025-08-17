export default function Topbar() {
  return (
    <header className="bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg p-6 flex justify-between items-center">
      <h1 className="font-extrabold text-2xl text-white drop-shadow">Admin Dashboard</h1>
      <div className="flex items-center gap-3">
        <span className="text-base text-white font-semibold">Super Admin</span>
        <button className="px-4 py-2 text-base rounded bg-red-500 text-white hover:bg-red-600 shadow">
          Logout
        </button>
      </div>
    </header>
  );
}
