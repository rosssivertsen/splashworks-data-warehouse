import { useState, useRef, useEffect } from "react";
import { apiClient } from "../services/ApiClient";
import { ChartCard } from "../components/ChartCard";
import { useDashboards } from "../hooks/useDashboards";

const SAMPLE_CARDS = [
  {
    title: "Active Customers by Company",
    sql: "SELECT _company_name, COUNT(*) AS active_customers FROM public_warehouse.dim_customer WHERE is_inactive = 0 GROUP BY _company_name ORDER BY _company_name",
  },
  {
    title: "Average Minutes per Stop",
    sql: "SELECT _company_name, ROUND(AVG(minutes_at_stop)::numeric, 1) AS avg_minutes FROM public_warehouse.fact_service_stop WHERE service_status = 1 GROUP BY _company_name",
  },
  {
    title: "Payment Methods",
    sql: "SELECT payment_method, COUNT(*) AS count, SUM(amount) AS total FROM public_warehouse.fact_payment GROUP BY payment_method ORDER BY count DESC",
  },
];

export function DashboardView() {
  const {
    dashboards,
    activeDashboard,
    activeId,
    createDashboard,
    renameDashboard,
    deleteDashboard,
    setActiveDashboard,
    addCard,
    updateCard,
    removeCard,
  } = useDashboards();

  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardSql, setNewCardSql] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [sampleLoading, setSampleLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Create sample dashboard on first visit
  useEffect(() => {
    if (dashboards.length === 0 && !sampleLoading) {
      setSampleLoading(true);
      createDashboard("Operations Overview");
    }
  }, [dashboards.length, createDashboard, sampleLoading]);

  // Load sample cards into newly created empty dashboard
  useEffect(() => {
    if (
      sampleLoading &&
      activeDashboard &&
      activeDashboard.name === "Operations Overview" &&
      activeDashboard.cards.length === 0
    ) {
      const loadSampleCards = async () => {
        for (const sample of SAMPLE_CARDS) {
          try {
            const resp = await apiClient.queryRaw(sample.sql);
            addCard(activeDashboard.id, {
              title: sample.title,
              sql: sample.sql,
              results: { columns: resp.columns, rows: resp.results },
            });
          } catch {
            addCard(activeDashboard.id, {
              title: sample.title,
              sql: sample.sql,
              results: null,
            });
          }
        }
        setSampleLoading(false);
      };
      loadSampleCards();
    }
  }, [sampleLoading, activeDashboard, addCard]);

  const handleAddCard = async () => {
    if (!activeDashboard || !newCardTitle.trim() || !newCardSql.trim()) return;
    setAddLoading(true);
    try {
      const resp = await apiClient.queryRaw(newCardSql);
      addCard(activeDashboard.id, {
        title: newCardTitle,
        sql: newCardSql,
        results: { columns: resp.columns, rows: resp.results },
      });
    } catch {
      addCard(activeDashboard.id, {
        title: newCardTitle,
        sql: newCardSql,
        results: null,
      });
    } finally {
      setAddLoading(false);
      setNewCardTitle("");
      setNewCardSql("");
      setShowAddForm(false);
    }
  };

  const handleScreenshot = async () => {
    if (!dashboardRef.current || !activeDashboard) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(dashboardRef.current, {
      backgroundColor: "#fafafa",
      scale: 2,
    });
    const link = document.createElement("a");
    const safeName = activeDashboard.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const date = new Date().toISOString().split("T")[0];
    link.download = `${safeName}_${date}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleStartRename = () => {
    if (!activeDashboard) return;
    setNameInput(activeDashboard.name);
    setEditingName(true);
  };

  const handleFinishRename = () => {
    if (activeDashboard && nameInput.trim()) {
      renameDashboard(activeDashboard.id, nameInput.trim());
    }
    setEditingName(false);
  };

  const handleNewDashboard = () => {
    const name = `Dashboard ${dashboards.length + 1}`;
    createDashboard(name);
  };

  const handleDeleteDashboard = () => {
    if (!activeDashboard) return;
    if (!window.confirm(`Delete "${activeDashboard.name}"?`)) return;
    deleteDashboard(activeDashboard.id);
  };

  return (
    <div className="space-y-4">
      {/* Dashboard selector bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={activeId ?? ""}
          onChange={(e) => setActiveDashboard(e.target.value)}
          className="px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {dashboards.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleNewDashboard}
          className="px-3 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-100"
        >
          + New
        </button>

        {activeDashboard && (
          <>
            {editingName ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFinishRename()}
                  onBlur={handleFinishRename}
                  autoFocus
                  className="px-2 py-1 border border-neutral-300 rounded text-sm"
                />
              </div>
            ) : (
              <button
                onClick={handleStartRename}
                className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100"
              >
                Rename
              </button>
            )}

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              + Add Card
            </button>

            <button
              onClick={handleScreenshot}
              className="px-3 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-100"
              title="Download as PNG"
            >
              Screenshot
            </button>

            {dashboards.length > 1 && (
              <button
                onClick={handleDeleteDashboard}
                className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>

      {/* Add card form */}
      {showAddForm && activeDashboard && (
        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-md space-y-3">
          <input
            type="text"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            placeholder="Card title"
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            value={newCardSql}
            onChange={(e) => setNewCardSql(e.target.value)}
            placeholder="SQL query"
            className="w-full min-h-[80px] px-3 py-2 border border-neutral-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddCard}
              disabled={addLoading || !newCardTitle.trim() || !newCardSql.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {addLoading ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dashboard cards */}
      <div ref={dashboardRef}>
        {activeDashboard && activeDashboard.cards.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeDashboard.cards.map((card) => (
              <ChartCard
                key={card.id}
                card={card}
                onUpdate={(updates) =>
                  updateCard(activeDashboard.id, card.id, updates)
                }
                onRemove={() => removeCard(activeDashboard.id, card.id)}
              />
            ))}
          </div>
        ) : activeDashboard && !sampleLoading ? (
          <p className="text-neutral-500 italic">
            No cards yet. Click "+ Add Card" or use "Add to Dashboard" from the
            AI Query or Data Explorer views.
          </p>
        ) : sampleLoading ? (
          <p className="text-neutral-500 italic">Loading sample dashboard...</p>
        ) : null}
      </div>
    </div>
  );
}
