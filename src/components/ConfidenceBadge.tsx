interface ConfidenceBadgeProps {
  confidence: string | null | undefined;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (!confidence || confidence === "unanswerable") return null;

  if (confidence === "high") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Verified
      </span>
    );
  }

  // medium or low
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Best effort
    </span>
  );
}
