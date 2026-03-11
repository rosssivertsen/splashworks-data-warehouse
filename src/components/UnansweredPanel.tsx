interface UnansweredPanelProps {
  reason: string;
  hint: string | null;
}

export function UnansweredPanel({ reason, hint }: UnansweredPanelProps) {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-2">
      <p className="text-sm text-blue-800">{reason}</p>
      {hint && (
        <p className="text-sm text-blue-700">
          <span className="font-medium">What I can tell you:</span> {hint}
        </p>
      )}
    </div>
  );
}
