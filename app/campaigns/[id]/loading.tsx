/* Renders during navigation to /campaigns/[id] while the server component
   queries Prisma. Skeleton matches the detail page (back link, header
   with status badge, brief summary cards, inventory card). */

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-4">
        <div className="ds-skeleton h-4 w-32" />
      </div>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="ds-skeleton h-3 w-72" />
          <div className="ds-skeleton h-9 w-56" />
        </div>
        <div className="ds-skeleton h-6 w-28 rounded-full" />
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-bg-surface">
          <div className="border-b border-border-subtle px-6 py-4">
            <div className="ds-skeleton h-4 w-16" />
          </div>
          <div className="space-y-3 px-6 py-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="ds-skeleton h-3 w-24" />
                <div className="ds-skeleton h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface">
          <div className="border-b border-border-subtle px-6 py-4">
            <div className="ds-skeleton h-4 w-32" />
          </div>
          <div className="space-y-2 px-6 py-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border border-border-subtle bg-bg-input/40 p-3"
              >
                <div className="ds-skeleton mb-2 h-4 w-3/4" />
                <div className="ds-skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="rounded-xl border border-border-subtle bg-bg-surface">
          <div className="border-b border-border-subtle px-6 py-4">
            <div className="ds-skeleton h-4 w-40" />
          </div>
          <div className="px-6 py-5">
            <div className="ds-skeleton h-10 w-64" />
          </div>
        </div>
      </section>
    </main>
  );
}
