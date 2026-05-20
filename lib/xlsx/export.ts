import ExcelJS from "exceljs";

import {
  ANCHOR_STRATEGY_OPTIONS,
  type Brief,
} from "@/lib/brief/schema";
import {
  CLIENT_INFO_HEADERS,
  CM_HEADERS,
  CM_HISTORY_HEADERS,
  CM_STATE_HEADERS,
} from "./headers";

const ANCHOR_LABEL: Record<string, string> = Object.fromEntries(
  ANCHOR_STRATEGY_OPTIONS.map((o) => [o.value, o.label])
);

export interface CampaignExportData {
  campaign: {
    id: string;
    name: string;
    createdAt: Date;
    status: string;
    industryProfile: string;
  };
  brief: Brief;
  selected: {
    domain: string;
    dr: number | null;
    traffic: number | null;
    geo: string | null;
    gpPrice: number | null;
    liPrice: number | null;
    isFree: boolean;
    tat: string | null;
    linkType: string | null;
    contactEmail: string | null;
    score: number;
  }[];
}

// Builds the workbook in memory and returns the encoded buffer. Column
// counts and header ordering exactly match the template; populated columns
// use our data, the rest are blank for the operations team to fill in.
export async function buildCampaignWorkbook(
  data: CampaignExportData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Domain Selector";
  wb.created = new Date();

  // ---------- Sheet 1: Client Info ----------
  const clientInfo = wb.addWorksheet("Client Info");
  clientInfo.addRow([...CLIENT_INFO_HEADERS]);
  clientInfo.getRow(1).font = { bold: true };

  const linksLive = 0;
  const linksSelected = data.selected.length;
  const shortfall = Math.max(0, data.brief.linkCountGoal - linksLive);

  clientInfo.addRow([
    data.brief.clientName,                                          // Client Name
    "Active",                                                       // Client Status
    1,                                                              // Order / Period
    data.campaign.createdAt,                                        // Order Start Date
    "",                                                             // Order Deadline
    data.brief.linkCountGoal,                                       // Link Volume
    data.brief.budgetPerLink,                                       // Budget Per Target
    data.brief.minDR,                                               // Min. DR
    data.brief.minTraffic,                                          // Min. Traffic
    "",                                                             // Order Payment Date
    data.brief.followPreference === "DOFOLLOW" ? "Sponsored" : "",  // Order Type
    linksSelected,                                                  // Domains (selected count)
    data.brief.targetPages.map((p) => p.url).join(" | "),           // Target Pages
    "No",                                                           // Domain Approval
    "",                                                             // Domain Approval Tracker
    notesFromBrief(data.brief),                                     // Order / Period Notes
    "",                                                             // Team in Charge
    linksLive,                                                      // Links Live
    shortfall,                                                      // Order / Period Shortfall
    "",                                                             // Link Tracker
    statusLabel(data.campaign.status),                              // Order Status
    "",                                                             // Account Manager
  ]);

  setColumnWidths(clientInfo, [
    16, 14, 12, 18, 18, 12, 16, 10, 12, 18, 14, 10, 60, 16, 22, 60,
    16, 12, 22, 14, 16, 20,
  ]);

  // ---------- Sheet 2: CM (Campaign Management) ----------
  const cm = wb.addWorksheet("CM");
  cm.addRow([...CM_HEADERS]);
  cm.getRow(1).font = { bold: true };

  const clientPrefix = clientOrderPrefix(data.brief.clientName);
  const yymm = ymmFromDate(data.campaign.createdAt);
  const orderDate = new Date();

  for (let i = 0; i < data.selected.length; i++) {
    const d = data.selected[i];
    const price = d.gpPrice ?? d.liPrice ?? null;
    const linkType =
      d.gpPrice !== null ? "GP" : d.liPrice !== null ? "LI" : "";
    const target =
      data.brief.targetPages[i % data.brief.targetPages.length] ??
      data.brief.targetPages[0];
    const seq = String(i + 1).padStart(2, "0");
    const profit = price !== null ? data.brief.budgetPerLink - price : "";

    cm.addRow([
      1,                              // Period
      data.campaign.createdAt,        // Period Start Date
      `${clientPrefix}${yymm}${seq}`, // Order #
      orderDate,                      // Order Date
      d.domain,                       // Placement Domain
      "",                             // Placement URL (set after live)
      d.dr ?? "",                     // DR
      d.traffic ?? "",                // Traffic
      price ?? "",                    // Order Price
      "",                             // DB Price (matches vendor list — left blank)
      "Yes",                          // Can Use
      d.tat ?? "",                    // TAT
      target?.url ?? "",              // Target URL
      target?.keyword ?? "",          // Anchor Text
      linkType,                       // Link Type
      data.brief.budgetPerLink,       // Budget
      profit,                         // Profit
      "",                             // Status
      "",                             // Publishing Date
      d.contactEmail ?? "",           // Contact Email
      "",                             // Thread ID
      "",                             // Team
      "",                             // Notes
      "",                             // Review Status
      "",                             // Review Notes
      "",                             // Topics/Snippets
      "",                             // GP Doc
      "",                             // Content Status
      "",                             // Payment Invoice
      "",                             // Vendor Name | (on the invoice)
      "",                             // Request Type
      "",                             // Invoice Link No.
      "",                             // Payment Status
      "",                             // Payment Notes
      "",                             // (empty)
      "",                             // (empty)
      "",                             // (empty)
      "",                             // (empty)
      "",                             // Hash
    ]);
  }

  setColumnWidths(cm, [
    8, 18, 14, 18, 24, 36, 8, 12, 12, 12, 10, 10, 36, 28, 10, 10, 10,
    14, 18, 24, 14, 18, 30, 14, 18, 28, 20, 14, 28, 22, 14, 14, 14, 20,
    8, 8, 8, 8, 22,
  ]);

  // ---------- Hidden bookkeeping sheets (empty, matching the template) ----------
  // These two stay so the file remains schema-compatible with the BlueTree
  // CM workflow that consumes the export downstream.
  const cmHistory = wb.addWorksheet("__CM_HISTORY", { state: "hidden" });
  cmHistory.addRow([...CM_HISTORY_HEADERS]);
  cmHistory.getRow(1).font = { bold: true };

  const cmState = wb.addWorksheet("__CM_STATE", { state: "hidden" });
  cmState.addRow([...CM_STATE_HEADERS]);
  cmState.getRow(1).font = { bold: true };

  // NOTE: the per-client "Referring Domains - <client>" sheet from the
  // BlueTree template has been intentionally omitted. The spec says "4 tabs"
  // and we don't populate this sheet (per-client backlink data is imported
  // separately from Ahrefs after launch). The REFERRING_DOMAINS_HEADERS
  // constant remains in headers.ts for ops teams that want to re-add it.

  // ---------- Encode ----------
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// ---------- helpers ----------

function notesFromBrief(brief: Brief): string {
  const lines: string[] = [
    `Niches: ${brief.niches.join(", ")}`,
    `Industry profile: ${brief.industryProfile}`,
    `Geo focus: ${brief.geoFocus}`,
    `Follow preference: ${brief.followPreference}`,
    `Anchor strategy: ${ANCHOR_LABEL[brief.anchorStrategy] ?? brief.anchorStrategy}`,
  ];
  if (brief.linkTypes.length > 0) {
    lines.push(`Link types: ${brief.linkTypes.join(" / ")}`);
  }
  if (brief.excludedNiches.length > 0) {
    lines.push(`Excluded niches: ${brief.excludedNiches.join(", ")}`);
  }
  if (brief.competitorBlocklist.length > 0) {
    lines.push(`Blocked sites: ${brief.competitorBlocklist.join(", ")}`);
  }
  if (brief.teamNotes.trim()) {
    lines.push(`Team notes: ${brief.teamNotes.trim()}`);
  }
  return lines.join(" | ");
}

function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "📝 Draft";
    case "INVENTORY_LOADED":
      return "📥 Inventory uploaded";
    case "SCORED":
      return "📊 Shortlist ready";
    case "FINALIZED":
      return "✅ Exported";
    default:
      return status;
  }
}

function clientOrderPrefix(clientName: string): string {
  return clientName
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
}

function ymmFromDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${mm}${yy}`;
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}
