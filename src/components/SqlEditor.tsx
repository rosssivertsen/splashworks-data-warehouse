import { useCallback, type KeyboardEvent, type ChangeEvent } from "react";

interface SqlEditorProps {
  value: string;
  onChange: (v: string) => void;
  onRun?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  readOnly = false,
  placeholder,
}: SqlEditorProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter to run
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onRun) {
        e.preventDefault();
        onRun();
        return;
      }

      // Tab inserts 2 spaces
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        onChange(newValue);
        // Move cursor after inserted spaces
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange, onRun]
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        className="w-full min-h-[120px] p-3 font-mono text-sm bg-neutral-900 text-neutral-100 rounded-md border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        spellCheck={false}
      />
      {onRun && !readOnly && (
        <span className="absolute bottom-3 right-3 text-xs text-neutral-500">
          Ctrl+Enter to run
        </span>
      )}
    </div>
  );
}
