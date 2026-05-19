// Parses the real BlueTree inventory CSV and runs the scoring engine
// against every row using a sample SaaS brief. Reports headers, skipped
// summary rows, row count, disqualification breakdown, and top 10 by score.
//
// Usage:  npx tsx scripts/verify-csv.ts [path-to-csv]

import { readFileSync } from "node:fs";
import path from "node:path";

import { BriefSchema, type Brief } from "../lib/brief/schema";
import { DEFAULT_CONFIG_SNAPSHOT } from "../lib/config/defaults";
import { parseInventoryCsv } from "../lib/csv/parser";
import { scoreDomain } from "../lib/scoring/engine";

const filePath = path.resolve(
  process.argv[2] ?? ".private/sample-inventory.csv"
);

const csv = readFileSync(filePath, "utf8");
const parsed = parseInventoryCsv(csv);

console.log("=== CSV parse summary ===");
console.log(`File:                 ${filePath}`);
console.log(`Skipped header rows:  ${parsed.skippedHeaderRows}`);
console.log(`Data rows kept:       ${parsed.rowCount}`);
console.log(`Detected headers:     ${parsed.headers.length}`);
console.log(`Warnings:             ${parsed.warnings.length}`);
if (parsed.warnings.length > 0) {
  for (const w of parsed.warnings.slice(0, 5)) console.log(`  - ${w}`);
  if (parsed.warnings.length > 5)
    console.log(`  (${parsed.warnings.length - 5} more)`);
}

console.log("\n=== Sample row (rowIndex 0) ===");
console.log(JSON.stringify(parsed.rows[0], null, 2));

console.log("\n=== Field coverage across all rows ===");
const fields = [
  "domainRating",
  "traffic",
  "geo",
  "gpPrice",
  "liPrice",
  "tat",
  "linkType",
  "ranking",
  "contactEmail",
  "nicheRaw",
  "mainNiche",
] as const;

for (const field of fields) {
  const filled = parsed.rows.filter(
    (r) => r[field] !== null && r[field] !== ""
  ).length;
  const pct = ((filled / parsed.rows.length) * 100).toFixed(0);
  console.log(`  ${field.padEnd(15)} ${filled}/${parsed.rows.length} (${pct}%)`);
}

console.log("\n=== Sample scoring run ===");

const sampleBrief: Brief = BriefSchema.parse({
  clientName: "Sample SaaS",
  niches: ["saas", "business", "technology"],
  targetPages: [
    {
      url: "https://example.com/marketing-tools",
      keyword: "marketing automation software",
    },
  ],
  budgetPerLink: 250,
  geoFocus: "global",
  followPreference: "DOFOLLOW",
  minDR: 45,
  minTraffic: 2000,
  linkCountGoal: 10,
  industryProfile: "SAAS",
});

console.log(`Brief: ${JSON.stringify({ ...sampleBrief, targetPages: `${sampleBrief.targetPages.length} target(s)` })}`);

let qualified = 0;
const disqReasonCount: Record<string, number> = {};
const scored: { domain: string; total: number; reasoning: string }[] = [];

for (const row of parsed.rows) {
  const result = scoreDomain(
    { brief: sampleBrief, domain: row },
    DEFAULT_CONFIG_SNAPSHOT
  );
  if (result.disqualified) {
    for (const r of result.reasons) {
      disqReasonCount[r.code] = (disqReasonCount[r.code] ?? 0) + 1;
    }
  } else {
    qualified++;
    scored.push({
      domain: row.domain,
      total: result.total,
      reasoning: result.reasoning,
    });
  }
}

console.log(`\nQualified: ${qualified} / ${parsed.rows.length}`);
console.log("Disqualification reasons (a row may have multiple):");
for (const [code, count] of Object.entries(disqReasonCount)) {
  console.log(`  ${code.padEnd(22)} ${count}`);
}

scored.sort((a, b) => b.total - a.total);
console.log("\nTop 10 by score:");
for (const s of scored.slice(0, 10)) {
  console.log(`  ${s.total.toString().padStart(3)}  ${s.domain.padEnd(40)}  ${s.reasoning}`);
}
