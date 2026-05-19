import { z } from "zod";
import { IndustryProfileKeySchema } from "@/lib/config/types";

// ---------- Brief input (what the form collects) ----------

export const TargetPageSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  keyword: z.string().min(1, "Keyword is required").max(200),
});
export type TargetPage = z.infer<typeof TargetPageSchema>;

export const FollowPreferenceSchema = z.enum(["DOFOLLOW", "NOFOLLOW", "EITHER"]);
export type FollowPreference = z.infer<typeof FollowPreferenceSchema>;

// Link-type tokens used by the vendor inventory.
// CSV values: "GP", "LI", "LE", "GP/LI" (combo). We split combos on '/'.
export const LinkTypeKeySchema = z.enum(["GP", "LI", "LE"]);
export type LinkTypeKey = z.infer<typeof LinkTypeKeySchema>;

export const AnchorStrategySchema = z.enum([
  "NATURAL_MIXED",
  "BRANDED",
  "EXACT_MATCH",
  "GENERIC",
]);
export type AnchorStrategy = z.infer<typeof AnchorStrategySchema>;

export const BriefSchema = z.object({
  clientName: z.string().min(1, "Client name is required").max(200),
  // Accepted from form as raw comma-separated string; parsed into array
  // by parseNicheString before validation.
  niches: z.array(z.string().min(1)).min(1, "At least one niche is required"),
  targetPages: z
    .array(TargetPageSchema)
    .min(1, "At least one target page is required"),
  budgetPerLink: z.number().positive("Budget must be > 0"),
  geoFocus: z.string().min(1).default("global"),
  followPreference: FollowPreferenceSchema.default("DOFOLLOW"),
  minDR: z.number().int().min(0).max(100).default(45),
  minTraffic: z.number().int().min(0).default(2000),
  linkCountGoal: z.number().int().positive("Link count goal must be > 0"),
  industryProfile: IndustryProfileKeySchema.default("SAAS"),

  // ---------- Disqualifier inputs (added from the BlueTree onboarding spec) ----------
  // Empty arrays / strings mean "no restriction".

  // Niche keywords that should DISQUALIFY a domain when present in its
  // niche fields. e.g. ["gambling", "cbd", "adult"].
  excludedNiches: z.array(z.string().min(1)).default([]),

  // Hard blocklist of domains. Case-insensitive exact match against
  // the domain field. Useful for competitor sites.
  competitorBlocklist: z.array(z.string().min(1)).default([]),

  // Preferred link types. Empty array = no restriction.
  // If non-empty, a domain's link type must intersect this list to qualify.
  linkTypes: z.array(LinkTypeKeySchema).default([]),

  // Informational only — flows to the export Notes column.
  anchorStrategy: AnchorStrategySchema.default("NATURAL_MIXED"),
  teamNotes: z.string().default(""),
});
export type Brief = z.infer<typeof BriefSchema>;

// Helper: parse the form's comma-separated niche string into a clean array.
export function parseNicheString(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Helper: parse competitor blocklist from textarea (one domain per line OR
// comma-separated). Lowercases for case-insensitive matching downstream.
export function parseDomainList(raw: string): string[] {
  return raw
    .split(/[,\n\r]+/)
    .map((s) => s.trim().toLowerCase())
    // Strip protocol / trailing slash if user pasted full URLs
    .map((s) => s.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((s) => s.length > 0);
}

export const LINK_TYPE_OPTIONS: { value: LinkTypeKey; label: string }[] = [
  { value: "GP", label: "Guest Post" },
  { value: "LI", label: "Niche Edit / Link Insertion" },
  { value: "LE", label: "Link Exchange" },
];

export const ANCHOR_STRATEGY_OPTIONS: {
  value: AnchorStrategy;
  label: string;
}[] = [
  { value: "NATURAL_MIXED", label: "Natural / Mixed" },
  { value: "BRANDED", label: "Branded" },
  { value: "EXACT_MATCH", label: "Exact Match" },
  { value: "GENERIC", label: "Generic" },
];
