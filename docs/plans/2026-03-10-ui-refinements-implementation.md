# UI Refinements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add starter prompts, dashboard cards with ECharts visualization, named dashboard persistence, sample dashboard, and PNG screenshot export to the React frontend.

**Architecture:** New `GET /api/prompts` endpoint serves question strings from YAML. Frontend gets a `useDashboards` hook for named dashboard CRUD in localStorage, a `ChartCard` component wrapping ECharts, a `StarterPrompts` component, and "Add to Dashboard" buttons in QueryView/DataView. DashboardView is rewritten to support named dashboards with chart switching.

**Tech Stack:** React 18, TypeScript, ECharts (`echarts-for-react`), html2canvas, Tailwind CSS, Vitest, FastAPI (Python)

**Design Doc:** `docs/plans/2026-03-10-ui-refinements-design.md`

---

## Key File Paths

**Frontend source:** `src/` (NOT `frontend/src/`)
**Tests:** `src/**/__tests__/*.test.{ts,tsx}`
**API:** `api/`
**Semantic YAML:** `docs/skimmer-semantic-layer.yaml`
**Run frontend tests:** `npm test` (from project root)
**Run API tests:** `cd api && python -m pytest tests/ -v`

---

## Task 1: `GET /api/prompts` Endpoint

**Files:**
- Modify: `api/routers/schema.py`
- Modify: `api/models/responses.py`
- Create: `api/tests/unit/test_prompts.py`

**Context:** The `/api/schema/dictionary` endpoint already reads verified_queries from the YAML but returns full VerifiedQuery objects. The new `/api/prompts` endpoint returns just the question strings — lightweight for the frontend starter prompts.

**Step 1: Add the response model**

In `api/models/responses.py`, add at the end:

```python
class PromptsResponse(BaseModel):
    prompts: list[str]
```

**Step 2: Write a failing test**

Create `api/tests/unit/test_prompts.py`:

```python
"""Unit tests for the /api/prompts endpoint."""


def test_prompts_returns_questions():
    """Verify /api/prompts returns a list of question strings from YAML."""
    from api.services.schema_context import load_semantic_layer

    sl = load_semantic_layer()
    prompts = [vq["question"] for vq in sl.get("verified_queries", [])]
    assert len(prompts) >= 1, "No verified queries in YAML"
    assert all(isinstance(p, str) for p in prompts)
    assert any("active customers" in p.lower() for p in prompts)
```

**Step 3: Run test to verify it passes** (this is a data test, not a route test)

Run: `cd api && python -m pytest tests/unit/test_prompts.py -v`

Expected: PASS

**Step 4: Add the route**

In `api/routers/schema.py`, add the import and route:

```python
# Add to imports at top:
from api.models.responses import (
    BusinessTerm,
    ColumnInfo,
    DictionaryResponse,
    PromptsResponse,
    Relationship,
    SchemaResponse,
    TableInfo,
    VerifiedQuery,
)

# Add new route after get_dictionary():
@router.get("/api/prompts", response_model=PromptsResponse)
def get_prompts():
    """Return starter prompt questions from the semantic layer."""
    sl = load_semantic_layer()
    prompts = [vq.get("question", "") for vq in sl.get("verified_queries", []) if vq.get("question")]
    return PromptsResponse(prompts=prompts)
```

**Step 5: Run all API tests**

Run: `cd api && python -m pytest tests/ -v`

Expected: All pass.

**Step 6: Commit**

```bash
git add api/routers/schema.py api/models/responses.py api/tests/unit/test_prompts.py
git commit -m "feat: GET /api/prompts endpoint — starter prompt questions from YAML"
```

---

## Task 2: ApiClient + Types Update

**Files:**
- Modify: `src/services/ApiClient.ts`
- Modify: `src/types/api.ts`

**Context:** Add `getPrompts()` method to the ApiClient and add the `PromptsResponse` type. Also add dashboard-related types that will be used by later tasks.

**Step 1: Add types to `src/types/api.ts`**

Add at the end of the file:

```typescript
export interface PromptsResponse {
  prompts: string[];
}

export type ChartType = "table" | "bar" | "line" | "pie" | "area";

export interface DashboardCard {
  id: string;
  title: string;
  sql: string;
  results: { columns: string[]; rows: (string | number | boolean | null)[][] } | null;
  chartType: ChartType;
  xColumn: string | null;
  yColumn: string | null;
}

export interface Dashboard {
  id: string;
  name: string;
  cards: DashboardCard[];
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Add `getPrompts()` to `src/services/ApiClient.ts`**

Add after the `getDictionary()` method:

```typescript
  async getPrompts(): Promise<PromptsResponse> {
    return this.request<PromptsResponse>("/prompts", { method: "GET" });
  }
```

Add `PromptsResponse` to the import at top.

**Step 3: Commit**

```bash
git add src/services/ApiClient.ts src/types/api.ts
git commit -m "feat: ApiClient.getPrompts() + dashboard types"
```

---

## Task 3: StarterPrompts Component

**Files:**
- Create: `src/components/StarterPrompts.tsx`
- Create: `src/components/__tests__/StarterPrompts.test.tsx`

**Context:** Clickable pill buttons that load from `/api/prompts` on mount. When clicked, call `onSelect(question)`. Displayed in QueryView above the input field when no query has been submitted yet.

**Step 1: Write the test**

Create `src/components/__tests__/StarterPrompts.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { StarterPrompts } from "../StarterPrompts";

// Mock the ApiClient
vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    getPrompts: vi.fn(),
  },
}));

import { apiClient } from "../../services/ApiClient";

describe("StarterPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompts from API", async () => {
    (apiClient.getPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
      prompts: ["How many active customers?", "Average pool size?"],
    });

    render(<StarterPrompts onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("How many active customers?")).toBeInTheDocument();
      expect(screen.getByText("Average pool size?")).toBeInTheDocument();
    });
  });

  it("calls onSelect when a prompt is clicked", async () => {
    (apiClient.getPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
      prompts: ["How many active customers?"],
    });

    const onSelect = vi.fn();
    render(<StarterPrompts onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("How many active customers?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("How many active customers?"));
    expect(onSelect).toHaveBeenCalledWith("How many active customers?");
  });

  it("renders nothing on API error", async () => {
    (apiClient.getPrompts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

    const { container } = render(<StarterPrompts onSelect={vi.fn()} />);

    // Wait for async operation to complete
    await waitFor(() => {
      expect(apiClient.getPrompts).toHaveBeenCalled();
    });

    // Should render empty or nothing
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/__tests__/StarterPrompts.test.tsx`

Expected: FAIL (module not found)

**Step 3: Write the component**

Create `src/components/StarterPrompts.tsx`:

```tsx
import { useState, useEffect } from "react";
import { apiClient } from "../services/ApiClient";

interface StarterPromptsProps {
  onSelect: (question: string) => void;
}

export function StarterPrompts({ onSelect }: StarterPromptsProps) {
  const [prompts, setPrompts] = useState<string[]>([]);

  useEffect(() => {
    apiClient
      .getPrompts()
      .then((resp) => setPrompts(resp.prompts))
      .catch(() => setPrompts([]));
  }, []);

  if (prompts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-500">Try asking:</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="text-sm bg-white border border-neutral-200 px-3 py-2 rounded-full hover:bg-primary-50 hover:border-primary-300 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/__tests__/StarterPrompts.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/StarterPrompts.tsx src/components/__tests__/StarterPrompts.test.tsx
git commit -m "feat: StarterPrompts component — clickable example questions"
```

---

## Task 4: Wire StarterPrompts into QueryView

**Files:**
- Modify: `src/views/QueryView.tsx`

**Context:** Show StarterPrompts above the input box when no query has been submitted yet. When a prompt is clicked, fill the input and auto-submit.

**Step 1: Update QueryView**

In `src/views/QueryView.tsx`:

1. Import StarterPrompts:
   ```tsx
   import { StarterPrompts } from "../components/StarterPrompts";
   ```

2. Add a `hasQueried` state to track whether the user has submitted anything:
   ```tsx
   const [hasQueried, setHasQueried] = useState(false);
   ```

3. In `handleAsk`, set `hasQueried` to true before the API call:
   ```tsx
   const handleAsk = async () => {
     if (!question.trim()) return;
     setHasQueried(true);
     setLoading(true);
     // ... rest unchanged
   ```

4. Add a handler for prompt selection:
   ```tsx
   const handlePromptSelect = (prompt: string) => {
     setQuestion(prompt);
     // Auto-submit after a tick so the input updates visually
     setTimeout(() => {
       setHasQueried(true);
       setLoading(true);
       setError(null);
       apiClient.query(prompt).then((resp) => {
         setSql(resp.sql);
         setExplanation(resp.explanation);
         setResult(resp);
         setLoading(false);
       }).catch((err) => {
         setError(err instanceof Error ? err.message : String(err));
         setResult(null);
         setLoading(false);
       });
     }, 0);
   };
   ```

5. Render StarterPrompts before the input, conditionally:
   ```tsx
   {/* Before the <div className="flex gap-2"> input row */}
   {!hasQueried && <StarterPrompts onSelect={handlePromptSelect} />}
   ```

**Step 2: Run existing QueryView tests**

Run: `npm test -- --run src/views/__tests__/QueryView.test.tsx`

Expected: PASS (existing tests should still work)

**Step 3: Commit**

```bash
git add src/views/QueryView.tsx
git commit -m "feat: wire StarterPrompts into QueryView — shown before first query"
```

---

## Task 5: `useDashboards` Hook

**Files:**
- Create: `src/hooks/useDashboards.ts`
- Create: `src/hooks/__tests__/useDashboards.test.ts`

**Context:** Hook for named dashboard CRUD with localStorage persistence. Replaces the current flat card list in DashboardView. Supports: create, rename, delete dashboards; add, update, remove cards; auto-save; sample dashboard on first visit.

**Step 1: Write the test**

Create `src/hooks/__tests__/useDashboards.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/hooks/__tests__/useDashboards.test.ts`

Expected: FAIL (module not found)

**Step 3: Write the hook**

Create `src/hooks/useDashboards.ts`:

```ts
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

  const createDashboard = useCallback((name: string) => {
    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: Date.now().toString(),
      name,
      cards: [],
      createdAt: now,
      updatedAt: now,
    };
    setDashboards((prev) => [...prev, dashboard]);
    setActiveId(dashboard.id);
  }, []);

  const renameDashboard = useCallback((id: string, name: string) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d
      )
    );
  }, []);

  const deleteDashboard = useCallback((id: string) => {
    setDashboards((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      return updated;
    });
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/hooks/__tests__/useDashboards.test.ts`

Expected: PASS (all 9 tests)

**Step 5: Commit**

```bash
git add src/hooks/useDashboards.ts src/hooks/__tests__/useDashboards.test.ts
git commit -m "feat: useDashboards hook — named dashboard CRUD with localStorage"
```

---

## Task 6: ChartCard Component

**Files:**
- Create: `src/components/ChartCard.tsx`
- Create: `src/components/__tests__/ChartCard.test.tsx`

**Context:** A dashboard card that shows: title (editable), chart type toolbar (table/bar/line/pie/area), column mapping dropdowns (X and Y axis), the chart visualization (ECharts), and the data table underneath. Always shows the table; chart appears above when a non-table type is selected.

**Step 1: Write the test**

Create `src/components/__tests__/ChartCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChartCard } from "../ChartCard";
import type { DashboardCard } from "../../types/api";

const mockCard: DashboardCard = {
  id: "1",
  title: "Test Card",
  sql: "SELECT _company_name, COUNT(*) AS cnt FROM dim_customer GROUP BY _company_name",
  results: {
    columns: ["_company_name", "cnt"],
    rows: [
      ["AQPS", 859],
      ["JOMO", 2402],
    ],
  },
  chartType: "table",
  xColumn: null,
  yColumn: null,
};

describe("ChartCard", () => {
  it("renders card title", () => {
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText("Test Card")).toBeInTheDocument();
  });

  it("renders results table", () => {
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText("AQPS")).toBeInTheDocument();
    expect(screen.getByText("2402")).toBeInTheDocument();
  });

  it("renders chart type buttons", () => {
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /bar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pie/i })).toBeInTheDocument();
  });

  it("calls onUpdate when chart type changes", () => {
    const onUpdate = vi.fn();
    render(
      <ChartCard card={mockCard} onUpdate={onUpdate} onRemove={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /bar/i }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ chartType: "bar" }));
  });

  it("calls onRemove when remove is clicked", () => {
    const onRemove = vi.fn();
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/__tests__/ChartCard.test.tsx`

Expected: FAIL

**Step 3: Write the component**

Create `src/components/ChartCard.tsx`:

```tsx
import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { ResultsTable } from "./ResultsTable";
import type { DashboardCard, ChartType } from "../types/api";

interface ChartCardProps {
  card: DashboardCard;
  onUpdate: (updates: Partial<DashboardCard>) => void;
  onRemove: () => void;
}

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "table", label: "Table" },
  { type: "bar", label: "Bar" },
  { type: "line", label: "Line" },
  { type: "pie", label: "Pie" },
  { type: "area", label: "Area" },
];

function buildChartOption(
  card: DashboardCard,
  xCol: string,
  yCol: string
): object | null {
  if (!card.results || card.chartType === "table") return null;

  const { columns, rows } = card.results;
  const xIdx = columns.indexOf(xCol);
  const yIdx = columns.indexOf(yCol);
  if (xIdx === -1 || yIdx === -1) return null;

  const xData = rows.map((r) => String(r[xIdx] ?? ""));
  const yData = rows.map((r) => Number(r[yIdx]) || 0);

  if (card.chartType === "pie") {
    return {
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          data: xData.map((name, i) => ({ name, value: yData[i] })),
          radius: "60%",
        },
      ],
    };
  }

  return {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: xData },
    yAxis: { type: "value" },
    series: [
      {
        type: card.chartType === "area" ? "line" : card.chartType,
        data: yData,
        areaStyle: card.chartType === "area" ? {} : undefined,
      },
    ],
  };
}

export function ChartCard({ card, onUpdate, onRemove }: ChartCardProps) {
  const [showSql, setShowSql] = useState(false);

  const columns = card.results?.columns ?? [];
  // Auto-select first string-like column for X and first numeric column for Y
  const effectiveX =
    card.xColumn && columns.includes(card.xColumn) ? card.xColumn : columns[0] ?? null;
  const effectiveY =
    card.yColumn && columns.includes(card.yColumn) ? card.yColumn : columns[1] ?? null;

  const chartOption =
    effectiveX && effectiveY ? buildChartOption(card, effectiveX, effectiveY) : null;

  return (
    <div className="border border-neutral-200 rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <h4 className="font-medium text-neutral-800">{card.title}</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSql(!showSql)}
            className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100"
          >
            SQL
          </button>
          <button
            onClick={onRemove}
            className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
            aria-label="Remove"
          >
            Remove
          </button>
        </div>
      </div>

      {/* SQL collapsible */}
      {showSql && (
        <div className="px-4 py-2 bg-neutral-900 text-neutral-200 font-mono text-xs whitespace-pre-wrap">
          {card.sql}
        </div>
      )}

      {/* Chart type toolbar + column mapping */}
      {card.results && (
        <div className="px-4 py-2 border-b border-neutral-200 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {CHART_TYPES.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => onUpdate({ chartType: type })}
                aria-label={label}
                className={`px-2 py-1 text-xs rounded ${
                  card.chartType === type
                    ? "bg-primary-600 text-white"
                    : "border border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {card.chartType !== "table" && (
            <div className="flex items-center gap-2 text-xs">
              <label className="text-neutral-500">X:</label>
              <select
                value={effectiveX ?? ""}
                onChange={(e) => onUpdate({ xColumn: e.target.value })}
                className="px-1 py-0.5 border border-neutral-300 rounded text-xs"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <label className="text-neutral-500">Y:</label>
              <select
                value={effectiveY ?? ""}
                onChange={(e) => onUpdate({ yColumn: e.target.value })}
                className="px-1 py-0.5 border border-neutral-300 rounded text-xs"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Chart visualization */}
      {chartOption && card.chartType !== "table" && (
        <div className="px-4 py-2">
          <ReactECharts option={chartOption} style={{ height: 250 }} />
        </div>
      )}

      {/* Data table (always visible) */}
      <div className="p-4">
        {card.results ? (
          <ResultsTable
            columns={card.results.columns}
            rows={card.results.rows}
            pageSize={10}
          />
        ) : (
          <p className="text-neutral-500 text-sm italic">No data</p>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/__tests__/ChartCard.test.tsx`

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/components/ChartCard.tsx src/components/__tests__/ChartCard.test.tsx
git commit -m "feat: ChartCard component — table + ECharts visualization with type switching"
```

---

## Task 7: Rewrite DashboardView

**Files:**
- Modify: `src/views/DashboardView.tsx`

**Context:** Replace the current flat card list with named dashboards powered by the `useDashboards` hook and `ChartCard` component. Add: dashboard selector dropdown, new dashboard creation, inline rename, new card form, PNG screenshot button. On first visit (no data in localStorage), create a sample "Operations Overview" dashboard.

This is the largest task. The current DashboardView is 234 lines and will be substantially rewritten.

**Step 1: Rewrite `src/views/DashboardView.tsx`**

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
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
```

**Step 2: Run existing DashboardView tests**

Run: `npm test -- --run src/views/__tests__/DashboardView.test.tsx`

Expected: Tests may need updating since the component structure changed significantly. Read and update tests as needed.

**Step 3: Commit**

```bash
git add src/views/DashboardView.tsx
git commit -m "feat: rewrite DashboardView — named dashboards, ChartCard, screenshot, sample dashboard"
```

---

## Task 8: "Add to Dashboard" Buttons

**Files:**
- Modify: `src/views/QueryView.tsx`
- Modify: `src/views/DataView.tsx`
- Modify: `src/App.tsx`

**Context:** After running a query in QueryView or DataView, show an "Add to Dashboard" button. When clicked, it needs to add the card to the active dashboard. This requires lifting the `useDashboards` hook to App.tsx and passing `addCard` down via props.

**Step 1: Lift useDashboards to App.tsx**

In `src/App.tsx`, import and use the hook at the App level, then pass the `addCard` function and `dashboards` list down as props to QueryView, DataView, and DashboardView.

Update `App.tsx`:

```tsx
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
    const target = dashboardState.activeDashboard;
    if (!target) {
      // Create a dashboard if none exists
      dashboardState.createDashboard("My Dashboard");
    }
    // Use the active dashboard (or the newly created one)
    const dashId = dashboardState.activeId ?? dashboardState.dashboards[0]?.id;
    if (dashId) {
      dashboardState.addCard(dashId, { title, sql, results });
    }
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
```

**Step 2: Update QueryView to accept `onAddToDashboard` prop**

Add the prop to QueryView's interface and render an "Add to Dashboard" button next to the ExportButton when results exist:

```tsx
interface QueryViewProps {
  onAddToDashboard?: (title: string, sql: string, results: { columns: string[]; rows: (string | number | boolean | null)[][] }) => void;
}

export function QueryView({ onAddToDashboard }: QueryViewProps) {
  // ... existing code ...

  // In the results section, add after ExportButton:
  {onAddToDashboard && (
    <button
      onClick={() => onAddToDashboard(question || "Query Result", sql, { columns: result.columns, rows: result.results })}
      className="px-3 py-1.5 text-sm border border-primary-300 text-primary-700 rounded-md hover:bg-primary-50"
    >
      + Dashboard
    </button>
  )}
```

**Step 3: Update DataView similarly**

Add the same `onAddToDashboard` prop pattern to DataView.

**Step 4: Update DashboardView to receive `dashboardState` as prop**

Instead of calling `useDashboards()` internally, DashboardView receives the state as a prop. Remove the internal `useDashboards()` call and destructure from props:

```tsx
import type { useDashboards } from "../hooks/useDashboards";

interface DashboardViewProps {
  dashboardState: ReturnType<typeof useDashboards>;
}

export function DashboardView({ dashboardState }: DashboardViewProps) {
  const {
    dashboards, activeDashboard, activeId, createDashboard,
    renameDashboard, deleteDashboard, setActiveDashboard,
    addCard, updateCard, removeCard,
  } = dashboardState;
  // ... rest unchanged
```

**Step 5: Update tests as needed**

Existing tests for QueryView, DataView, DashboardView, and App may need prop updates. Update mocks and renders to pass the new props.

**Step 6: Run all frontend tests**

Run: `npm test -- --run`

Expected: All pass.

**Step 7: Commit**

```bash
git add src/App.tsx src/views/QueryView.tsx src/views/DataView.tsx src/views/DashboardView.tsx
git commit -m "feat: Add to Dashboard from QueryView and DataView"
```

---

## Task 9: Update Frontend Tests

**Files:**
- Modify: `src/views/__tests__/DashboardView.test.tsx`
- Modify: `src/views/__tests__/QueryView.test.tsx`
- Modify: `src/views/__tests__/DataView.test.tsx`
- Modify: `src/__tests__/App.test.tsx`

**Context:** The component API changes from Tasks 4, 7, and 8 may break existing tests. Read each test file, understand what it tests, and update to match the new component interfaces (props, structure).

**Step 1: Read all test files**

Read each test file listed above to understand current assertions.

**Step 2: Update tests to match new APIs**

- DashboardView tests: now receives `dashboardState` prop — mock `useDashboards` return value
- QueryView tests: now receives `onAddToDashboard` prop — pass `vi.fn()` or omit
- DataView tests: now receives `onAddToDashboard` prop — pass `vi.fn()` or omit
- App tests: update to account for the lifted `useDashboards` hook

**Step 3: Run all frontend tests**

Run: `npm test -- --run`

Expected: All pass.

**Step 4: Commit**

```bash
git add src/views/__tests__/ src/__tests__/
git commit -m "test: update frontend tests for dashboard and prompt changes"
```

---

## Task 10: E2E Test for Prompts Endpoint

**Files:**
- Modify: `api/tests/e2e/test_enrichment.py`

**Context:** Add one E2E test that hits `/api/prompts` on the live API and verifies it returns question strings.

**Step 1: Add the test**

In `api/tests/e2e/test_enrichment.py`, add to the `TestEnrichmentModels` class:

```python
def test_prompts_endpoint(self):
    """Verify /api/prompts returns starter questions from YAML."""
    resp = requests.get(f"{BASE_URL}/api/prompts", timeout=10)
    assert resp.status_code == 200

    body = resp.json()
    assert "prompts" in body
    assert len(body["prompts"]) >= 1, "No prompts returned"
    assert all(isinstance(p, str) for p in body["prompts"])
    # Should include at least one known verified query
    prompts_lower = [p.lower() for p in body["prompts"]]
    assert any("active customers" in p for p in prompts_lower), (
        f"Expected 'active customers' prompt. Got: {body['prompts']}"
    )
```

**Step 2: Run test locally (will skip)**

Run: `cd api && python -m pytest tests/e2e/test_enrichment.py::TestEnrichmentModels::test_prompts_endpoint -v`

Expected: SKIP (no live API)

**Step 3: Commit**

```bash
git add api/tests/e2e/test_enrichment.py
git commit -m "test: E2E test for /api/prompts endpoint"
```

---

## Task 11: Build, Deploy, and Validate

**Context:** Build the frontend, deploy everything to VPS, run all E2E tests, and verify the full stack works.

**Step 1: Build frontend locally**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors.

**Step 2: Run all frontend tests**

Run: `npm test -- --run`

Expected: All pass.

**Step 3: Run all API tests**

Run: `cd api && python -m pytest tests/ -v`

Expected: All pass.

**Step 4: Push and deploy to VPS**

```bash
git push origin feature/warehouse-etl
ssh root@76.13.29.44 "cd /opt/splashworks && git pull origin feature/warehouse-etl"
ssh root@76.13.29.44 "cd /opt/splashworks && docker compose up -d --build api frontend"
```

**Step 5: Run E2E tests on VPS**

```bash
ssh root@76.13.29.44 "cd /opt/splashworks && API_BASE_URL=http://localhost:8080 python3 -m pytest api/tests/e2e/ -v"
```

Expected: 16/16 pass (15 existing + 1 new prompts test).

**Step 6: Manual verification**

Open `https://app.splshwrks.com` in browser:
1. See starter prompts on AI Query tab
2. Click one — results appear
3. Click "+ Dashboard" — card added to dashboard
4. Switch to Dashboard tab — see sample dashboard with 3 cards
5. Switch a card to "Bar" chart type — EChart renders
6. Click "Screenshot" — PNG downloads
7. Create a new dashboard, add a card, refresh — dashboard persists

**Step 7: Commit any fixes**

Only if deployment revealed issues.

---

## Task 12: Update Progress

**Files:**
- Modify: `docs/plans/PROGRESS.md`

**Step 1: Add UI refinements section to PROGRESS.md**

**Step 2: Commit**

```bash
git add docs/plans/PROGRESS.md
git commit -m "docs: update progress — UI refinements batch complete"
```
