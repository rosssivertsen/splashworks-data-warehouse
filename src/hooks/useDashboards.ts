import { useState, useCallback, useEffect } from "react";
import type { Dashboard, DashboardCard, ChartType } from "../types/api";

const STORAGE_KEY = "splashworks_dashboards";

function loadFromStorage(): Dashboard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Dashboard[];
  } catch {
    return [];
  }
}

function saveToStorage(dashboards: Dashboard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
}

interface AddCardInput {
  title: string;
  sql: string;
  results: { columns: string[]; rows: (string | number | boolean | null)[][] } | null;
  chartType?: ChartType;
  xColumn?: string | null;
  yColumn?: string | null;
}

export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(() => loadFromStorage());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadFromStorage();
    return saved.length > 0 ? saved[0].id : null;
  });

  // Persist on every change
  useEffect(() => {
    saveToStorage(dashboards);
  }, [dashboards]);

  const activeDashboard = dashboards.find((d) => d.id === activeId) ?? null;

  const createDashboard = useCallback((name: string): string => {
    const now = new Date().toISOString();
    const id = Date.now().toString();
    const dashboard: Dashboard = {
      id,
      name,
      cards: [],
      createdAt: now,
      updatedAt: now,
    };
    setDashboards((prev) => [...prev, dashboard]);
    setActiveId(id);
    return id;
  }, []);

  const renameDashboard = useCallback((id: string, name: string) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d
      )
    );
  }, []);

  const deleteDashboard = useCallback((id: string) => {
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    setActiveId((prevId) => (prevId === id ? null : prevId));
  }, []);

  const setActiveDashboard = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const addCard = useCallback((dashboardId: string, input: AddCardInput) => {
    const card: DashboardCard = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      title: input.title,
      sql: input.sql,
      results: input.results,
      chartType: input.chartType ?? "table",
      xColumn: input.xColumn ?? null,
      yColumn: input.yColumn ?? null,
    };
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === dashboardId
          ? { ...d, cards: [...d.cards, card], updatedAt: new Date().toISOString() }
          : d
      )
    );
  }, []);

  const updateCard = useCallback(
    (dashboardId: string, cardId: string, updates: Partial<DashboardCard>) => {
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === dashboardId
            ? {
                ...d,
                cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
                updatedAt: new Date().toISOString(),
              }
            : d
        )
      );
    },
    []
  );

  const removeCard = useCallback((dashboardId: string, cardId: string) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === dashboardId
          ? {
              ...d,
              cards: d.cards.filter((c) => c.id !== cardId),
              updatedAt: new Date().toISOString(),
            }
          : d
      )
    );
  }, []);

  return {
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
  };
}
