export default function Table({ headers, rows }) {
  return (
    <table className="w-full border-collapse border border-purple-200 shadow-lg rounded-xl overflow-hidden">
      <thead className="bg-gradient-to-r from-purple-100 to-blue-100">
        <tr>
          {headers.map((h, idx) => (
            <th key={idx} className="border border-purple-200 px-4 py-3 text-left text-purple-700 font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-purple-50">
            {row.map((cell, i) => (
              <td key={i} className="border border-purple-100 px-4 py-2 text-gray-700">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
