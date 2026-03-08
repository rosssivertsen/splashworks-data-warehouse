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
