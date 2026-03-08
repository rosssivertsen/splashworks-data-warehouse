import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import { ExportButton } from "../components/ExportButton";
import type { QueryResponse } from "../types/api";

const STORAGE_KEY = "splashworks_dashboard_cards";

interface DashboardCard {
  id: string;
  title: string;
  sql: string;
  result: QueryResponse | null;
  error: string | null;
  loading: boolean;
  showSql: boolean;
}

interface SavedCard {
  id: string;
  title: string;
  sql: string;
}

function loadSavedCards(): SavedCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedCard[];
  } catch {
    return [];
  }
}

function saveToPersistence(cards: DashboardCard[]) {
  const toSave: SavedCard[] = cards.map((c) => ({ id: c.id, title: c.title, sql: c.sql }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function DashboardView() {
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newSql, setNewSql] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const refreshCard = useCallback(async (card: DashboardCard): Promise<DashboardCard> => {
    try {
      const resp = await apiClient.queryRaw(card.sql);
      return { ...card, result: resp, error: null, loading: false };
    } catch (err) {
      return {
        ...card,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      };
    }
  }, []);

  // Load from localStorage on mount and refresh each card
  useEffect(() => {
    const saved = loadSavedCards();
    if (saved.length === 0) return;

    const initial: DashboardCard[] = saved.map((s) => ({
      ...s,
      result: null,
      error: null,
      loading: true,
      showSql: false,
    }));
    setCards(initial);

    // Refresh all cards
    Promise.all(initial.map(refreshCard)).then(setCards);
  }, [refreshCard]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newSql.trim()) return;
    setAddLoading(true);
    try {
      const resp = await apiClient.queryRaw(newSql);
      const card: DashboardCard = {
        id: Date.now().toString(),
        title: newTitle,
        sql: newSql,
        result: resp,
        error: null,
        loading: false,
        showSql: false,
      };
      const updated = [...cards, card];
      setCards(updated);
      saveToPersistence(updated);
      setNewTitle("");
      setNewSql("");
    } catch (err) {
      // Still add the card but show the error
      const card: DashboardCard = {
        id: Date.now().toString(),
        title: newTitle,
        sql: newSql,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
        showSql: false,
      };
      const updated = [...cards, card];
      setCards(updated);
      saveToPersistence(updated);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = (id: string) => {
    const updated = cards.filter((c) => c.id !== id);
    setCards(updated);
    saveToPersistence(updated);
  };

  const handleRefresh = async (id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, loading: true } : c))
    );
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const refreshed = await refreshCard(card);
    setCards((prev) => prev.map((c) => (c.id === id ? refreshed : c)));
  };

  const toggleSql = (id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, showSql: !c.showSql } : c))
    );
  };

  return (
    <div className="space-y-6">
      {/* Add card form */}
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-md space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">Add Dashboard Card</h3>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Card title"
          className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={newSql}
          onChange={(e) => setNewSql(e.target.value)}
          placeholder="SQL query"
          className="w-full min-h-[80px] px-3 py-2 border border-neutral-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
        <button
          onClick={handleAdd}
          disabled={addLoading || !newTitle.trim() || !newSql.trim()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {addLoading ? "Adding..." : "Add Card"}
        </button>
      </div>

      {/* Cards grid */}
      {cards.length === 0 ? (
        <p className="text-neutral-500 italic">No cards yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="border border-neutral-200 rounded-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <h4 className="font-medium text-neutral-800">{card.title}</h4>
                <div className="flex items-center gap-2">
                  {card.result && (
                    <ExportButton
                      columns={card.result.columns}
                      rows={card.result.results}
                      filename={card.title.toLowerCase().replace(/\s+/g, "-")}
                    />
                  )}
                  <button
                    onClick={() => handleRefresh(card.id)}
                    disabled={card.loading}
                    className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100 disabled:opacity-40"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => toggleSql(card.id)}
                    className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100"
                  >
                    SQL
                  </button>
                  <button
                    onClick={() => handleRemove(card.id)}
                    className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {card.showSql && (
                <div className="px-4 py-2 bg-neutral-900 text-neutral-200 font-mono text-xs whitespace-pre-wrap">
                  {card.sql}
                </div>
              )}

              <div className="p-4">
                {card.loading && (
                  <p className="text-neutral-500 text-sm">Loading...</p>
                )}
                {card.error && (
                  <p className="text-red-600 text-sm">{card.error}</p>
                )}
                {card.result && (
                  <ResultsTable
                    columns={card.result.columns}
                    rows={card.result.results}
                    pageSize={10}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
