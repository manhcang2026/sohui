export function PeriodFeeSummary({ value }: { value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-sm font-medium">Tiền thảo</p>
      <p className="shrink-0 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
