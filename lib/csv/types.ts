// A single normalized inventory row, ready for DB persistence + scoring.
export interface ParsedDomainRow {
  rowIndex: number;            // 0-based position in the data section
  domain: string;
  domainRating: number | null; // DR
  traffic: number | null;
  geo: string | null;          // country code from "Country. Traffic"
  gpPrice: number | null;      // null when "-" / "Waiting" / "?" / blank
  liPrice: number | null;
  isFree: boolean;             // gp_price == "Free"
  tat: string | null;
  linkType: string | null;     // LI / GP / LE / GP/LI / etc.
  ranking: string | null;      // Good / Okay / Poor / etc.
  contactEmail: string | null;
  nicheRaw: string | null;
  mainNiche: string | null;
  complementary: string | null;
  indirect: string | null;
  redFlags: string[];
  rawData: Record<string, string>;
}

export interface ParseResult {
  headers: string[];           // normalized header row
  skippedHeaderRows: number;   // count of summary rows we skipped
  rowCount: number;            // count of data rows kept
  rows: ParsedDomainRow[];
  warnings: string[];
}

export class CsvParseError extends Error {
  constructor(
    message: string,
    public readonly details?: { headers?: string[]; missing?: string[] }
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}
