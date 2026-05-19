import { prisma } from "@/lib/db";
import { ConfigSnapshotSchema, type ConfigSnapshot } from "./types";

export interface ActiveConfig {
  snapshot: ConfigSnapshot;
  versionId: number;
  versionNumber: number;
  note: string | null;
}

// Loads the currently active config from the DB. Throws if nothing is
// seeded — the user must run prisma/seed.ts first.
export async function loadActiveConfig(): Promise<ActiveConfig> {
  const active = await prisma.activeConfig.findUnique({
    where: { id: "singleton" },
    include: { configVersion: true },
  });
  if (!active) {
    throw new Error(
      "No active config set. Run `npm run db:seed` to seed the initial config version."
    );
  }
  const snapshot = ConfigSnapshotSchema.parse(active.configVersion.snapshot);
  return {
    snapshot,
    versionId: active.configVersionId,
    versionNumber: active.configVersion.versionNumber,
    note: active.configVersion.note,
  };
}

// Load a specific version by id (used when re-rendering a historical
// campaign's shortlist — Campaign.configVersionId is the snapshot pointer).
export async function loadConfigVersion(
  versionId: number
): Promise<ActiveConfig> {
  const version = await prisma.configVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    throw new Error(`ConfigVersion ${versionId} not found`);
  }
  const snapshot = ConfigSnapshotSchema.parse(version.snapshot);
  return {
    snapshot,
    versionId: version.id,
    versionNumber: version.versionNumber,
    note: version.note,
  };
}
