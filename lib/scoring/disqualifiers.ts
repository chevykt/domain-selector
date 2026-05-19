import type { Brief, LinkTypeKey } from "@/lib/brief/schema";
import type { ConfigSnapshot } from "@/lib/config/types";
import type { DisqualifierReason } from "./types";

export interface DomainForDisqualifier {
  domain: string;
  domainRating: number | null;
  traffic: number | null;
  linkType: string | null;
  ranking: string | null;
  // Niche signals — needed for the EXCLUDED_NICHE check
  nicheRaw: string | null;
  mainNiche: string | null;
  complementary: string | null;
  indirect: string | null;
}

export interface DisqualifierMatch {
  code: DisqualifierReason;
  message: string;
}

export function checkDisqualifiers(
  brief: Brief,
  domain: DomainForDisqualifier,
  config: ConfigSnapshot
): DisqualifierMatch[] {
  const reasons: DisqualifierMatch[] = [];
  const d = config.disqualifiers;

  // 3.1 DR below client's minimum
  if (d.enforceMinDR) {
    if (domain.domainRating === null) {
      reasons.push({
        code: "DR_BELOW_MIN",
        message: "DR missing (treated as below minimum)",
      });
    } else if (domain.domainRating < brief.minDR) {
      reasons.push({
        code: "DR_BELOW_MIN",
        message: `DR ${domain.domainRating} below minimum ${brief.minDR}`,
      });
    }
  }

  // 3.2 Traffic below client's minimum
  if (d.enforceMinTraffic) {
    if (domain.traffic === null) {
      reasons.push({
        code: "TRAFFIC_BELOW_MIN",
        message: "Traffic missing (treated as below minimum)",
      });
    } else if (domain.traffic < brief.minTraffic) {
      reasons.push({
        code: "TRAFFIC_BELOW_MIN",
        message: `Traffic ${domain.traffic.toLocaleString()} below minimum ${brief.minTraffic.toLocaleString()}`,
      });
    }
  }

  // 3.3 Link type contains "nofollow" when client requires dofollow only
  if (d.enforceFollowPreference && brief.followPreference === "DOFOLLOW") {
    const lt = (domain.linkType ?? "").toLowerCase();
    if (lt.includes("nofollow")) {
      reasons.push({
        code: "NOFOLLOW_REJECTED",
        message: `Link type "${domain.linkType}" is nofollow but client requires dofollow`,
      });
    }
  }

  // 3.4 Ranking field contains a bad-ranking pattern (e.g., "poor", "bad")
  const ranking = (domain.ranking ?? "").toLowerCase();
  for (const pattern of d.badRankingPatterns) {
    const p = pattern.toLowerCase();
    if (p && ranking.includes(p)) {
      reasons.push({
        code: "BAD_RANKING",
        message: `Ranking "${domain.ranking}" matches disqualifier pattern "${pattern}"`,
      });
      break;
    }
  }

  // 3.5 Competitor blocklist — exact domain match (case-insensitive)
  if (brief.competitorBlocklist.length > 0) {
    const dom = domain.domain.toLowerCase().trim();
    const hit = brief.competitorBlocklist.find(
      (b) => b.toLowerCase().trim() === dom
    );
    if (hit) {
      reasons.push({
        code: "COMPETITOR_BLOCKED",
        message: `${domain.domain} is on the competitor blocklist`,
      });
    }
  }

  // 3.6 Excluded niches — any excluded keyword appearing in any of the
  // domain's niche fields (case-insensitive substring match)
  if (brief.excludedNiches.length > 0) {
    const haystack = [
      domain.mainNiche,
      domain.nicheRaw,
      domain.complementary,
      domain.indirect,
    ]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();
    if (haystack) {
      const matched = brief.excludedNiches.find((n) =>
        haystack.includes(n.toLowerCase().trim())
      );
      if (matched) {
        reasons.push({
          code: "EXCLUDED_NICHE",
          message: `Domain niche contains excluded keyword "${matched}"`,
        });
      }
    }
  }

  // 3.7 Link type preference — if the client picked specific link types,
  // the domain's offered link types must overlap.
  if (brief.linkTypes.length > 0) {
    const offered = parseDomainLinkTypes(domain.linkType);
    const wanted = new Set<LinkTypeKey>(brief.linkTypes);
    const overlap = offered.some((o) => wanted.has(o));
    if (!overlap) {
      reasons.push({
        code: "LINK_TYPE_MISMATCH",
        message: `Domain offers "${domain.linkType ?? "—"}" but client wants ${brief.linkTypes.join(" / ")}`,
      });
    }
  }

  return reasons;
}

// Vendor link type cells look like "GP", "LI", "LE", or "GP/LI" (combo).
// Anything we don't recognise is dropped.
function parseDomainLinkTypes(raw: string | null): LinkTypeKey[] {
  if (!raw) return [];
  const tokens = raw.split(/[\/,]/).map((t) => t.trim().toUpperCase());
  const out: LinkTypeKey[] = [];
  for (const t of tokens) {
    if (t === "GP" || t === "LI" || t === "LE") out.push(t);
  }
  return out;
}
