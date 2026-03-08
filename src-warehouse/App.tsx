import { useState } from "react";

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

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-neutral-500">
      <p className="text-lg">{name} view not yet implemented</p>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("ai-query");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
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
      <main className="p-6">
        {activeTab === "ai-query" && <Placeholder name="AI Query" />}
        {activeTab === "db-explorer" && <Placeholder name="Database Explorer" />}
        {activeTab === "data-explorer" && <Placeholder name="Data Explorer" />}
        {activeTab === "dashboard" && <Placeholder name="Dashboard" />}
      </main>
    </div>
  );
}
