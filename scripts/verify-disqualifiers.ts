// Verifies each of the 7 disqualifier codes the engine can emit.
// Constructs a brief + domain that should trigger exactly one code,
// then asserts:
//   1. the result is disqualified
//   2. the expected code appears in the reasons list
//   3. (negative test) a non-triggering domain qualifies
//
// Usage:  npm run verify:disqualifiers
//   or:   npx tsx scripts/verify-disqualifiers.ts

import { BriefSchema, type Brief } from "../lib/brief/schema";
import { DEFAULT_CONFIG_SNAPSHOT } from "../lib/config/defaults";
import { scoreDomain } from "../lib/scoring/engine";
import type { DisqualifierReason, ScoreInput } from "../lib/scoring/types";

/* ------------------------------------------------------------------ */
/*  Test harness                                                       */
/* ------------------------------------------------------------------ */

interface Case {
  name: string;
  expectedCode: DisqualifierReason | null;  // null = should qualify
  brief: Brief;
  domain: ScoreInput["domain"];
}

const baseBrief = (overrides: Partial<Brief> = {}): Brief =>
  BriefSchema.parse({
    clientName: "Test",
    niches: ["saas", "business", "technology"],
    targetPages: [
      { url: "https://example.com/a", keyword: "team management" },
    ],
    budgetPerLink: 300,
    geoFocus: "global",
    followPreference: "DOFOLLOW",
    minDR: 45,
    minTraffic: 2000,
    linkCountGoal: 5,
    industryProfile: "SAAS",
    excludedNiches: [],
    competitorBlocklist: [],
    linkTypes: [],
    anchorStrategy: "NATURAL_MIXED",
    teamNotes: "",
    ...overrides,
  });

const baseDomain = (
  overrides: Partial<ScoreInput["domain"]> = {}
): ScoreInput["domain"] => ({
  rowIndex: 0,
  domain: "example.com",
  domainRating: 70,
  traffic: 25000,
  geo: "us",
  gpPrice: 180,
  liPrice: null,
  isFree: false,
  tat: "1-2 weeks",
  linkType: "GP",
  ranking: "Good",
  contactEmail: "x@example.com",
  nicheRaw: "saas",
  mainNiche: "saas",
  complementary: "business",
  indirect: "technology",
  redFlags: [],
  ...overrides,
});

/* ------------------------------------------------------------------ */
/*  Cases — one per disqualifier code + a control                      */
/* ------------------------------------------------------------------ */

const CASES: Case[] = [
  {
    name: "DR below minimum",
    expectedCode: "DR_BELOW_MIN",
    brief: baseBrief(),
    domain: baseDomain({ domainRating: 30 }),
  },
  {
    name: "DR missing entirely",
    expectedCode: "DR_BELOW_MIN",
    brief: baseBrief(),
    domain: baseDomain({ domainRating: null }),
  },
  {
    name: "Traffic below minimum",
    expectedCode: "TRAFFIC_BELOW_MIN",
    brief: baseBrief(),
    domain: baseDomain({ traffic: 100 }),
  },
  {
    name: "Traffic missing entirely",
    expectedCode: "TRAFFIC_BELOW_MIN",
    brief: baseBrief(),
    domain: baseDomain({ traffic: null }),
  },
  {
    name: "Nofollow when dofollow required",
    expectedCode: "NOFOLLOW_REJECTED",
    brief: baseBrief({ followPreference: "DOFOLLOW" }),
    domain: baseDomain({ linkType: "nofollow LI" }),
  },
  {
    name: "Bad ranking — Poor",
    expectedCode: "BAD_RANKING",
    brief: baseBrief(),
    domain: baseDomain({ ranking: "Poor" }),
  },
  {
    name: "Bad ranking — Bad (case insensitive)",
    expectedCode: "BAD_RANKING",
    brief: baseBrief(),
    domain: baseDomain({ ranking: "BAD" }),
  },
  {
    name: "Excluded niche keyword in main",
    expectedCode: "EXCLUDED_NICHE",
    brief: baseBrief({ excludedNiches: ["gambling"] }),
    domain: baseDomain({ mainNiche: "gambling and casino" }),
  },
  {
    name: "Excluded niche keyword in indirect",
    expectedCode: "EXCLUDED_NICHE",
    brief: baseBrief({ excludedNiches: ["cbd"] }),
    domain: baseDomain({ indirect: "cbd wellness" }),
  },
  {
    name: "Competitor blocklist — exact match",
    expectedCode: "COMPETITOR_BLOCKED",
    brief: baseBrief({ competitorBlocklist: ["example.com"] }),
    domain: baseDomain({ domain: "example.com" }),
  },
  {
    name: "Competitor blocklist — case insensitive",
    expectedCode: "COMPETITOR_BLOCKED",
    brief: baseBrief({ competitorBlocklist: ["EXAMPLE.COM"] }),
    domain: baseDomain({ domain: "example.com" }),
  },
  {
    name: "Link type mismatch — client wants GP, domain offers only LI",
    expectedCode: "LINK_TYPE_MISMATCH",
    brief: baseBrief({ linkTypes: ["GP"] }),
    domain: baseDomain({ linkType: "LI" }),
  },
  {
    name: "Link type mismatch — combo not overlapping",
    expectedCode: "LINK_TYPE_MISMATCH",
    brief: baseBrief({ linkTypes: ["GP"] }),
    domain: baseDomain({ linkType: "LE/LI" }),
  },
  {
    name: "Link type combo overlaps — should NOT disqualify",
    expectedCode: null,
    brief: baseBrief({ linkTypes: ["GP", "LI"] }),
    domain: baseDomain({ linkType: "GP/LI" }),
  },
  {
    name: "Control — clean domain qualifies",
    expectedCode: null,
    brief: baseBrief(),
    domain: baseDomain(),
  },
];

/* ------------------------------------------------------------------ */
/*  Runner                                                             */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;

console.log("Verifying disqualifier engine:\n");

for (const c of CASES) {
  const result = scoreDomain(
    { brief: c.brief, domain: c.domain },
    DEFAULT_CONFIG_SNAPSHOT
  );

  if (c.expectedCode === null) {
    // Should qualify
    if (!result.disqualified) {
      console.log(`  ✔ ${c.name}`);
      passed++;
    } else {
      console.error(
        `  ✘ ${c.name}\n      expected: qualified\n      got:      disqualified (${result.reasons
          .map((r) => r.code)
          .join(", ")})`
      );
      failed++;
    }
    continue;
  }

  // Should disqualify with the expected code
  if (!result.disqualified) {
    console.error(
      `  ✘ ${c.name}\n      expected disqualified (${c.expectedCode})\n      got:      qualified`
    );
    failed++;
    continue;
  }

  const codes = result.reasons.map((r) => r.code);
  if (codes.includes(c.expectedCode)) {
    console.log(`  ✔ ${c.name}`);
    passed++;
  } else {
    console.error(
      `  ✘ ${c.name}\n      expected code: ${c.expectedCode}\n      got codes:     ${codes.join(", ")}`
    );
    failed++;
  }
}

console.log("");
if (failed === 0) {
  console.log(`PASS — ${passed}/${CASES.length} disqualifier cases covered.`);
  process.exit(0);
} else {
  console.error(`FAIL — ${failed}/${CASES.length} cases failed.`);
  process.exit(1);
}
