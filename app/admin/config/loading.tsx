export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-4">
        <div className="ds-skeleton h-6 w-32 rounded-full" />
      </div>
      <header className="mb-8">
        <div className="ds-skeleton mb-3 h-5 w-16 rounded-full" />
        <div className="ds-skeleton h-9 w-72" />
        <div className="ds-skeleton mt-3 h-4 w-[36rem] max-w-full" />
      </header>
      <div className="mb-8 rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-6 py-5">
          <div className="ds-skeleton h-5 w-40" />
        </div>
        <div className="space-y-2 px-6 py-5">
          <div className="ds-skeleton h-4 w-3/4" />
          <div className="ds-skeleton h-4 w-1/2" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle bg-bg-elevated px-4 py-3">
          <div className="ds-skeleton h-3 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-8 border-b border-border-subtle px-4 py-3 last:border-0"
          >
            <div className="ds-skeleton h-4 w-12" />
            <div className="ds-skeleton h-4 w-48" />
            <div className="ds-skeleton h-4 w-28" />
            <div className="ds-skeleton h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </main>
  );
}
