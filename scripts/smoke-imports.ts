// Imports every module in the project (excluding React components which need
// JSX runtime) to confirm they parse and resolve cleanly. This is a coarse
// substitute for `tsc --noEmit` when tsc is unavailable.

async function main() {
  const modules = [
    "../lib/db",
    "../lib/log",
    "../lib/utils",
    "../lib/config/types",
    "../lib/config/defaults",
    "../lib/config/loader",
    "../lib/brief/schema",
    "../lib/csv/types",
    "../lib/csv/parser",
    "../lib/scoring/types",
    "../lib/scoring/dimensions",
    "../lib/scoring/disqualifiers",
    "../lib/scoring/reasoning",
    "../lib/scoring/engine",
    "../app/actions/create-campaign",
  ];

  let failures = 0;
  for (const m of modules) {
    try {
      await import(m);
      console.log(`  OK   ${m}`);
    } catch (err) {
      console.error(`  FAIL ${m}`);
      console.error("       " + (err instanceof Error ? err.message : String(err)));
      failures++;
    }
  }

  console.log(`\n${modules.length - failures}/${modules.length} modules imported successfully.`);
  if (failures > 0) process.exit(1);
}

main();
