import { z } from "zod";

// ---------- Score dimension caps ----------
//
// Each profile defines a cap (max contribution) for the seven scoring
// dimensions. The framework allows caps to NOT sum to 100; the UI must
// display "X / Y" where Y = sum of the active profile's caps.

export const DimensionCapsSchema = z.object({
  nicheMatch: z.number().int().min(0).max(100),
  domainRating: z.number().int().min(0).max(100),
  traffic: z.number().int().min(0).max(100),
  priceEfficiency: z.number().int().min(0).max(100),
  rankingBonus: z.number().int().min(0).max(100),
  geoMatch: z.number().int().min(0).max(100),
  noRedFlags: z.number().int().min(0).max(100),
});
export type DimensionCaps = z.infer<typeof DimensionCapsSchema>;

// ---------- Industry profiles ----------

export const IndustryProfileKeySchema = z.enum([
  "SAAS",
  "ECOMMERCE",
  "FINTECH",
  "LOCAL_SERVICES",
]);
export type IndustryProfileKey = z.infer<typeof IndustryProfileKeySchema>;

export const IndustryProfileSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  caps: DimensionCapsSchema,
});
export type IndustryProfile = z.infer<typeof IndustryProfileSchema>;

// ---------- Disqualifier rules ----------

export const DisqualifierConfigSchema = z.object({
  enforceMinDR: z.boolean(),
  enforceMinTraffic: z.boolean(),
  enforceFollowPreference: z.boolean(),
  // Lower-case substrings; any match in the ranking field disqualifies.
  badRankingPatterns: z.array(z.string()).min(0),
});
export type DisqualifierConfig = z.infer<typeof DisqualifierConfigSchema>;

// ---------- Niche match algorithm tuning ----------

export const NicheMatchConfigSchema = z.object({
  // Drop client tokens with length <= minWordLength - 1
  // (framework: "drop any word three characters or shorter" → minWordLength = 4)
  minWordLength: z.number().int().min(1),
  // density × multiplier, capped at the dimension cap
  densityMultiplier: z.number().positive(),
});
export type NicheMatchConfig = z.infer<typeof NicheMatchConfigSchema>;

// ---------- Scoring scale tuning ----------

export const ScalesConfigSchema = z.object({
  // DR value that scores the cap. Framework: 85.
  drMaxValue: z.number().positive(),
  // Traffic multiplier above minTraffic that scores the cap. Framework: 50.
  trafficLogBase: z.number().positive(),
});
export type ScalesConfig = z.infer<typeof ScalesConfigSchema>;

// ---------- Defaults (brief-level defaults if user doesn't override) ----------

export const DefaultsConfigSchema = z.object({
  minDR: z.number().int().min(0).max(100),
  minTraffic: z.number().int().min(0),
  shortlistSize: z.number().int().min(1).max(1000),
  followPreference: z.enum(["DOFOLLOW", "NOFOLLOW", "EITHER"]),
  geoFocus: z.string(),
});
export type DefaultsConfig = z.infer<typeof DefaultsConfigSchema>;

// ---------- LLM prompt strings (currently unused, future-ready) ----------

export const PromptsConfigSchema = z.object({
  // Reserved for an optional LLM enrichment of niche match.
  // The deterministic engine never calls these; they exist so they can
  // be edited via the admin UI when LLM enrichment is enabled.
  nicheMatchEnrichment: z.string(),
  overallReasoning: z.string(),
});
export type PromptsConfig = z.infer<typeof PromptsConfigSchema>;

// ---------- Full config snapshot ----------

export const ConfigSnapshotSchema = z.object({
  defaults: DefaultsConfigSchema,
  profiles: z.record(IndustryProfileKeySchema, IndustryProfileSchema),
  disqualifiers: DisqualifierConfigSchema,
  nicheMatch: NicheMatchConfigSchema,
  scales: ScalesConfigSchema,
  prompts: PromptsConfigSchema,
});
export type ConfigSnapshot = z.infer<typeof ConfigSnapshotSchema>;

// Resolves the dimension caps for the profile the campaign is using.
export function capsForProfile(
  snapshot: ConfigSnapshot,
  profileKey: IndustryProfileKey
): DimensionCaps {
  const profile = snapshot.profiles[profileKey];
  if (!profile) {
    throw new Error(`Industry profile "${profileKey}" not found in config`);
  }
  return profile.caps;
}

// Sum of all dimension caps for a profile = max possible score under that profile.
export function maxScoreForProfile(
  snapshot: ConfigSnapshot,
  profileKey: IndustryProfileKey
): number {
  const c = capsForProfile(snapshot, profileKey);
  return (
    c.nicheMatch +
    c.domainRating +
    c.traffic +
    c.priceEfficiency +
    c.rankingBonus +
    c.geoMatch +
    c.noRedFlags
  );
}
