import { useState } from "react";
import { apiClient } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import { SqlEditor } from "../components/SqlEditor";
import { ExportButton } from "../components/ExportButton";
import type { QueryResponse } from "../types/api";

interface DataViewProps {
  onAddToDashboard?: (title: string, sql: string, results: { columns: string[]; rows: (string | number | boolean | null)[][] }) => void;
}

export function DataView({ onAddToDashboard }: DataViewProps) {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.queryRaw(sql);
      setResult(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Data Explorer</h2>
        <button
          onClick={handleRun}
          disabled={loading || !sql.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      <SqlEditor
        value={sql}
        onChange={setSql}
        onRun={handleRun}
        placeholder="Write your SQL query here..."
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">
              Results ({result.row_count} rows)
            </h3>
            <div className="flex gap-2">
              {onAddToDashboard && (
                <button
                  onClick={() => onAddToDashboard(sql.slice(0, 50) || "Query Result", sql, { columns: result.columns, rows: result.results })}
                  className="px-3 py-1.5 text-sm border border-primary-300 text-primary-700 rounded-md hover:bg-primary-50"
                >
                  + Dashboard
                </button>
              )}
              <ExportButton columns={result.columns} rows={result.results} filename="data-export" />
            </div>
          </div>
          <ResultsTable columns={result.columns} rows={result.results} />
        </div>
      )}
    </div>
  );
}
