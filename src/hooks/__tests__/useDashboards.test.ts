import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboards } from "../useDashboards";

const STORAGE_KEY = "splashworks_dashboards";

describe("useDashboards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with empty dashboards when no localStorage data", () => {
    const { result } = renderHook(() => useDashboards());
    expect(result.current.dashboards).toEqual([]);
    expect(result.current.activeDashboard).toBeNull();
  });

  it("creates a dashboard", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("My Dashboard");
    });

    expect(result.current.dashboards).toHaveLength(1);
    expect(result.current.dashboards[0].name).toBe("My Dashboard");
    expect(result.current.activeDashboard?.name).toBe("My Dashboard");

    // Verify localStorage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toHaveLength(1);
  });

  it("renames a dashboard", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("Old Name");
    });
    const id = result.current.dashboards[0].id;

    act(() => {
      result.current.renameDashboard(id, "New Name");
    });

    expect(result.current.dashboards[0].name).toBe("New Name");
  });

  it("deletes a dashboard", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("Dashboard 1");
    });
    const id = result.current.dashboards[0].id;

    act(() => {
      result.current.deleteDashboard(id);
    });

    expect(result.current.dashboards).toHaveLength(0);
    expect(result.current.activeDashboard).toBeNull();
  });

  it("adds a card to a dashboard", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("Test");
    });
    const dashId = result.current.dashboards[0].id;

    act(() => {
      result.current.addCard(dashId, {
        title: "Active Customers",
        sql: "SELECT COUNT(*) FROM dim_customer",
        results: { columns: ["count"], rows: [[859]] },
      });
    });

    expect(result.current.dashboards[0].cards).toHaveLength(1);
    expect(result.current.dashboards[0].cards[0].title).toBe("Active Customers");
    expect(result.current.dashboards[0].cards[0].chartType).toBe("table");
  });

  it("updates a card chart type", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("Test");
    });
    const dashId = result.current.dashboards[0].id;

    act(() => {
      result.current.addCard(dashId, {
        title: "Test Card",
        sql: "SELECT 1",
        results: { columns: ["v"], rows: [[1]] },
      });
    });
    const cardId = result.current.dashboards[0].cards[0].id;

    act(() => {
      result.current.updateCard(dashId, cardId, { chartType: "bar" });
    });

    expect(result.current.dashboards[0].cards[0].chartType).toBe("bar");
  });

  it("removes a card", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("Test");
    });
    const dashId = result.current.dashboards[0].id;

    act(() => {
      result.current.addCard(dashId, {
        title: "Card 1",
        sql: "SELECT 1",
        results: null,
      });
    });
    const cardId = result.current.dashboards[0].cards[0].id;

    act(() => {
      result.current.removeCard(dashId, cardId);
    });

    expect(result.current.dashboards[0].cards).toHaveLength(0);
  });

  it("persists to localStorage on every change", () => {
    const { result } = renderHook(() => useDashboards());

    act(() => {
      result.current.createDashboard("Persisted");
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored[0].name).toBe("Persisted");
  });

  it("loads from localStorage on mount", () => {
    // Pre-populate localStorage
    const data = [{
      id: "123",
      name: "Saved Dashboard",
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const { result } = renderHook(() => useDashboards());
    expect(result.current.dashboards).toHaveLength(1);
    expect(result.current.dashboards[0].name).toBe("Saved Dashboard");
  });
});
