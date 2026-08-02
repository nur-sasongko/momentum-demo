export function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
