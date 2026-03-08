import { useState, useEffect } from "react";
import { apiClient } from "../services/ApiClient";

interface HealthState {
  connected: boolean;
  lastEtlDate: string | null;
  lastEtlRows: number | null;
}

export function StatusBar() {
  const [health, setHealth] = useState<HealthState>({
    connected: false,
    lastEtlDate: null,
    lastEtlRows: null,
  });

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiClient.health();
        setHealth({
          connected: res.status === "healthy",
          lastEtlDate: res.last_etl_date,
          lastEtlRows: res.last_etl_rows,
        });
      } catch {
        setHealth({ connected: false, lastEtlDate: null, lastEtlRows: null });
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="flex items-center gap-4 px-4 py-2 text-xs text-neutral-600 bg-neutral-100 border-t border-neutral-200">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            health.connected ? "bg-green-500" : "bg-red-500"
          }`}
          data-testid="status-dot"
        />
        <span>{health.connected ? "Connected" : "Disconnected"}</span>
      </div>
      {health.lastEtlDate && (
        <span>Last ETL: {health.lastEtlDate}</span>
      )}
      {health.lastEtlRows != null && (
        <span>{health.lastEtlRows.toLocaleString()} rows</span>
      )}
    </footer>
  );
}
