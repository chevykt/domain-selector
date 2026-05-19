// Deterministic one-line summary builder. No LLM. Same inputs always
// produce the same output — this is part of the reproducibility guarantee.

import type { Breakdown, DimensionKey } from "./types";

const DIMENSION_LABEL: Record<DimensionKey, string> = {
  nicheMatch: "niche",
  domainRating: "DR",
  traffic: "traffic",
  priceEfficiency: "price",
  rankingBonus: "ranking",
  geoMatch: "geo",
  noRedFlags: "clean",
};

const KEY_ORDER: DimensionKey[] = [
  "nicheMatch",
  "domainRating",
  "traffic",
  "priceEfficiency",
  "rankingBonus",
  "geoMatch",
  "noRedFlags",
];

export function buildReasoning(total: number, max: number, b: Breakdown): string {
  const parts: string[] = [];
  for (const key of KEY_ORDER) {
    const dim = b[key];
    if (!dim) continue;
    // Skip dimensions with cap 0 — they don't apply under this profile.
    if (dim.cap === 0) continue;
    parts.push(`${DIMENSION_LABEL[key]} ${dim.score}/${dim.cap}`);
  }
  return `${total}/${max} — ${parts.join(", ")}`;
}
