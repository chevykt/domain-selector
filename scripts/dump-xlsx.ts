import ExcelJS from "exceljs";
import path from "node:path";

async function main() {
  const filePath = path.resolve(process.argv[2] ?? ".private/template.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`=== Workbook: ${filePath} ===`);
  console.log(`Sheets: ${workbook.worksheets.length}\n`);

  for (const sheet of workbook.worksheets) {
    console.log(`--- Sheet: "${sheet.name}" (state=${sheet.state}) ---`);
    console.log(`Rows: ${sheet.rowCount}  Columns: ${sheet.columnCount}\n`);

    const maxRowsToShow = 6;
    const rowsToShow = Math.min(sheet.rowCount, maxRowsToShow);
    for (let r = 1; r <= rowsToShow; r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        const v = row.getCell(c).value;
        let display: string;
        if (v === null || v === undefined) {
          display = "";
        } else if (typeof v === "object" && "richText" in (v as object)) {
          display = (v as { richText: { text: string }[] }).richText
            .map((t) => t.text)
            .join("");
        } else if (typeof v === "object" && "formula" in (v as object)) {
          display = `=${(v as { formula: string }).formula}`;
        } else if (typeof v === "object" && "result" in (v as object)) {
          display = String((v as { result: unknown }).result);
        } else {
          display = String(v);
        }
        cells.push(display.replace(/\r?\n/g, " | "));
      }
      console.log(`  R${r}: ${JSON.stringify(cells)}`);
    }
    console.log("");
  }

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
