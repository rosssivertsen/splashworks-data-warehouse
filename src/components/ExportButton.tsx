import { useState, useRef, useEffect } from "react";

interface ExportButtonProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  filename?: string;
}

/**
 * Generate RFC 4180 compliant CSV string.
 */
export function generateCsv(
  columns: string[],
  rows: (string | number | boolean | null)[][]
): string {
  if (columns.length === 0) return "";

  const escape = (val: string | number | boolean | null): string => {
    if (val === null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const header = columns.map(escape).join(",");
  const body = rows.map((row) => row.map(escape).join(",")).join("\n");
  return header + "\n" + body;
}

export function ExportButton({
  columns,
  rows,
  filename = "export",
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const disabled = columns.length === 0 || rows.length === 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const downloadCsv = () => {
    const csv = generateCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const data = [columns, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="px-3 py-1.5 text-sm rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Export
      </button>
      {open && !disabled && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-neutral-200 rounded shadow-lg z-10">
          <button
            onClick={downloadCsv}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Download CSV
          </button>
          <button
            onClick={downloadExcel}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Download Excel
          </button>
        </div>
      )}
    </div>
  );
}
