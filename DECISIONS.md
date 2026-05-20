# Decisions and Trade-offs

A one-page write-up of the choices behind the Domain Selector build: stack, the UX wins I'm proudest of, what I cut, and what I'd revisit with more time.

## Stack

**Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 (pg adapter) · Neon Postgres · Vercel.**

Server Actions handle every mutation (campaign create, inventory upload, scoring, selection toggle, delete) so there's no separate API surface to maintain or document. Prisma 7's driver-adapter model fits Neon's serverless connection pooling cleanly — pooled URL for runtime, direct URL for migrations. They each need what they need; the config separates them. Tailwind v4's `@theme` blocks let me version the dark-mode design tokens declaratively in `globals.css`, the same conceptual way the scoring config is versioned in the DB. Vercel + Neon was the lowest-friction path to a real live URL with no infrastructure code.

## UX decisions I'm proudest of

1. **Live preview while filling the brief.** The form is two columns: inputs on the left, a sticky right-side panel that updates on every keystroke — niche chips, target-page list, budget math (`$200 × 5 = $1,000`), filter recap, exclusion counts. No blind form-fill, no surprises on submit, no "did I type that right?"

2. **Sheet drawer for shortlist details, not inline row expand.** The spec called for per-dimension breakdown on every domain. Inline expand reflows the table, hides your scroll position, and forces a single row to be vertically tall. A right-edge Radix Dialog Sheet keeps the table dense and scannable while the breakdown gets a dedicated, focus-trapped, keyboard-dismissible canvas. The reasoning string is still inline under each domain so the spec is met without compromise.

3. **Dedupe + hidden-selection visibility ("what you see is what you export").** The BlueTree CSV has ~700 duplicate rows (one per link-type combo per domain). Dedupe-by-domain is on by default. When a user has selections that fall outside the visible deduped view, an amber banner explicitly says `"3 selected rows are hidden by dedupe"`. The metric strip, checkbox count, and Export button all read from the same `visibleSelections` array — counts never drift.

4. **Two-step inline delete instead of a modal dialog.** "Are you sure?" modals train muscle memory to dismiss. The Delete button transforms into `"Permanently delete <name>? [Yes, delete] [Cancel]"` inline, in the same UI context. Same protection against misclicks, no autopilot dismiss.

## What I cut

- **LLM enrichment of niche match.** The framework explicitly left this open. The prompt strings are wired into the config but inert. Determinism matters more than a marginal quality lift, and reproducibility was non-negotiable in the spec.
- **Campaign rename and "use as template" duplication.** Both are low-effort follow-ups; neither was load-bearing for the demo.

## What I'd change with more time

The original draft of this section listed an admin UI for config edits as the top priority. With time remaining in the window I built it instead — `/admin/config` is now live, lists every `ConfigVersion`, and lets ops author new versions with a schema-validated JSON editor or activate a previous version in one click. That moves "engineer required for weight tweaks" off the followup list entirely.

What's still left:

1. **GitHub Actions CI** running `npm run verify` on every PR. Right now `verify:scoring`, `verify:disqualifiers`, and `verify:export` are run manually before each release. Wiring them into CI would block merges that break either the framework worked example or the template byte-for-byte match. The `verify:export` test needs `.private/template.xlsx` as a base64-encoded GitHub secret since the file is gitignored — small bit of plumbing.
2. **Form-based config editor** (currently it's a JSON textarea with schema validation). The textarea is robust for now — full schema is checked before save, errors are field-pathed back to the user — but a form-by-field UI would catch fewer edge cases and be friendlier for non-developers. Probably a day's work to do well.
3. **Background job queue** (Inngest or Upstash QStash) for inventories beyond ~10k rows. Vercel's 60-second function cap is plenty today but not future-proof; this would handle larger jobs without architectural rework.
4. **Campaign rename + "use as template" duplication.** Both small but real UX wins for repeat operators.

## What got added during the extension window

These weren't in the original spec — built because they directly mitigated audit findings:

- **`/admin/config` + `/admin/config/new`** — full ConfigVersion management UI. Schema-validated JSON editor, version history with one-click activation, snapshot diff via the active version's expandable JSON view.
- **`scripts/verify-disqualifiers.ts`** — covers all 7 disqualifier codes (`DR_BELOW_MIN`, `TRAFFIC_BELOW_MIN`, `NOFOLLOW_REJECTED`, `BAD_RANKING`, `EXCLUDED_NICHE`, `COMPETITOR_BLOCKED`, `LINK_TYPE_MISMATCH`) with positive and negative cases. Wired into `npm run verify`.
