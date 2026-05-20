/* The /campaigns/new page is mostly a client form, but we still hit this
   skeleton during the brief flash before BriefForm hydrates. Matches the
   two-column layout. */

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6">
        <div className="ds-skeleton h-4 w-32" />
      </div>

      <header className="mb-8 max-w-3xl space-y-2">
        <div className="ds-skeleton h-9 w-56" />
        <div className="ds-skeleton h-4 w-[32rem] max-w-full" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border-subtle bg-bg-surface"
            >
              <div className="flex items-start gap-4 border-b border-border-subtle px-6 py-5">
                <div className="ds-skeleton h-7 w-7 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <div className="ds-skeleton h-4 w-32" />
                  <div className="ds-skeleton h-3 w-72 max-w-full" />
                </div>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div className="ds-skeleton h-9 w-full" />
                <div className="ds-skeleton h-9 w-full" />
              </div>
            </div>
          ))}
        </div>

        <aside>
          <div className="rounded-xl border border-border-subtle bg-bg-surface">
            <div className="border-b border-border-subtle px-6 py-5">
              <div className="ds-skeleton h-4 w-24" />
            </div>
            <div className="space-y-4 px-6 py-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <div className="ds-skeleton mb-1.5 h-3 w-16" />
                  <div className="ds-skeleton h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
