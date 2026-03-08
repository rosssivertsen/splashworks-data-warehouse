import { useState } from "react";

interface ResultsTableProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  pageSize?: number;
}

export function ResultsTable({ columns, rows, pageSize = 50 }: ResultsTableProps) {
  const [page, setPage] = useState(0);

  if (columns.length === 0 || rows.length === 0) {
    return <p className="text-neutral-500 italic py-4">No results returned.</p>;
  }

  const totalPages = Math.ceil(rows.length / pageSize);
  const start = page * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-neutral-200">
        <thead>
          <tr className="bg-neutral-100">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-neutral-700 border-b border-neutral-200"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, rowIdx) => (
            <tr
              key={start + rowIdx}
              className="hover:bg-neutral-50 border-b border-neutral-200"
            >
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 text-neutral-900">
                  {cell === null ? (
                    <span className="italic text-neutral-400">null</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between px-3 py-2 text-sm text-neutral-600">
        <span>{rows.length} rows</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
