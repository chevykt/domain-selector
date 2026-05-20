// Asserts that the headers in lib/xlsx/headers.ts match the BlueTree
// template at .private/template.xlsx byte-for-byte. Run before any release
// that touches lib/xlsx/.
//
// Usage:  npm run verify:export
//   or:   npx tsx scripts/verify-export-fidelity.ts

import ExcelJS from "exceljs";
import path from "node:path";

import {
  CLIENT_INFO_HEADERS,
  CM_HEADERS,
  CM_HISTORY_HEADERS,
  CM_STATE_HEADERS,
} from "../lib/xlsx/headers";

const TEMPLATE_PATH = path.resolve(".private/template.xlsx");

interface SheetCheck {
  name: string;
  expected: readonly string[];
}

const CHECKS: SheetCheck[] = [
  { name: "Client Info", expected: CLIENT_INFO_HEADERS },
  { name: "CM", expected: CM_HEADERS },
  { name: "__CM_HISTORY", expected: CM_HISTORY_HEADERS },
  { name: "__CM_STATE", expected: CM_STATE_HEADERS },
];

// ExcelJS cell.value comes in several shapes. We need to extract the
// displayed text for comparison:
//   - string / number / boolean → toString
//   - formula cell → { formula, result } — use result
//   - rich text   → { richText: [{ text, font? }, ...] } — concat texts
//   - hyperlink   → { text, hyperlink } — use text
// The Google-Sheets-exported template wraps every CM header in an
// IFERROR(__xludf.DUMMYFUNCTION(...)) shim that ExcelJS sees as a formula
// cell whose .result is the actual display string. Without unwrapping
// these we'd compare against the literal "[object Object]".
function extractText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("result" in obj && obj.result !== undefined && obj.result !== null) {
      return extractText(obj.result);
    }
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((rt) => rt.text ?? "")
        .join("");
    }
    if ("text" in obj && typeof obj.text === "string") {
      return obj.text;
    }
  }
  return String(v);
}

// Normalizes whitespace so multi-line cells from the Google-Sheets export
// of the template compare cleanly against our single-line strings.
function normalize(v: unknown): string {
  return extractText(v).replace(/\s+/g, " ").trim();
}

async function main() {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(TEMPLATE_PATH);
  } catch (err) {
    console.error(`\n✘ Could not read template at:\n  ${TEMPLATE_PATH}\n`);
    console.error(
      "Place the BlueTree CM template at that path and rerun. " +
        "If you're a new developer, ask the team for a copy — the file " +
        "is gitignored on purpose (contains client data)."
    );
    console.error("\nUnderlying error:", err);
    process.exit(1);
  }

  let failures = 0;
  let cellsChecked = 0;

  console.log("Verifying export header fidelity against:");
  console.log(`  ${TEMPLATE_PATH}\n`);

  for (const check of CHECKS) {
    const sheet = wb.getWorksheet(check.name);
    if (!sheet) {
      console.error(`  ✘ Sheet "${check.name}" missing from template`);
      failures++;
      continue;
    }

    const row = sheet.getRow(1);
    let sheetFailures = 0;
    for (let i = 0; i < check.expected.length; i++) {
      const colIndex = i + 1; // ExcelJS columns are 1-indexed
      const actual = normalize(row.getCell(colIndex).value);
      const expected = normalize(check.expected[i]);
      cellsChecked++;
      if (actual !== expected) {
        console.error(
          `  ✘ ${check.name} col ${colIndex}:\n` +
            `      template: ${JSON.stringify(actual)}\n` +
            `      code:     ${JSON.stringify(expected)}`
        );
        failures++;
        sheetFailures++;
      }
    }
    if (sheetFailures === 0) {
      console.log(`  ✔ ${check.name.padEnd(14)} ${check.expected.length} cols`);
    } else {
      console.log(
        `  ✘ ${check.name.padEnd(14)} ${sheetFailures}/${check.expected.length} cols failed`
      );
    }
  }

  console.log("");
  if (failures === 0) {
    console.log(
      `PASS — every sheet header in code matches the template (${cellsChecked} cells checked).`
    );
    process.exit(0);
  } else {
    console.error(
      `FAIL — ${failures} header mismatch${failures === 1 ? "" : "es"} found.`
    );
    console.error(
      "Fix lib/xlsx/headers.ts so it matches the template, or update " +
        "the template if the team has approved a structural change."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
