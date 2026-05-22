# Decisions and Trade-offs

A one-page write-up of the choices behind the Domain Selector build: stack, the UX wins I'm proudest of, what I cut, and the scope boundaries I drew between a submission and a production deployment.

## Stack

**Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 (pg adapter) · Neon Postgres · Vercel.**

Server Actions handle every mutation (campaign create, inventory upload, scoring, selection toggle, delete) so there's no separate API surface to maintain or document. Prisma 7's driver-adapter model fits Neon's serverless connection pooling cleanly — pooled URL for runtime, direct URL for migrations. They each need what they need; the config separates them. Tailwind v4's `@theme` blocks let me version the dark-mode design tokens declaratively in `globals.css`, the same conceptual way the scoring config is versioned in the DB. Vercel + Neon was the lowest-friction path to a real live URL with no infrastructure code.

## UX decisions I'm proudest of

1. **Live preview while filling the brief.** The form is two columns: inputs on the left, a sticky right-side panel that updates on every keystroke — niche chips, target-page list, budget math (`$200 × 5 = $1,000`), filter recap, exclusion counts. No blind form-fill, no surprises on submit, no "did I type that right?"

2. **Sheet drawer for shortlist details, not inline row expand.** The spec called for per-dimension breakdown on every domain. Inline expand reflows the table, hides your scroll position, and forces a single row to be vertically tall. A right-edge Radix Dialog Sheet keeps the table dense and scannable while the breakdown gets a dedicated, focus-trapped, keyboard-dismissible canvas. The reasoning string is still inline under each domain so the spec is met without compromise.

3. **Dedupe + hidden-selection visibility ("what you see is what you export").** The BlueTree CSV has ~700 duplicate rows (one per link-type combo per domain). Dedupe-by-domain is on by default. When a user has selections that fall outside the visible deduped view, an amber banner explicitly says `"3 selected rows are hidden by dedupe"`. The metric strip, checkbox count, and Export button all read from the same `visibleSelections` array — counts never drift.

4. **Schema-validated JSON editor for config + immutable version history.** The reasoning layer lives in DB-backed `ConfigVersion` snapshots. Rather than build a form-by-field editor (which would either constrain edits or take a week to do right), `/admin/config/new` is a JSON textarea pre-filled with the active snapshot, validated against the same zod schema the server uses — typos and missing fields surface as field-pathed errors *before* the new row is written. Versions are immutable: edits create new rows, never mutate; rollback is one click that flips the `ActiveConfig` pointer to an earlier row. Same audit-trail integrity as the rest of the system, with an actual UI on top instead of "open Prisma Studio."

## What I cut

- **LLM enrichment of niche match.** The framework explicitly left this open. The prompt strings are wired into the config but inert. Determinism matters more than a marginal quality lift, and reproducibility was non-negotiable in the spec.
- **Campaign rename and "use as template" duplication.** Both are low-effort follow-ups; neither was load-bearing for the demo.

## Scope boundaries & production roadmap

Everything the framework and brief specify is built and verified. The items below are deliberate scope boundaries — the gap between a correct submission and a long-running production deployment — and mirror the framework's own section 8 ("what this does not cover, and where future iterations go"). Each is intentionally deferred, with the reason:

- **Background job queue** (Inngest / Upstash QStash) — only matters past ~10k-row inventories. The sample is ~2.3k rows and scores well within Vercel's 60s function budget, so a queue now would be over-engineering. Scoring is already a pure function, so moving it behind a queue later needs no rewrite.
- **Form-based config editor** — the JSON editor already gives full, schema-validated control over every weight and rule. A field-by-field form is an ergonomics upgrade for non-technical operators, not a missing capability.
- **Observability** — Sentry for error capture and an `/admin/health` endpoint (DB connectivity, active config version, last scoring run). Earns its keep once the app is live and on-call-owned; not load-bearing for this submission.
