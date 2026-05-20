import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui/back-link";
import { ConfigEditor } from "@/components/config-editor";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "New Config Version — Domain Selector",
};

export const dynamic = "force-dynamic";

export default async function NewConfigVersionPage() {
  // Pre-fill the editor with the currently active snapshot so the user
  // starts from a known-good baseline. If no active config exists yet
  // (fresh install before seeding), bail with a 404.
  const active = await prisma.activeConfig.findUnique({
    where: { id: "singleton" },
    include: { configVersion: true },
  });
  if (!active || !active.configVersion) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-4">
        <BackLink href="/admin/config">Back to config history</BackLink>
      </nav>

      <header className="mb-8 max-w-2xl">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn-soft px-3 py-1 text-xs uppercase tracking-wider text-warn">
          Admin
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
          New Configuration Version
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Clones the current active snapshot. Edit the JSON, validate,
          save. Schema is checked before the new version is written so
          typos can&apos;t reach the DB.
        </p>
      </header>

      <ConfigEditor
        initialSnapshotJson={JSON.stringify(
          active.configVersion.snapshot,
          null,
          2
        )}
        baseVersionNumber={active.configVersion.versionNumber}
      />
    </main>
  );
}
