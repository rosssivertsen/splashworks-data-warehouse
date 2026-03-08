import { useState } from "react";
import { QueryView } from "./views/QueryView";
import { ExplorerView } from "./views/ExplorerView";
import { DataView } from "./views/DataView";
import { DashboardView } from "./views/DashboardView";
import { StatusBar } from "./components/StatusBar";

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

const VIEW_COMPONENTS: Record<Tab, React.ComponentType> = {
  "ai-query": QueryView,
  "db-explorer": ExplorerView,
  "data-explorer": DataView,
  dashboard: DashboardView,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("ai-query");

  const ActiveView = VIEW_COMPONENTS[activeTab];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-primary-700">
          Splashworks Warehouse
        </h1>
      </header>

      {/* Tab Navigation */}
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

      {/* Content */}
      <main className="flex-1 p-6">
        <ActiveView />
      </main>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
