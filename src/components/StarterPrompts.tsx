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
