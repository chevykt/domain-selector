import Papa from "papaparse";
import {
  CsvParseError,
  type ParseResult,
  type ParsedDomainRow,
} from "./types";

// ---------- Required and optional columns ----------
//
// Names are matched case-insensitively against a whitespace-normalized
// version of each header cell (the vendor's headers can contain embedded
// newlines, e.g. "Traffic Trend Analysis\n(30d | 90d | 180d )").

const REQUIRED_HEADERS = ["Domain", "DR", "Traffic"] as const;

// Map normalized header name → key on ParsedDomainRow. Optional columns are
// included opportunistically when present.
const HEADER_MAP = {
  domain: ["Domain"],
  domainRating: ["DR"],
  traffic: ["Traffic"],
  country: ["Country. Traffic", "Country.Traffic", "Country Traffic"],
  nicheRaw: ["Niche"],
  mainNiche: ["Main"],
  complementary: ["Complementary"],
  indirect: ["Indirect"],
  gpPrice: ["GP Price"],
  liPrice: ["LI Price"],
  linkType: ["Link Type"],
  tat: ["TAT"],
  redFlags: ["Red Flags"],
  ranking: ["Ranking"],
  contact: ["Contact"],
} as const;

// ---------- Public entry point ----------

export function parseInventoryCsv(csv: string): ParseResult {
  const warnings: string[] = [];

  // Step 1: parse the whole CSV. We need raw rows so we can detect and
  // skip the vendor's summary rows at the top.
  const parsed = Papa.parse<string[]>(csv, {
    skipEmptyLines: false,
    transform: (v) => (typeof v === "string" ? v : String(v ?? "")),
  });

  if (parsed.errors.length > 0) {
    const fatal = parsed.errors.filter((e) => e.type === "Quotes");
    if (fatal.length > 0) {
      throw new CsvParseError(
        `Malformed CSV: ${fatal.map((e) => e.message).join("; ")}`
      );
    }
    for (const err of parsed.errors) {
      warnings.push(`CSV parser: ${err.message} (row ${err.row})`);
    }
  }

  const rawRows = parsed.data;
  if (rawRows.length === 0) {
    throw new CsvParseError("CSV is empty");
  }

  // Step 2: find the header row. We skip leading "summary" rows whose first
  // cell ends in ":" (e.g. "Total Unique Domains:", "Good Domains:"). The
  // first row that matches our required headers is the header.
  const headerRowIdx = findHeaderRowIndex(rawRows);
  if (headerRowIdx === -1) {
    throw new CsvParseError(
      `Could not find a header row containing ${REQUIRED_HEADERS.join(", ")}. ` +
        `Check that the file is the BlueTree paid-sites inventory export.`,
      { headers: rawRows[0]?.map(normalizeHeader) }
    );
  }

  const rawHeaders = rawRows[headerRowIdx];
  const headers = rawHeaders.map(normalizeHeader);

  // Step 3: confirm required columns are present.
  const missing: string[] = [];
  for (const req of REQUIRED_HEADERS) {
    if (findHeaderIdx(headers, [req]) === -1) missing.push(req);
  }
  if (missing.length > 0) {
    throw new CsvParseError(
      `CSV is missing required column(s): ${missing.join(", ")}`,
      { headers, missing }
    );
  }

  // Step 4: build the column index map.
  const colIdx = {
    domain: findHeaderIdx(headers, HEADER_MAP.domain),
    domainRating: findHeaderIdx(headers, HEADER_MAP.domainRating),
    traffic: findHeaderIdx(headers, HEADER_MAP.traffic),
    country: findHeaderIdx(headers, HEADER_MAP.country),
    nicheRaw: findHeaderIdx(headers, HEADER_MAP.nicheRaw),
    mainNiche: findHeaderIdx(headers, HEADER_MAP.mainNiche),
    complementary: findHeaderIdx(headers, HEADER_MAP.complementary),
    indirect: findHeaderIdx(headers, HEADER_MAP.indirect),
    gpPrice: findHeaderIdx(headers, HEADER_MAP.gpPrice),
    liPrice: findHeaderIdx(headers, HEADER_MAP.liPrice),
    linkType: findHeaderIdx(headers, HEADER_MAP.linkType),
    tat: findHeaderIdx(headers, HEADER_MAP.tat),
    redFlags: findHeaderIdx(headers, HEADER_MAP.redFlags),
    ranking: findHeaderIdx(headers, HEADER_MAP.ranking),
    contact: findHeaderIdx(headers, HEADER_MAP.contact),
  };

  // Step 5: walk data rows. Skip blank lines.
  const dataStart = headerRowIdx + 1;
  const rows: ParsedDomainRow[] = [];
  let dataIdx = 0;

  for (let i = dataStart; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (isBlankRow(r)) continue;

    const domain = cell(r, colIdx.domain);
    if (!domain) {
      warnings.push(`Row ${i + 1}: blank domain, skipped`);
      continue;
    }

    const rawData: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rawData[headers[j]] = (r[j] ?? "").toString();
    }

    const gpRaw = cell(r, colIdx.gpPrice);
    const liRaw = cell(r, colIdx.liPrice);

    rows.push({
      rowIndex: dataIdx++,
      domain: domain,
      domainRating: parseIntOrNull(cell(r, colIdx.domainRating)),
      traffic: parseIntOrNull(cell(r, colIdx.traffic)),
      geo: parseCountryCode(cell(r, colIdx.country)),
      gpPrice: parsePrice(gpRaw),
      liPrice: parsePrice(liRaw),
      isFree: gpRaw.trim().toLowerCase() === "free",
      tat: nullable(cell(r, colIdx.tat)),
      linkType: nullable(cell(r, colIdx.linkType)),
      ranking: nullable(cell(r, colIdx.ranking)),
      contactEmail: parseContactEmail(cell(r, colIdx.contact)),
      nicheRaw: nullable(cell(r, colIdx.nicheRaw)),
      mainNiche: nullable(cell(r, colIdx.mainNiche)),
      complementary: nullable(cell(r, colIdx.complementary)),
      indirect: nullable(cell(r, colIdx.indirect)),
      redFlags: parseRedFlags(cell(r, colIdx.redFlags)),
      rawData,
    });
  }

  return {
    headers,
    skippedHeaderRows: headerRowIdx,
    rowCount: rows.length,
    rows,
    warnings,
  };
}

// ---------- Header detection ----------

function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? [];
    if (row.length < REQUIRED_HEADERS.length) continue;
    const norm = row.map(normalizeHeader).map((s) => s.toLowerCase());
    const hasAllRequired = REQUIRED_HEADERS.every((h) =>
      norm.some((c) => c === h.toLowerCase())
    );
    if (hasAllRequired) return i;
  }
  return -1;
}

function normalizeHeader(s: string): string {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function findHeaderIdx(headers: string[], aliases: readonly string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const alias of aliases) {
    const idx = lowerHeaders.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

// ---------- Cell helpers ----------

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return (row[idx] ?? "").toString().trim();
}

function isBlankRow(row: string[]): boolean {
  return !row || row.every((c) => !c || !c.toString().trim());
}

function nullable(s: string): string | null {
  const t = s.trim();
  if (t === "" || t === "-") return null;
  return t;
}

function parseIntOrNull(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9-]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

// Price parsing: handles "$180", "$1,000", "-", "Waiting", "?", "Free", null.
// "Free" → 0 (and isFree flag is set separately).
// "-" / "Waiting" / "?" / "" → null (no price info).
function parsePrice(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "-" || lower === "waiting" || lower === "?" || lower === "tbd")
    return null;
  if (lower === "free") return 0;
  const cleaned = t.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// "Country. Traffic" cell looks like "(us, 32288)" or "(in, 91378)".
function parseCountryCode(s: string): string | null {
  if (!s) return null;
  const m = s.match(/\(\s*([a-z]{2,3})\s*[,)]/i);
  return m ? m[1].toLowerCase() : null;
}

// "Contact" may contain a comma-separated list — keep the first valid email.
function parseContactEmail(s: string): string | null {
  if (!s) return null;
  const candidates = s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  for (const c of candidates) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return c;
  }
  // Fallback: keep the raw if no parseable email
  return s.trim() || null;
}

// "Red Flags" cell is sometimes empty, sometimes "Too low traffic", or a
// comma-separated list. Treat "-" / blank / "no" / "none" as no flags.
function parseRedFlags(s: string): string[] {
  if (!s) return [];
  const t = s.trim().toLowerCase();
  if (t === "" || t === "-" || t === "no" || t === "none") return [];
  return s
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
