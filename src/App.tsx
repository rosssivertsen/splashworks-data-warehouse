import { useState } from "react";
import { QueryView } from "./views/QueryView";
import { ExplorerView } from "./views/ExplorerView";
import { DataView } from "./views/DataView";
import { DashboardView } from "./views/DashboardView";
import { StatusBar } from "./components/StatusBar";
import { useDashboards } from "./hooks/useDashboards";

type Tab = "ai-query" | "db-explorer" | "data-explorer" | "dashboard";

interface TabDef {
  id: Tab;
  label: string;
}

const tabs: TabDef[] = [
  { id: "ai-query", label: "AI Query" },
  { id: "db-explorer", label: "Database Explorer" },
  { id: "data-explorer", label: "Data Explorer" },
  { id: "dashboard", label: "Dashboard" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("ai-query");
  const dashboardState = useDashboards();

  const handleAddToDashboard = (title: string, sql: string, results: { columns: string[]; rows: (string | number | boolean | null)[][] }) => {
    let dashId = dashboardState.activeId ?? dashboardState.dashboards[0]?.id;
    if (!dashId) {
      dashId = dashboardState.createDashboard("My Dashboard");
    }
    dashboardState.addCard(dashId, { title, sql, results });
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-primary-700">
          Splashworks Warehouse
        </h1>
      </header>

      <nav className="bg-white border-b border-neutral-200 px-6">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-6">
        {activeTab === "ai-query" && (
          <QueryView onAddToDashboard={handleAddToDashboard} />
        )}
        {activeTab === "db-explorer" && <ExplorerView />}
        {activeTab === "data-explorer" && (
          <DataView onAddToDashboard={handleAddToDashboard} />
        )}
        {activeTab === "dashboard" && (
          <DashboardView dashboardState={dashboardState} />
        )}
      </main>

      <StatusBar />
    </div>
  );
}
