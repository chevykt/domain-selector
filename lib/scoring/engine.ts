// Pure deterministic scoring engine. Same (brief, domain, config) → same
// output, always. No I/O, no DB, no LLM. The framework's worked example
// is verified by scripts/verify-scoring.ts.

import {
  capsForProfile,
  maxScoreForProfile,
  type ConfigSnapshot,
} from "@/lib/config/types";
import { checkDisqualifiers } from "./disqualifiers";
import {
  scoreDomainRating,
  scoreGeoMatch,
  scoreNicheMatch,
  scoreNoRedFlags,
  scorePriceEfficiency,
  scoreRankingBonus,
  scoreTraffic,
} from "./dimensions";
import { buildReasoning } from "./reasoning";
import type { Breakdown, ScoreInput, ScoreResult } from "./types";

export function scoreDomain(
  input: ScoreInput,
  config: ConfigSnapshot
): ScoreResult {
  // ---------- Step 1: hard disqualifiers ----------
  const disq = checkDisqualifiers(
    input.brief,
    {
      domain: input.domain.domain,
      domainRating: input.domain.domainRating,
      traffic: input.domain.traffic,
      linkType: input.domain.linkType,
      ranking: input.domain.ranking,
      nicheRaw: input.domain.nicheRaw,
      mainNiche: input.domain.mainNiche,
      complementary: input.domain.complementary,
      indirect: input.domain.indirect,
    },
    config
  );
  if (disq.length > 0) {
    return { disqualified: true, reasons: disq };
  }

  // ---------- Step 2: resolve caps for the active profile ----------
  const caps = capsForProfile(config, input.brief.industryProfile);
  const max = maxScoreForProfile(config, input.brief.industryProfile);

  // ---------- Step 3: compute each dimension ----------
  const breakdown: Breakdown = {
    nicheMatch: scoreNicheMatch(input.brief, input.domain, caps, config),
    domainRating: scoreDomainRating(
      input.brief,
      input.domain.domainRating,
      caps,
      config
    ),
    traffic: scoreTraffic(input.brief, input.domain.traffic, caps, config),
    priceEfficiency: scorePriceEfficiency(input.brief, input.domain, caps),
    rankingBonus: scoreRankingBonus(input.domain.ranking, caps),
    geoMatch: scoreGeoMatch(input.brief, input.domain.geo, caps),
    noRedFlags: scoreNoRedFlags(input.domain.redFlags, caps),
  };

  const total =
    breakdown.nicheMatch.score +
    breakdown.domainRating.score +
    breakdown.traffic.score +
    breakdown.priceEfficiency.score +
    breakdown.rankingBonus.score +
    breakdown.geoMatch.score +
    breakdown.noRedFlags.score;

  return {
    disqualified: false,
    total,
    maxPossible: max,
    breakdown,
    reasoning: buildReasoning(total, max, breakdown),
  };
}
