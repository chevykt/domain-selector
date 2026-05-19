// Per-dimension scoring functions. Each returns a DimensionScore object so
// the engine can build the full breakdown.
//
// All formulas are direct implementations of the scoring framework
// (lib/config/defaults.ts seeds the actual values into ConfigVersion).

import type {
  ConfigSnapshot,
  DimensionCaps,
} from "@/lib/config/types";
import type { Brief } from "@/lib/brief/schema";
import type { DimensionScore } from "./types";

// ---------- 2.1 Niche match ----------

export function scoreNicheMatch(
  brief: Brief,
  domain: {
    nicheRaw: string | null;
    mainNiche: string | null;
    complementary: string | null;
    indirect: string | null;
  },
  caps: DimensionCaps,
  config: ConfigSnapshot
): DimensionScore {
  const cap = caps.nicheMatch;

  // Build client tokens: niches + target page keywords, lowercase, split
  // on non-alphanumeric, drop tokens whose length is below the min.
  const clientCorpus = [
    ...brief.niches,
    ...brief.targetPages.map((p) => p.keyword),
  ]
    .join(" ")
    .toLowerCase();
  const minLen = config.nicheMatch.minWordLength;
  const clientTokens = clientCorpus
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= minLen);

  if (clientTokens.length === 0) {
    return {
      raw: 0,
      score: 0,
      cap,
      detail: "no client tokens (after length filter)",
    };
  }

  // Build domain string from main_niche + niche + complementary + indirect.
  const domainCorpus = [
    domain.mainNiche,
    domain.nicheRaw,
    domain.complementary,
    domain.indirect,
  ]
    .filter((s): s is string => Boolean(s))
    .join(" ")
    .toLowerCase();

  if (domainCorpus.length === 0) {
    return { raw: 0, score: 0, cap, detail: "domain has no niche fields" };
  }

  // Match: per the framework, count each client token that appears anywhere
  // in the domain string (substring match). Duplicates in the client list
  // each get counted independently — this matches the worked example.
  let matches = 0;
  for (const token of clientTokens) {
    if (domainCorpus.includes(token)) matches++;
  }
  const density = matches / clientTokens.length;
  const raw = density * config.nicheMatch.densityMultiplier;
  const score = Math.min(cap, Math.round(raw));

  return {
    raw,
    score,
    cap,
    detail: `${matches}/${clientTokens.length} tokens matched, density ${density.toFixed(2)}`,
  };
}

// ---------- 2.2 Domain Rating ----------

export function scoreDomainRating(
  brief: Brief,
  dr: number | null,
  caps: DimensionCaps,
  config: ConfigSnapshot
): DimensionScore {
  const cap = caps.domainRating;
  if (dr === null) {
    return { raw: 0, score: 0, cap, detail: "DR missing" };
  }
  if (dr < brief.minDR) {
    return { raw: 0, score: 0, cap, detail: `DR ${dr} below min ${brief.minDR}` };
  }
  const drMax = config.scales.drMaxValue;
  const range = drMax - brief.minDR;
  if (range <= 0) {
    return { raw: cap, score: cap, cap, detail: `DR ${dr} (degenerate range)` };
  }
  const raw = ((dr - brief.minDR) / range) * cap;
  const score = Math.min(cap, Math.round(raw));
  return { raw, score, cap, detail: `DR ${dr}, scaled to ${score}/${cap}` };
}

// ---------- 2.3 Traffic ----------

export function scoreTraffic(
  brief: Brief,
  traffic: number | null,
  caps: DimensionCaps,
  config: ConfigSnapshot
): DimensionScore {
  const cap = caps.traffic;
  if (traffic === null) {
    return { raw: 0, score: 0, cap, detail: "traffic missing" };
  }
  if (traffic < brief.minTraffic) {
    return {
      raw: 0,
      score: 0,
      cap,
      detail: `traffic ${traffic} below min ${brief.minTraffic}`,
    };
  }
  const base = config.scales.trafficLogBase;
  const raw =
    (Math.log10(traffic / brief.minTraffic) / Math.log10(base)) * cap;
  const score = Math.min(cap, Math.max(0, Math.round(raw)));
  return {
    raw,
    score,
    cap,
    detail: `${traffic.toLocaleString()} traffic → ${score}/${cap}`,
  };
}

// ---------- 2.4 Price efficiency ----------

export function scorePriceEfficiency(
  brief: Brief,
  domain: { gpPrice: number | null; liPrice: number | null; isFree: boolean },
  caps: DimensionCaps
): DimensionScore {
  const cap = caps.priceEfficiency;
  const budget = brief.budgetPerLink;
  if (!budget || budget <= 0) {
    return { raw: 0, score: 0, cap, detail: "budget missing" };
  }

  // Use gp_price if present, otherwise li_price (framework section 2.4).
  // "Free" sets gp_price = 0 and isFree = true.
  let p: number | null = null;
  if (domain.isFree) p = 0;
  else if (domain.gpPrice !== null) p = domain.gpPrice;
  else if (domain.liPrice !== null) p = domain.liPrice;

  if (p === null) {
    return { raw: 0, score: 0, cap, detail: "no price info" };
  }
  if (p > budget) {
    return {
      raw: 0,
      score: 0,
      cap,
      detail: `$${p} exceeds budget $${budget}`,
    };
  }
  const raw = ((budget - p) / budget) * cap;
  const score = Math.min(cap, Math.max(0, Math.round(raw)));
  return {
    raw,
    score,
    cap,
    detail: `$${p} vs $${budget} budget → ${score}/${cap}`,
  };
}

// ---------- 2.5 Ranking bonus ----------

export function scoreRankingBonus(
  ranking: string | null,
  caps: DimensionCaps
): DimensionScore {
  const cap = caps.rankingBonus;
  if (!ranking) {
    return { raw: 0, score: 0, cap, detail: "ranking missing" };
  }
  const r = ranking.toLowerCase();
  if (r.includes("good")) {
    return { raw: cap, score: cap, cap, detail: `ranking "${ranking}" → ${cap}/${cap}` };
  }
  // Framework section 2.5: "okay" or "ok" → half cap.
  // Substring match per the framework; "okay" subsumes "ok" but we list
  // both to mirror the spec verbatim. Round half deterministically.
  if (r.includes("okay") || r.includes("ok")) {
    const half = Math.round(cap / 2);
    return { raw: half, score: half, cap, detail: `ranking "${ranking}" → ${half}/${cap}` };
  }
  return { raw: 0, score: 0, cap, detail: `ranking "${ranking}" → 0/${cap}` };
}

// ---------- 2.6 Geo match ----------

export function scoreGeoMatch(
  brief: Brief,
  geo: string | null,
  caps: DimensionCaps
): DimensionScore {
  const cap = caps.geoMatch;
  const clientGeo = (brief.geoFocus ?? "").trim().toLowerCase();
  if (!clientGeo || clientGeo === "global") {
    return { raw: cap, score: cap, cap, detail: "client geo is global" };
  }
  const domainGeo = (geo ?? "").trim().toLowerCase();
  if (domainGeo && domainGeo.includes(clientGeo)) {
    return { raw: cap, score: cap, cap, detail: `domain geo "${geo}" matches "${clientGeo}"` };
  }
  return {
    raw: 0,
    score: 0,
    cap,
    detail: `domain geo "${geo ?? "?"}" ≠ "${clientGeo}"`,
  };
}

// ---------- 2.7 No red flags ----------

export function scoreNoRedFlags(
  redFlags: string[],
  caps: DimensionCaps
): DimensionScore {
  const cap = caps.noRedFlags;
  if (!redFlags || redFlags.length === 0) {
    return { raw: cap, score: cap, cap, detail: "no red flags" };
  }
  return {
    raw: 0,
    score: 0,
    cap,
    detail: `red flag(s): ${redFlags.join(", ")}`,
  };
}
