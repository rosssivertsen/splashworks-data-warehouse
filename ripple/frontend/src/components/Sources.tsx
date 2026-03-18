import { useState } from "react";
import type { Source } from "../hooks/useChat";

interface SourcesProps {
  sources: Source[];
}

export default function Sources({ sources }: SourcesProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
          &#9656;
        </span>
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {sources.map((s, i) => (
            <div
              key={i}
              className="text-xs bg-zinc-800/50 rounded px-2 py-1 text-zinc-400"
            >
              <span className="text-zinc-300">{s.file.split("/").pop()}</span>
              {s.heading && (
                <span className="text-zinc-500"> &gt; {s.heading}</span>
              )}
              <span className="text-zinc-600 ml-2">
                {Math.round(s.similarity * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
