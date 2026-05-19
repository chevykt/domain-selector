# Domain Selector

Internal tool for **BlueTree**. Scores publisher domains from the vendor inventory CSV against a client brief, surfaces the top-N shortlist with include/exclude controls, and exports a Campaign Management XLSX matching the BT template.

The reasoning layer is **configurable** and **versioned**: every campaign records the exact `ConfigVersion` it was scored against, so reopening a campaign reproduces the same shortlist verbatim. Scoring is **deterministic** — no LLM in the scoring path.

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

## Editing the config

`ConfigVersion` rows are JSONB blobs validated by zod (`lib/config/types.ts`). To roll out a change:

1. Create a new `ConfigVersion` row with a higher `versionNumber` and your edited snapshot.
2. Update `ActiveConfig.configVersionId` to point at it.

Existing campaigns continue to display their original scores because they reference the old `ConfigVersion`. Rolling back is a single SQL update on `ActiveConfig.configVersionId`.

(An admin UI for this is intentionally out of scope for v1 — it's a single-row pointer change.)

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

- `npx tsx scripts/verify-scoring.ts` — asserts framework worked example (82/100).
- `npx tsx scripts/verify-csv.ts` — parses the real inventory CSV and runs the engine across every row; prints field-coverage, disqualifier breakdown, top 10.
- `npx tsx scripts/dump-xlsx.ts [path]` — dumps a workbook's sheet structure.
- `npx tsx scripts/dump-docx.ts [path]` — extracts text from a Word doc.

## Notes on the BT template

The provided XLSX is a Google-Sheets-exported file with `IMPORTRANGE` formulas that reference external sheets. Those formulas don't execute in real Excel; our export writes computed values directly to those cells so the file opens cleanly. Column count and header strings match the template exactly (39 columns on the CM tab including 4 trailing empty headers and the final `Hash` column).

The `Referring Domains - <client>` sheet is included with the standard header row but left empty — it's typically imported separately from Ahrefs / SEMrush after a campaign launches.
