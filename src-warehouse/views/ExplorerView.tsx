import { useState, useEffect } from "react";
import { apiClient } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import type { TableInfo, DictionaryResponse, QueryResponse } from "../types/api";

export function ExplorerView() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryResponse | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [preview, setPreview] = useState<QueryResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    apiClient.getSchema().then((resp) => setTables(resp.tables));
    apiClient.getDictionary().then((resp) => setDictionary(resp));
  }, []);

  const handlePreview = async (table: TableInfo) => {
    setPreviewLoading(true);
    try {
      const sql = `SELECT * FROM ${table.schema_name}.${table.table_name} LIMIT 100`;
      const resp = await apiClient.queryRaw(sql);
      setPreview(resp);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left panel */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 pr-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide mb-2">
            Tables
          </h3>
          <ul className="space-y-1">
            {tables.map((t) => (
              <li key={`${t.schema_name}.${t.table_name}`}>
                <button
                  onClick={() => {
                    setSelectedTable(t);
                    setPreview(null);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${
                    selectedTable?.table_name === t.table_name
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {t.table_name}
                  <span className="ml-1 text-xs text-neutral-400">
                    ({t.columns.length})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {dictionary && dictionary.business_terms.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide mb-2">
              Business Terms
            </h3>
            <dl className="space-y-2">
              {dictionary.business_terms.map((bt) => (
                <div key={bt.term}>
                  <dt className="text-sm font-medium text-neutral-800">{bt.term}</dt>
                  <dd className="text-xs text-neutral-500">{bt.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {dictionary && dictionary.relationships.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide mb-2">
              Relationships
            </h3>
            <dl className="space-y-2">
              {dictionary.relationships.map((r) => (
                <div key={r.name}>
                  <dt className="text-sm font-medium text-neutral-800">{r.name}</dt>
                  <dd className="text-xs text-neutral-500">{r.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0 space-y-4">
        {!selectedTable && (
          <p className="text-neutral-500 italic py-8">Select a table to view its structure</p>
        )}

        {selectedTable && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-800">
                {selectedTable.table_name}
                <span className="ml-2 text-sm font-normal text-neutral-400">
                  {selectedTable.columns.length} columns
                </span>
              </h2>
              <button
                onClick={() => handlePreview(selectedTable)}
                disabled={previewLoading}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40"
              >
                {previewLoading ? "Loading..." : "Preview"}
              </button>
            </div>

            <table className="w-full text-sm border border-neutral-200">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="px-3 py-2 text-left font-medium text-neutral-700 border-b border-neutral-200">
                    Column
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-700 border-b border-neutral-200">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-700 border-b border-neutral-200">
                    Nullable
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedTable.columns.map((col) => (
                  <tr key={col.column_name} className="border-b border-neutral-200">
                    <td className="px-3 py-2 font-mono text-neutral-900">{col.column_name}</td>
                    <td className="px-3 py-2 text-neutral-600">{col.data_type}</td>
                    <td className="px-3 py-2 text-neutral-600">{col.is_nullable ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {preview && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-700">Preview Data</h3>
                <ResultsTable columns={preview.columns} rows={preview.results} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
