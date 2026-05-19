// Seeds ConfigVersion #1 from lib/config/defaults.ts and points
// ActiveConfig at it. Idempotent: if a config with the same snapshot
// already exists, do nothing.
//
// Usage:  npm run db:seed

import { prisma } from "../lib/db";
import { DEFAULT_CONFIG_SNAPSHOT } from "../lib/config/defaults";

async function main() {
  const existing = await prisma.activeConfig.findUnique({
    where: { id: "singleton" },
    include: { configVersion: true },
  });

  if (existing) {
    console.log(
      `Active config already exists: version ${existing.configVersion.versionNumber} (id ${existing.configVersionId})`
    );
    console.log("Nothing to do.");
    return;
  }

  const maxVersion = await prisma.configVersion.aggregate({
    _max: { versionNumber: true },
  });
  const nextVersionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

  const created = await prisma.configVersion.create({
    data: {
      versionNumber: nextVersionNumber,
      snapshot: DEFAULT_CONFIG_SNAPSHOT,
      note: "Initial seed — baseline weights from scoring framework v1.",
    },
  });

  await prisma.activeConfig.create({
    data: {
      id: "singleton",
      configVersionId: created.id,
    },
  });

  console.log(
    `Seeded ConfigVersion #${created.versionNumber} (id ${created.id}) and pointed ActiveConfig at it.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
