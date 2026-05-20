/* Renders during navigation to /campaigns/[id]/excluded. The excluded
   list is the heaviest query in the app (potentially thousands of Score
   rows), so this skeleton matters most. */

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-4">
        <div className="ds-skeleton h-4 w-32" />
      </div>

      <header className="mb-6 space-y-2">
        <div className="ds-skeleton h-3 w-64" />
        <div className="ds-skeleton h-9 w-48" />
        <div className="ds-skeleton h-4 w-96 max-w-full" />
      </header>

      {/* Reason badge strip */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ds-skeleton h-6 w-28 rounded-full" />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle bg-bg-elevated px-4 py-3">
          <div className="flex gap-8">
            <div className="ds-skeleton h-3 w-20" />
            <div className="ds-skeleton h-3 w-10" />
            <div className="ds-skeleton h-3 w-16" />
            <div className="ds-skeleton h-3 w-16" />
            <div className="ds-skeleton h-3 w-16" />
            <div className="ds-skeleton h-3 w-32" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-8 border-b border-border-subtle px-4 py-3 last:border-0"
          >
            <div className="ds-skeleton h-4 w-40" />
            <div className="ds-skeleton h-4 w-8" />
            <div className="ds-skeleton h-4 w-16" />
            <div className="ds-skeleton h-4 w-12" />
            <div className="ds-skeleton h-4 w-14" />
            <div className="ds-skeleton h-4 w-64" />
          </div>
        ))}
      </div>
    </main>
  );
}
