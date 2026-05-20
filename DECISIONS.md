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

- **An admin UI for editing config weights.** The spec required versioned, runtime-readable config in the DB — that's done (`ConfigVersion` JSONB snapshots, monotonic `versionNumber`, `ActiveConfig` singleton pointer for one-line SQL rollback). I treated a GUI for editing weights as a follow-up rather than scope creep. Today, ops edits via Prisma Studio or Neon's SQL editor.
- **LLM enrichment of niche match.** The framework explicitly left this open. The prompt strings are wired into the config but inert. Determinism matters more than a marginal quality lift, and reproducibility was non-negotiable in the spec.
- **Campaign rename and "use as template" duplication.** Both are low-effort follow-ups; neither was load-bearing for the demo.

## What I'd change with more time

1. **Admin UI at `/admin/config`** that clones the active snapshot into an editable JSON / form view and writes a new `ConfigVersion` on save. ~3 hours; biggest leverage gain because it removes "engineer required" from the config-update path.
2. **Per-disqualifier unit tests.** `verify:scoring` covers the worked example end-to-end. The three negative-list disqualifier codes (`EXCLUDED_NICHE`, `COMPETITOR_BLOCKED`, `LINK_TYPE_MISMATCH`) have no regression coverage today. Half a day to fix.
3. **GitHub Actions CI** running `npm run verify` on every PR — block merge if either the scoring example or the export template-fidelity test fails.
4. **Background job queue** (Inngest or Upstash QStash) for inventories beyond ~10k rows. Vercel's 60-second function cap is plenty today but not future-proof; this would handle larger jobs without architectural rework.
