export default function Topbar() {
  return (
    <header className="bg-green-700 text-white p-5 flex justify-between items-center shadow">
      <h1 className="font-bold text-xl">Admin Dashboard</h1>
      <button className="bg-white text-green-700 px-4 py-2 rounded hover:bg-green-100">
        Logout
      </button>
    </header>
  );
}
