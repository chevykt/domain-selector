// Verifies the scoring engine against the worked example in the framework
// document (section 7). Same input, same config, same expected output.
//
// Usage:  npx tsx scripts/verify-scoring.ts

import { BriefSchema, type Brief } from "../lib/brief/schema";
import { DEFAULT_CONFIG_SNAPSHOT } from "../lib/config/defaults";
import { scoreDomain } from "../lib/scoring/engine";
import type { ScoreInput } from "../lib/scoring/types";

const brief: Brief = BriefSchema.parse({
  clientName: "Worked Example",
  niches: ["saas", "hr software", "employee management"],
  targetPages: [
    {
      url: "https://example.com/skills",
      keyword: "skills management software",
    },
  ],
  budgetPerLink: 300,
  geoFocus: "global",
  followPreference: "DOFOLLOW",
  minDR: 45,
  minTraffic: 2000,
  linkCountGoal: 10,
  industryProfile: "SAAS",
});

const input: ScoreInput = {
  brief,
  domain: {
    rowIndex: 0,
    domain: "example.com",
    domainRating: 65,
    traffic: 28000,
    geo: "global",
    gpPrice: 180,
    liPrice: null,
    isFree: false,
    tat: null,
    linkType: "dofollow",
    ranking: "Good",
    contactEmail: null,
    nicheRaw: "employee development",
    mainNiche: "HR technology",
    complementary: "saas",
    indirect: "workforce management",
    redFlags: [],
  },
};

const result = scoreDomain(input, DEFAULT_CONFIG_SNAPSHOT);

if (result.disqualified) {
  console.error("FAIL: domain was disqualified");
  for (const r of result.reasons) console.error("  -", r.message);
  process.exit(1);
}

const EXPECTED = {
  total: 82,
  max: 100,
  // Per the framework worked example, section 7:
  dimensions: {
    nicheMatch: 40,
    domainRating: 8,
    traffic: 10,
    priceEfficiency: 4,
    rankingBonus: 10,
    geoMatch: 5,
    noRedFlags: 5,
  },
};

console.log("=== Scoring engine: worked example ===");
console.log(`Reasoning: ${result.reasoning}`);
console.log("");
console.log(`Total: ${result.total}/${result.maxPossible}`);
console.log("Breakdown:");
for (const [key, dim] of Object.entries(result.breakdown)) {
  console.log(`  ${key.padEnd(18)} ${dim.score}/${dim.cap}  (${dim.detail})`);
}
console.log("");

let failures = 0;
function assertEq(label: string, actual: number, expected: number) {
  const ok = actual === expected;
  console.log(`  [${ok ? "OK " : "XX "}] ${label}: ${actual}  (expected ${expected})`);
  if (!ok) failures++;
}

console.log("Assertions:");
assertEq("total", result.total, EXPECTED.total);
assertEq("maxPossible", result.maxPossible, EXPECTED.max);
assertEq("nicheMatch", result.breakdown.nicheMatch.score, EXPECTED.dimensions.nicheMatch);
assertEq("domainRating", result.breakdown.domainRating.score, EXPECTED.dimensions.domainRating);
assertEq("traffic", result.breakdown.traffic.score, EXPECTED.dimensions.traffic);
assertEq("priceEfficiency", result.breakdown.priceEfficiency.score, EXPECTED.dimensions.priceEfficiency);
assertEq("rankingBonus", result.breakdown.rankingBonus.score, EXPECTED.dimensions.rankingBonus);
assertEq("geoMatch", result.breakdown.geoMatch.score, EXPECTED.dimensions.geoMatch);
assertEq("noRedFlags", result.breakdown.noRedFlags.score, EXPECTED.dimensions.noRedFlags);

console.log("");
if (failures === 0) {
  console.log("PASS — engine matches framework worked example.");
  process.exit(0);
} else {
  console.log(`FAIL — ${failures} assertion(s) failed.`);
  process.exit(1);
}
