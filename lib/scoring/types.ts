// Scoring input + output types. The engine works on these types so it
// doesn't depend on Prisma — callers map between Prisma rows and these
// shapes (keeps the engine pure and unit-testable).

import type { Brief } from "@/lib/brief/schema";

export interface ScoreInput {
  brief: Brief;
  domain: {
    rowIndex: number;
    domain: string;
    domainRating: number | null;
    traffic: number | null;
    geo: string | null;
    gpPrice: number | null;
    liPrice: number | null;
    isFree: boolean;
    tat: string | null;
    linkType: string | null;
    ranking: string | null;
    contactEmail: string | null;
    nicheRaw: string | null;
    mainNiche: string | null;
    complementary: string | null;
    indirect: string | null;
    redFlags: string[];
  };
}

export interface DimensionScore {
  raw: number;       // computed value before cap (informational)
  score: number;     // final integer score for this dimension
  cap: number;       // dimension cap under the active profile
  detail: string;    // short human-readable string explaining the calc
}

export type DimensionKey =
  | "nicheMatch"
  | "domainRating"
  | "traffic"
  | "priceEfficiency"
  | "rankingBonus"
  | "geoMatch"
  | "noRedFlags";

export type Breakdown = Record<DimensionKey, DimensionScore>;

export type DisqualifierReason =
  | "DR_BELOW_MIN"
  | "TRAFFIC_BELOW_MIN"
  | "NOFOLLOW_REJECTED"
  | "BAD_RANKING"
  | "EXCLUDED_NICHE"
  | "COMPETITOR_BLOCKED"
  | "LINK_TYPE_MISMATCH";

export interface DisqualifiedResult {
  disqualified: true;
  reasons: { code: DisqualifierReason; message: string }[];
}

export interface ScoredResult {
  disqualified: false;
  total: number;
  maxPossible: number;
  breakdown: Breakdown;
  reasoning: string;
}

export type ScoreResult = DisqualifiedResult | ScoredResult;
