import mammoth from "mammoth";
import path from "node:path";

async function main() {
  const filePath = path.resolve(
    process.argv[2] ?? ".private/scoring-framework.docx"
  );
  const result = await mammoth.extractRawText({ path: filePath });
  console.log(`=== ${filePath} ===`);
  console.log(result.value);
  if (result.messages.length > 0) {
    console.error("--- messages ---");
    for (const msg of result.messages) console.error(msg);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
