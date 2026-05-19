import type { ConfigSnapshot } from "./types";

// Baseline ("standard") caps from the scoring framework, section 4.
const STANDARD_CAPS = {
  nicheMatch: 40,
  domainRating: 15,
  traffic: 15,
  priceEfficiency: 10,
  rankingBonus: 10,
  geoMatch: 5,
  noRedFlags: 5,
} as const;

// Default config used to seed ConfigVersion #1.
// All values mirror the scoring framework document.
export const DEFAULT_CONFIG_SNAPSHOT: ConfigSnapshot = {
  defaults: {
    minDR: 45,
    minTraffic: 2000,
    shortlistSize: 50,
    followPreference: "DOFOLLOW",
    geoFocus: "global",
  },

  profiles: {
    // Section 5: "SaaS: standard weights (default profile)"
    SAAS: {
      label: "SaaS",
      description: "Standard weights — balanced across all dimensions.",
      caps: { ...STANDARD_CAPS },
    },

    // Section 5: "Ecommerce: niche match cap 50, DR cap 10, traffic cap 10"
    ECOMMERCE: {
      label: "Ecommerce",
      description:
        "Topical fit matters more than raw authority. Niche match raised to 50; DR and traffic lowered to 10 each.",
      caps: {
        ...STANDARD_CAPS,
        nicheMatch: 50,
        domainRating: 10,
        traffic: 10,
      },
    },

    // Section 5: "Fintech / regulated: niche match cap 35, no red flags cap 10"
    FINTECH: {
      label: "Fintech",
      description:
        "Stricter on red flags, slightly looser on topical match (smaller niche pool). Niche match → 35; no-red-flags → 10.",
      caps: {
        ...STANDARD_CAPS,
        nicheMatch: 35,
        noRedFlags: 10,
      },
    },

    // Section 5: "Local services: geo match cap 15, traffic cap 5"
    LOCAL_SERVICES: {
      label: "Local Services",
      description:
        "Geography dominates. Geo match raised to 15; traffic lowered to 5.",
      caps: {
        ...STANDARD_CAPS,
        traffic: 5,
        geoMatch: 15,
      },
    },
  },

  disqualifiers: {
    enforceMinDR: true,
    enforceMinTraffic: true,
    enforceFollowPreference: true,
    // Framework section 3: "Ranking field contains 'poor' or 'bad'"
    badRankingPatterns: ["poor", "bad"],
  },

  nicheMatch: {
    // Framework section 2.1: "drop any word three characters or shorter"
    minWordLength: 4,
    // Framework section 2.1: density × 120
    densityMultiplier: 120,
  },

  scales: {
    // Framework section 2.2: scores cap at DR 85
    drMaxValue: 85,
    // Framework section 2.3: 50× minTraffic scores the cap
    trafficLogBase: 50,
  },

  prompts: {
    nicheMatchEnrichment:
      "You are evaluating semantic relevance between client niches and a publisher domain.\nClient niches: {{niches}}\nTarget page keywords: {{keywords}}\nDomain niche fields: main={{main}}, niche={{niche}}, complementary={{complementary}}, indirect={{indirect}}.\nReturn JSON: {\"score\": <0-1>, \"reasoning\": <one-line string>}. Temperature 0.",
    overallReasoning:
      "Summarize why this domain scored {{total}}/{{max}} for the campaign.\nStrengths: {{strengths}}\nWeaknesses: {{weaknesses}}\nReturn one sentence, plain English, no marketing fluff.",
  },
};
