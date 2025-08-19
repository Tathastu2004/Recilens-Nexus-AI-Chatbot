export default function Table({ headers, rows }) {
  return (
    <table className="w-full border border-green-300 rounded-md">
      <thead className="bg-green-200">
        <tr>
          {headers.map((h, idx) => (
            <th
              key={idx}
              className="border border-green-300 px-4 py-2 text-left text-green-900 font-semibold"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={idx}
            className={idx % 2 === 0 ? "bg-green-50" : "bg-green-100"}
          >
            {row.map((cell, i) => (
              <td
                key={i}
                className="border border-green-300 px-4 py-2 text-green-900"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
