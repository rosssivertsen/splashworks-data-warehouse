import { useState } from "react";
import { apiClient, UnansweredQueryError } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import { SqlEditor } from "../components/SqlEditor";
import { ExportButton } from "../components/ExportButton";
import { StarterPrompts } from "../components/StarterPrompts";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { UnansweredPanel } from "../components/UnansweredPanel";
import type { QueryResponse } from "../types/api";

interface QueryViewProps {
  onAddToDashboard?: (title: string, sql: string, results: { columns: string[]; rows: (string | number | boolean | null)[][] }) => void;
}

interface UnansweredInfo {
  reason: string;
  hint: string | null;
}

export function QueryView({ onAddToDashboard }: QueryViewProps) {
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [unanswered, setUnanswered] = useState<UnansweredInfo | null>(null);

  const handleQueryResult = (resp: QueryResponse) => {
    setSql(resp.sql);
    setExplanation(resp.explanation);
    setResult(resp);
    setUnanswered(null);
  };

  const handleQueryError = (err: unknown) => {
    if (err instanceof UnansweredQueryError) {
      setUnanswered({ reason: err.message, hint: err.partialAnswerHint });
      setError(null);
      setSql("");
      setExplanation("");
    } else {
      setError(err instanceof Error ? err.message : String(err));
      setUnanswered(null);
    }
    setResult(null);
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setHasQueried(true);
    setLoading(true);
    setError(null);
    setUnanswered(null);
    try {
      const resp = await apiClient.query(question);
      handleQueryResult(resp);
    } catch (err) {
      handleQueryError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSql = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.queryRaw(sql);
      setResult(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setQuestion(prompt);
    // Auto-submit after a tick so the input updates visually
    setTimeout(() => {
      setHasQueried(true);
      setLoading(true);
      setError(null);
      setUnanswered(null);
      apiClient.query(prompt).then((resp) => {
        handleQueryResult(resp);
        setLoading(false);
      }).catch((err) => {
        handleQueryError(err);
        setLoading(false);
      });
    }, 0);
  };

  return (
    <div className="space-y-4">
      {!hasQueried && <StarterPrompts onSelect={handlePromptSelect} />}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleAsk();
          }}
          placeholder="Ask a question about your data..."
          className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {unanswered && (
        <UnansweredPanel reason={unanswered.reason} hint={unanswered.hint} />
      )}

      {sql && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-neutral-700">Generated SQL</h3>
              <ConfidenceBadge confidence={result?.confidence ?? null} />
            </div>
            <button
              onClick={handleRunSql}
              disabled={loading || !sql.trim()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run SQL
            </button>
          </div>
          {explanation && (
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-500 hover:text-neutral-700 select-none">
                How I interpreted this
              </summary>
              <p className="mt-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-600">
                {explanation}
              </p>
            </details>
          )}
          <SqlEditor value={sql} onChange={setSql} onRun={handleRunSql} />
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">
              Results ({result.row_count} rows)
            </h3>
            <div className="flex gap-2">
              {onAddToDashboard && (
                <button
                  onClick={() => onAddToDashboard(question || "Query Result", sql, { columns: result.columns, rows: result.results })}
                  className="px-3 py-1.5 text-sm border border-primary-300 text-primary-700 rounded-md hover:bg-primary-50"
                >
                  + Dashboard
                </button>
              )}
              <ExportButton columns={result.columns} rows={result.results} filename="query-results" />
            </div>
          </div>
          <ResultsTable columns={result.columns} rows={result.results} />
        </div>
      )}
    </div>
  );
}
