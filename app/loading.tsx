/* Renders during navigation to / before the server component finishes
   fetching. Skeleton matches the home page structure so the transition
   doesn't visually shift content. */

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 space-y-3">
        <div className="ds-skeleton h-7 w-44" />
        <div className="ds-skeleton h-9 w-48" />
        <div className="ds-skeleton h-4 w-[28rem] max-w-full" />
      </header>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle bg-bg-elevated px-5 py-3">
          <div className="flex gap-8">
            <div className="ds-skeleton h-3 w-16" />
            <div className="ds-skeleton h-3 w-16" />
            <div className="ds-skeleton h-3 w-16" />
            <div className="ds-skeleton h-3 w-20" />
            <div className="ds-skeleton h-3 w-20" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-8 border-b border-border-subtle px-5 py-4 last:border-0"
          >
            <div className="ds-skeleton h-4 w-36" />
            <div className="ds-skeleton h-4 w-20" />
            <div className="ds-skeleton h-5 w-24 rounded-full" />
            <div className="ds-skeleton h-4 w-12" />
            <div className="ds-skeleton h-4 w-28" />
          </div>
        ))}
      </div>
    </main>
  );
}
