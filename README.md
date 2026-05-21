# Domain Selector

[![Verify](https://github.com/chevykt/domain-selector/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/chevykt/domain-selector/actions/workflows/verify.yml)

Internal tool for **BlueTree**. Scores publisher domains from the vendor inventory CSV against a client brief, surfaces the top-N shortlist with include/exclude controls, and exports a Campaign Management XLSX matching the BT template.

The reasoning layer is **configurable** and **versioned**: every campaign records the exact `ConfigVersion` it was scored against, so reopening a campaign reproduces the same shortlist verbatim. Scoring is **deterministic** — no LLM in the scoring path.

> 📄 **For reviewers:** see [DECISIONS.md](./DECISIONS.md) — one-page write-up covering stack choice, the UX decisions I'm proudest of, what I cut, and what I'd change with more time.

## Stack

- **Next.js 16** (App Router, Server Actions, React 19.2)
- **TypeScript** + **Tailwind CSS v4**
- **PostgreSQL** (designed for [Neon](https://neon.tech))
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter
- **zod** for runtime validation, **pino** for structured logs
- **papaparse** for CSV, **exceljs** for XLSX

## First-time setup

### 1. Install dependencies

```bash
npm install
```

(`prisma generate` runs automatically via the `postinstall` hook.)

### 2. Configure the database

Create a `.env.local` at the project root:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require"
LOG_LEVEL="debug"
```

The connection string comes from your Neon project's "Connect" panel. The direct (non-pooled) URL is fine for `prisma migrate`; the pooled URL is preferred for `next start` in production.

### 3. Apply migrations + seed config

```bash
npm run db:migrate     # creates tables in dev
npm run db:seed        # creates ConfigVersion #1 + ActiveConfig pointer
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Day-to-day usage

1. **New campaign** — fill in the brief (client name, niches, target pages, budget, geo, follow preference, min DR / traffic, link goal, industry profile).
2. **Upload inventory** — drop the BlueTree paid-sites CSV. The parser auto-skips the "Total / Good / Okay / Poor" summary rows at the top.
3. **Run scoring** — applies the active config and records a `Score` row for every domain.
4. **Shortlist** — sort by score, toggle include/exclude per domain. Top bar shows live totals (selected count, budget spent / remaining, average DR).
5. **Excluded view** — `/campaigns/[id]/excluded` lists every disqualified domain with the reason code (DR_BELOW_MIN, TRAFFIC_BELOW_MIN, NOFOLLOW_REJECTED, BAD_RANKING).
6. **Export XLSX** — downloads a workbook with `Client Info`, `CM`, hidden bookkeeping sheets, and a `Referring Domains` placeholder. Column counts and headers match the BT template.

State is persisted on every action (brief, inventory, scores, selections), so closing the tab mid-flow doesn't lose progress.

## Project layout

```
app/
  page.tsx                          # campaign list
  campaigns/
    new/page.tsx                    # brief form
    [id]/page.tsx                   # detail (upload → score → shortlist → export)
    [id]/excluded/page.tsx          # disqualified view
  api/
    campaigns/[id]/export/route.ts  # XLSX download
  actions/
    create-campaign.ts              # server action: create + redirect
    upload-inventory.ts             # server action: parse CSV + persist
    score-campaign.ts               # server action: deterministic scoring run
    toggle-selection.ts             # server action: include/exclude
lib/
  scoring/
    engine.ts                       # pure deterministic scorer
    dimensions.ts                   # 7 per-dimension fns
    disqualifiers.ts                # hard rule checks
    reasoning.ts                    # one-line summary builder
  csv/parser.ts                     # header detection + skip + normalize
  config/
    types.ts                        # zod-validated ConfigSnapshot
    defaults.ts                     # seed values from scoring framework
    loader.ts                       # loadActiveConfig / loadConfigVersion
  brief/schema.ts                   # zod Brief schema
  xlsx/
    headers.ts                      # exact column ordering
    export.ts                       # workbook builder
  db.ts                             # PrismaClient (HMR-safe singleton)
  log.ts                            # pino logger
prisma/
  schema.prisma                     # 7 models (see "Schema")
  migrations/                       # generated migrations
  seed.ts                           # seeds ConfigVersion #1
scripts/
  verify-scoring.ts                 # asserts the framework worked example
  verify-csv.ts                     # parses real CSV + runs scoring across all rows
  dump-xlsx.ts                      # inspects the template structure
  dump-docx.ts                      # extracts scoring framework text
components/
  brief-form.tsx                    # client form + zod validation
  inventory-upload.tsx              # CSV file picker
  score-button.tsx                  # triggers scoring action
  shortlist.tsx                     # table + selection + live totals
  export-button.tsx                 # XLSX download
```

## Schema highlights

- **`Campaign`** — `brief` (JSONB) + `industryProfile` + `configVersionId` (the snapshot pointer; null until scored) + `status`.
- **`InventoryUpload`** — original filename + row count + skipped summary rows + raw CSV (for re-parse).
- **`Domain`** — normalized vendor row (DR, traffic, geo, gpPrice, liPrice, isFree, tat, linkType, ranking, contactEmail, nicheRaw, mainNiche, complementary, indirect, redFlags) + full `rawData` JSONB.
- **`Score`** — total, max possible (sum of profile's caps), per-dimension `breakdown` JSONB, disqualified flag + reason codes, deterministic reasoning string. Indexed for top-N sorts.
- **`Selection`** — include/exclude per (campaign, domain).
- **`ConfigVersion`** — monotonic `versionNumber` + full `snapshot` JSONB (weights, caps, profiles, disqualifier rules, LLM prompt strings).
- **`ActiveConfig`** — singleton row pointing at the current `ConfigVersion`.

Determinism guarantee: every `Campaign` records the `configVersionId` it was scored against, so reopening it (or re-scoring it) against the same config reproduces the exact same shortlist.

## Scoring framework

The seven dimensions, capped under the standard (SaaS) profile:

| Dimension          | Cap  | Formula |
|--------------------|------|---------|
| Niche match        | 40   | `min(40, round(matches/total * 120))` where tokens are 4+ chars |
| Domain rating      | 15   | linear: `min(15, round((DR-minDR)/(85-minDR) * 15))` |
| Traffic            | 15   | log: `min(15, round(log10(t/min) / log10(50) * 15))` |
| Price efficiency   | 10   | `min(10, round((budget-price)/budget * 10))` |
| Ranking bonus      | 10   | "good" → 10, "okay/ok" → 5, else → 0 |
| Geo match          | 5    | global/match → 5, else → 0 |
| No red flags       | 5    | empty/"no"/"none"/"-" → 5, else → 0 |

Industry profile overrides (caps that differ from standard):

- **Ecommerce**: niche 50, DR 10, traffic 10
- **Fintech**: niche 35, no-red-flags 10
- **Local services**: traffic 5, geo 15

Hard disqualifiers (return `null`, excluded from main shortlist):

- DR below `minDR` (default 45)
- Traffic below `minTraffic` (default 2000)
- Link type contains "nofollow" when client requires dofollow
- Ranking contains "poor" or "bad"

Verification: `npx tsx scripts/verify-scoring.ts` runs the worked example from the framework doc and asserts the total is 82/100 across all seven dimensions.

## Updating the reasoning config

`ConfigVersion` rows are immutable JSONB snapshots validated by zod (`lib/config/types.ts`). To roll out a change you create a *new* row and repoint `ActiveConfig` at it — no redeploy required, no existing data mutated.

### Option A — In the app at `/admin/config` (recommended)

Navigate to **/admin/config** on the live URL. The page lists every `ConfigVersion` with the active one highlighted. Click **+ New Version** to open the editor pre-filled with the active snapshot:

1. Optionally add a **changelog note** (shows up in the version history)
2. Edit the **snapshot JSON** — adjust weights, caps, disqualifier patterns, profile overrides, prompts
3. Click **Validate** to dry-run the zod schema against your edit (typos are caught before save)
4. Choose whether to **activate immediately** on save (checkbox, default on) or stage the version for later activation
5. Click **Save & Activate** (or **Save Version**)

To activate a previously-saved version (rollback or stage-then-activate): on the **/admin/config** page, click **Activate** next to any inactive version, confirm. Single click, no SQL.

### Option B — Prisma Studio (no SQL needed)

```
npm run db:studio
```

1. Open the **ConfigVersion** model in the left sidebar.
2. Find the currently active version (sorted by `versionNumber` desc). Click **Duplicate record**.
3. Increment `versionNumber` by 1. Edit the `snapshot` JSON in the modal — adjust weights, caps, disqualifier patterns, profile overrides, prompts, whatever.
4. Add a `note` describing the change (free-text changelog). **Save**.
5. Open the **ActiveConfig** model → the singleton row (`id = "singleton"`) → set `configVersionId` to the new ConfigVersion's id → **Save**.

The next scoring run picks up the new config. Existing campaigns continue to display their original scores because each `Campaign.configVersionId` is a hard pointer to the version it was scored against — they're not affected.

### Option C — SQL (Neon's web SQL editor or psql)

Open Neon's project dashboard → **SQL Editor**. Use this template (the example bumps the niche-match cap from 40 to 45 on the SaaS profile):

```sql
-- 1. Insert a new ConfigVersion, copying the current snapshot and patching
--    the field(s) you want to change. Replace the jsonb_set call with your
--    actual edit. Multiple fields = chain jsonb_set calls.
WITH active AS (
  SELECT cv.snapshot
  FROM "ConfigVersion" cv
  JOIN "ActiveConfig" ac ON ac."configVersionId" = cv.id
  WHERE ac.id = 'singleton'
),
next_version AS (
  SELECT COALESCE(MAX("versionNumber"), 0) + 1 AS n FROM "ConfigVersion"
)
INSERT INTO "ConfigVersion" ("versionNumber", snapshot, note)
SELECT
  next_version.n,
  jsonb_set(active.snapshot, '{profiles,SAAS,caps,nicheMatch}', '45'),
  'Bumped SaaS niche-match cap from 40 to 45'
FROM active, next_version
RETURNING id, "versionNumber";

-- 2. Activate the new version (paste the id returned above)
UPDATE "ActiveConfig"
SET "configVersionId" = <id_from_step_1>
WHERE id = 'singleton';
```

## Rolling back a config change

Every previous `ConfigVersion` row is preserved forever — they're immutable, so rollback is just repointing `ActiveConfig` at an older row.

### Option A — In the app at `/admin/config`

Open **/admin/config**, find the version you want to restore in the history table, click **Activate** next to it, confirm. Done. The next scoring run uses the rolled-back config; campaigns scored under a different version remain reproducible because each `Campaign.configVersionId` is a hard pointer to the version it was scored against.

### Option B — Prisma Studio

```
npm run db:studio
```

1. Open **ConfigVersion**, find the `versionNumber` you want to restore. Copy its `id`.
2. Open **ActiveConfig** → the singleton row → set `configVersionId` to the copied id → **Save**.

Done. The next scoring run uses the rolled-back config.

### Option C — SQL one-liner

```sql
UPDATE "ActiveConfig"
SET "configVersionId" = (
  SELECT id FROM "ConfigVersion" WHERE "versionNumber" = 2
)
WHERE id = 'singleton';
```

(Replace `2` with whichever version number you're rolling back to.)

### What rollback does NOT touch

- Existing `Campaign.configVersionId` foreign keys — campaigns stay pinned to their original config, so historical shortlists remain reproducible.
- The rolled-back-from `ConfigVersion` row — still in the table, available to re-activate, never mutated. There's no "delete" path for ConfigVersion rows by design.

## Deployment

Designed for **Railway** or **Render**; any Node host that supports Next.js works.

### Environment variables (production)

```
DATABASE_URL=postgresql://...
LOG_LEVEL=info
```

Use Neon's **pooled** connection string for the runtime `DATABASE_URL`. If your host runs migrations from a separate worker, set `DIRECT_DATABASE_URL` to the direct (non-pooled) URL.

### Build & start

```
npm install                 # also runs prisma generate via postinstall
npm run build               # next build
npm run db:deploy           # apply migrations on first deploy (or each deploy)
npm run db:seed             # one-time, seeds ConfigVersion #1
npm start                   # next start
```

On Railway: set the build command to `npm install && npm run build` and the start command to `npm run db:deploy && npm start`. The first deploy also needs `npm run db:seed` once.

## Verification scripts

Standalone scripts you can run against your local DB / inputs:

- `npm run verify:scoring` — asserts the scoring framework's worked example (82/100). Runs the deterministic engine against the canonical input and confirms each of the seven dimensions matches the expected output.
- `npm run verify:disqualifiers` — covers all 7 disqualifier codes (`DR_BELOW_MIN`, `TRAFFIC_BELOW_MIN`, `NOFOLLOW_REJECTED`, `BAD_RANKING`, `EXCLUDED_NICHE`, `COMPETITOR_BLOCKED`, `LINK_TYPE_MISMATCH`) with positive cases (should disqualify) and a negative case (clean domain should qualify). Exits non-zero on any regression.
- `npm run verify:export` — opens `.private/template.xlsx` and asserts every sheet header in `lib/xlsx/headers.ts` matches the template byte-for-byte. Whitespace is normalized (Google-Sheets-exported templates have embedded newlines in multi-line headers). Exits non-zero on any drift. **Run this before any release that touches `lib/xlsx/`.**
- `npm run verify` — runs all three of the above. Two of them (`scoring` and `disqualifiers`) are also wired into CI.

## CI

The `Verify` workflow at [`.github/workflows/verify.yml`](./.github/workflows/verify.yml) runs on every push to `main` and every pull request:

- ✅ **`verify:scoring`** — pure code test, runs in CI
- ✅ **`verify:disqualifiers`** — pure code test, runs in CI
- ⚙️ **`verify:export`** — local-only, NOT in CI

`verify:export` is deliberately excluded from CI because it reads `.private/template.xlsx` (gitignored, ~565 KB, contains client data). Hosting the file as a GitHub Actions secret would require splitting across many secrets (single-secret cap is 64 KB) or comparing against a frozen fixture (which just tests that code matches itself — pointless). The script's real value is **local drift-detection** when BlueTree ships a new template version. Run it manually before any release that touches `lib/xlsx/`:

```
npm run verify:export
```

If you forget, the worst case is a header mismatch that only ships to ops, who'll notice and report it. The CI tests catch the much more common regression class (scoring engine edits).
- `npx tsx scripts/verify-csv.ts` — parses the real inventory CSV and runs the engine across every row; prints field-coverage, disqualifier breakdown, top 10. Useful for diagnosing parser changes.
- `npx tsx scripts/dump-xlsx.ts [path]` — dumps a workbook's sheet structure.
- `npx tsx scripts/dump-docx.ts [path]` — extracts text from a Word doc.

## Notes on the BT template

### Tab count: 4 sheets exported

The spec calls for "4 tabs" and we ship exactly four:

| # | Sheet | Visibility | Columns | Populated |
|---|---|---|---|---|
| 1 | `Client Info` | visible | 22 | yes — one row per campaign with brief metadata |
| 2 | `CM` | visible | 39 | yes — one row per selected domain |
| 3 | `__CM_HISTORY` | hidden | 13 | header only (consumed by BlueTree's downstream CM tooling) |
| 4 | `__CM_STATE` | hidden | 10 | header only (consumed by BlueTree's downstream CM tooling) |

The `Referring Domains - <client>` sheet from the BlueTree template is intentionally **omitted** — it carries per-client Ahrefs backlink data that's imported by a different pipeline post-launch, not by this tool. Re-add it if your workflow needs the placeholder by importing `REFERRING_DOMAINS_HEADERS` from `lib/xlsx/headers.ts` (still exported for that purpose).

### CM tab column count: 39, not 32

The spec quoted "32 cols with static values" — that was an approximation. The actual BlueTree template has 39 physical columns: 33 named content cells + 4 trailing empty filler cells + `Hash`. We match the template byte-for-byte (header strings, ordering, the four empty headers, the final `Hash`) so the file is schema-compatible with the BlueTree CM workflow downstream. `lib/xlsx/headers.ts` is the source of truth.

### Formulas vs. static values

The provided template was exported from Google Sheets and contains `IMPORTRANGE` + `__xludf.DUMMYFUNCTION` formulas that don't execute in Excel. Our export writes the **computed values** directly into those cells (DR, Traffic, Order Price, DB Price, Can Use, TAT, Profit) so the file opens cleanly in Excel and Numbers. This matches the spec's "static values" requirement.
