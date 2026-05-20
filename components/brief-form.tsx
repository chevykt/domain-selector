"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, X } from "lucide-react";

import {
  ANCHOR_STRATEGY_OPTIONS,
  LINK_TYPE_OPTIONS,
  parseDomainList,
  parseNicheString,
  type AnchorStrategy,
  type LinkTypeKey,
} from "@/lib/brief/schema";
import {
  createCampaign,
  type CreateCampaignInput,
} from "@/app/actions/create-campaign";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PillGroup } from "@/components/ui/pill";
import { cn, formatCurrency } from "@/lib/utils";

interface TargetPageInput {
  url: string;
  keyword: string;
}

const INDUSTRY_OPTIONS = [
  { value: "SAAS", label: "SaaS (standard weights)" },
  { value: "ECOMMERCE", label: "Ecommerce" },
  { value: "FINTECH", label: "Fintech / regulated" },
  { value: "LOCAL_SERVICES", label: "Local Services" },
] as const;

const FOLLOW_OPTIONS = [
  { value: "DOFOLLOW", label: "Dofollow only" },
  { value: "NOFOLLOW", label: "Nofollow OK" },
  { value: "EITHER", label: "Either" },
] as const;

const INDUSTRY_LABEL: Record<string, string> = Object.fromEntries(
  INDUSTRY_OPTIONS.map((o) => [o.value, o.label])
);
const FOLLOW_LABEL: Record<string, string> = Object.fromEntries(
  FOLLOW_OPTIONS.map((o) => [o.value, o.label])
);
const ANCHOR_LABEL: Record<string, string> = Object.fromEntries(
  ANCHOR_STRATEGY_OPTIONS.map((o) => [o.value, o.label])
);
const LINK_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  LINK_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export function BriefForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Core
  const [clientName, setClientName] = useState("");
  const [industryProfile, setIndustryProfile] =
    useState<CreateCampaignInput["industryProfile"]>("SAAS");

  // Niches & targets
  const [nichesRaw, setNichesRaw] = useState("");
  const [targetPages, setTargetPages] = useState<TargetPageInput[]>([
    { url: "", keyword: "" },
  ]);

  // Domain criteria
  const [minDR, setMinDR] = useState("45");
  const [minTraffic, setMinTraffic] = useState("2000");
  const [followPreference, setFollowPreference] =
    useState<CreateCampaignInput["followPreference"]>("DOFOLLOW");
  const [geoFocus, setGeoFocus] = useState("global");
  const [linkTypes, setLinkTypes] = useState<LinkTypeKey[]>([]);

  // Budget & goals
  const [budgetPerLink, setBudgetPerLink] = useState("250");
  const [linkCountGoal, setLinkCountGoal] = useState("10");
  const [anchorStrategy, setAnchorStrategy] =
    useState<AnchorStrategy>("NATURAL_MIXED");

  // Exclusions
  const [excludedNichesRaw, setExcludedNichesRaw] = useState("");
  const [competitorBlocklistRaw, setCompetitorBlocklistRaw] = useState("");

  // Notes
  const [teamNotes, setTeamNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function updateTargetPage(i: number, patch: Partial<TargetPageInput>) {
    setTargetPages((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  }
  function addTargetPage() {
    setTargetPages((prev) => [...prev, { url: "", keyword: "" }]);
  }
  function removeTargetPage(i: number) {
    setTargetPages((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const input: CreateCampaignInput = {
      clientName,
      nichesRaw,
      targetPages,
      budgetPerLink: Number(budgetPerLink),
      geoFocus,
      followPreference,
      minDR: Number(minDR),
      minTraffic: Number(minTraffic),
      linkCountGoal: Number(linkCountGoal),
      industryProfile,
      excludedNichesRaw,
      competitorBlocklistRaw,
      linkTypes,
      anchorStrategy,
      teamNotes,
    };

    startTransition(async () => {
      const result = await createCampaign(input);
      if (result && !result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else if (result && result.ok) {
        router.push(`/campaigns/${result.campaignId}`);
      }
    });
  }

  // Derived values for the live summary
  const niches = parseNicheString(nichesRaw);
  const excludedNichesList = parseNicheString(excludedNichesRaw);
  const competitorList = parseDomainList(competitorBlocklistRaw);
  const filledTargetPages = targetPages.filter((p) => p.url || p.keyword);
  const budgetNum = Number(budgetPerLink) || 0;
  const linkGoalNum = Number(linkCountGoal) || 0;
  const totalBudget = budgetNum * linkGoalNum;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10"
    >
      {/* ============== Left column: form ============== */}
      <div className="min-w-0 space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {/* 01 Client */}
        <Card>
          <CardHeader
            step={1}
            title="Client"
            description="Who this campaign is for and which industry profile drives the scoring caps."
          />
          <CardBody className="grid gap-5 md:grid-cols-2">
            <Field
              label="Client Name"
              required
              error={fieldErrors.clientName}
            >
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                placeholder="e.g. Biograph"
              />
            </Field>
            <Field
              label="Industry Profile"
              hint="Adjusts the dimension caps used by the scoring engine."
              error={fieldErrors.industryProfile}
            >
              <Select
                value={industryProfile}
                onChange={(e) =>
                  setIndustryProfile(
                    e.target.value as CreateCampaignInput["industryProfile"]
                  )
                }
              >
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        {/* 02 Niches & target pages */}
        <Card>
          <CardHeader
            step={2}
            title="Niches & Target Pages"
            description="These drive niche-match scoring. Keywords from target pages add to the signal."
          />
          <CardBody className="space-y-5">
            <Field
              label="Client Niches"
              required
              hint="Comma-separated. e.g. saas, hr software, employee management"
              error={fieldErrors.niches}
            >
              <Textarea
                value={nichesRaw}
                onChange={(e) => setNichesRaw(e.target.value)}
                rows={2}
                required
                placeholder="saas, hr software, employee management"
              />
            </Field>
            <Field
              label="Target Pages"
              required
              error={fieldErrors.targetPages}
            >
              <div className="space-y-2">
                {targetPages.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="url"
                      value={p.url}
                      onChange={(e) =>
                        updateTargetPage(i, { url: e.target.value })
                      }
                      placeholder="https://client.com/landing-page"
                      className="flex-1"
                    />
                    <Input
                      value={p.keyword}
                      onChange={(e) =>
                        updateTargetPage(i, { keyword: e.target.value })
                      }
                      placeholder="primary keyword for this page"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeTargetPage(i)}
                      disabled={targetPages.length === 1}
                      aria-label="Remove target page"
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md",
                        "border border-border-default text-fg-muted",
                        "hover:bg-bg-hover hover:text-fg-strong",
                        "disabled:cursor-not-allowed disabled:opacity-40"
                      )}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTargetPage}
                >
                  + Add Target Page
                </Button>
              </div>
            </Field>
          </CardBody>
        </Card>

        {/* 03 Domain criteria */}
        <Card>
          <CardHeader
            step={3}
            title="Domain Criteria"
            description="Hard quality thresholds. Domains failing these are filtered into the excluded view."
          />
          <CardBody className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <Field
                label="Minimum DR"
                hint="Ahrefs Domain Rating."
                error={fieldErrors.minDR}
              >
                <Input
                  type="number"
                  value={minDR}
                  onChange={(e) => setMinDR(e.target.value)}
                  min="0"
                  max="100"
                />
              </Field>
              <Field
                label="Minimum Traffic"
                hint="Monthly organic visits."
                error={fieldErrors.minTraffic}
              >
                <Input
                  type="number"
                  value={minTraffic}
                  onChange={(e) => setMinTraffic(e.target.value)}
                  min="0"
                />
              </Field>
              <Field
                label="Geo Focus"
                hint='"global" or a country code (us, gb, in, …).'
                error={fieldErrors.geoFocus}
              >
                <Input
                  value={geoFocus}
                  onChange={(e) => setGeoFocus(e.target.value)}
                  placeholder="global"
                />
              </Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Follow Link Preference"
                error={fieldErrors.followPreference}
              >
                <Select
                  value={followPreference}
                  onChange={(e) =>
                    setFollowPreference(
                      e.target.value as CreateCampaignInput["followPreference"]
                    )
                  }
                >
                  {FOLLOW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Link Types Preferred"
                hint="Leave empty to allow all. Pick one or more to disqualify domains that don't offer any."
                error={fieldErrors.linkTypes}
              >
                <PillGroup
                  options={LINK_TYPE_OPTIONS}
                  value={linkTypes}
                  onChange={setLinkTypes}
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* 04 Budget & goals */}
        <Card>
          <CardHeader
            step={4}
            title="Budget & Goals"
            description="Per-link budget powers price-efficiency scoring. Link goal drives shortlist totals."
          />
          <CardBody className="grid gap-5 md:grid-cols-3">
            <Field
              label="Budget per Link ($)"
              required
              error={fieldErrors.budgetPerLink}
            >
              <Input
                type="number"
                value={budgetPerLink}
                onChange={(e) => setBudgetPerLink(e.target.value)}
                min="1"
                step="0.01"
                required
              />
            </Field>
            <Field
              label="Link Count Goal"
              required
              error={fieldErrors.linkCountGoal}
            >
              <Input
                type="number"
                value={linkCountGoal}
                onChange={(e) => setLinkCountGoal(e.target.value)}
                min="1"
                required
              />
            </Field>
            <Field
              label="Anchor Text Strategy"
              hint="Informational — flows to the export Notes column."
              error={fieldErrors.anchorStrategy}
            >
              <Select
                value={anchorStrategy}
                onChange={(e) =>
                  setAnchorStrategy(e.target.value as AnchorStrategy)
                }
              >
                {ANCHOR_STRATEGY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        {/* 05 Exclusions */}
        <Card>
          <CardHeader
            step={5}
            title="Exclusions"
            description="Hard blocklist. Domains matching any of these are disqualified — visible in the excluded view with the reason."
          />
          <CardBody className="space-y-5">
            <Field
              label="Excluded Niches / Topics"
              hint='Comma-separated. e.g. "gambling, cbd, adult, payday loans"'
              error={fieldErrors.excludedNiches}
            >
              <Textarea
                value={excludedNichesRaw}
                onChange={(e) => setExcludedNichesRaw(e.target.value)}
                rows={2}
                placeholder="gambling, cbd, adult, payday loans"
              />
            </Field>
            <Field
              label="Competitor / Sites to Avoid"
              hint="One domain per line, or comma-separated. Pasted URLs are accepted (protocol and path are stripped)."
              error={fieldErrors.competitorBlocklist}
            >
              <Textarea
                value={competitorBlocklistRaw}
                onChange={(e) => setCompetitorBlocklistRaw(e.target.value)}
                rows={3}
                placeholder="competitor1.com&#10;competitor2.com"
              />
            </Field>
          </CardBody>
        </Card>

        {/* 06 Notes */}
        <Card>
          <CardHeader
            step={6}
            title="Team Notes"
            description="Free-form context for the campaign team. Flows to the export Notes column. Optional."
          />
          <CardBody>
            <Field
              label="Notes"
              hint="Brand voice, prior experiences, special opportunities, client quirks…"
            >
              <Textarea
                value={teamNotes}
                onChange={(e) => setTeamNotes(e.target.value)}
                rows={3}
                placeholder="Brand voice, past experiences, specific opportunities, client quirks…"
              />
            </Field>
          </CardBody>
        </Card>

        {/* Submit bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Creating…" : "Create Campaign →"}
          </Button>
        </div>
      </div>

      {/* ============== Right column: live summary ============== */}
      <aside
        aria-label="Live brief preview"
        className="lg:sticky lg:top-8 lg:self-start"
      >
        <Card>
          <CardHeader
            title="Live Preview"
            description="Reflects what gets saved when you submit."
          />
          <CardBody className="space-y-5 text-sm">
            {/* Client */}
            <SummarySection title="Client">
              {clientName ? (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-fg-strong">
                    {clientName}
                  </span>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                    {INDUSTRY_LABEL[industryProfile] ?? industryProfile}
                  </span>
                </div>
              ) : (
                <EmptyHint>Add a client name to start.</EmptyHint>
              )}
            </SummarySection>

            {/* Niches */}
            <SummarySection
              title="Niches"
              count={niches.length > 0 ? niches.length : undefined}
            >
              {niches.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {niches.map((n, i) => (
                    <Chip key={i}>{n}</Chip>
                  ))}
                </div>
              ) : (
                <EmptyHint>No niches yet — niche match scores 0 without them.</EmptyHint>
              )}
            </SummarySection>

            {/* Target pages */}
            <SummarySection
              title="Target Pages"
              count={
                filledTargetPages.length > 0 ? filledTargetPages.length : undefined
              }
            >
              {filledTargetPages.length > 0 ? (
                <ul className="space-y-1.5">
                  {filledTargetPages.map((p, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border-subtle bg-bg-input/60 px-2.5 py-1.5"
                    >
                      <div className="truncate text-xs text-fg-default">
                        {p.url || <em className="text-fg-subtle">no URL</em>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-muted">
                        <Hash className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate font-mono text-accent">
                          {p.keyword || (
                            <em className="text-fg-subtle">no keyword</em>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint>Add at least one target page.</EmptyHint>
              )}
            </SummarySection>

            {/* Filters */}
            <SummarySection title="Filters">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <KV label="Min DR" value={minDR || "—"} />
                <KV label="Min traffic" value={Number(minTraffic).toLocaleString() || "—"} />
                <KV label="Geo" value={geoFocus || "—"} />
                <KV
                  label="Follow"
                  value={FOLLOW_LABEL[followPreference] ?? followPreference}
                />
                <KV
                  label="Link types"
                  value={
                    linkTypes.length === 0
                      ? "any"
                      : linkTypes.map((t) => LINK_TYPE_LABEL[t] ?? t).join(", ")
                  }
                />
                <KV
                  label="Anchor"
                  value={ANCHOR_LABEL[anchorStrategy] ?? anchorStrategy}
                />
              </dl>
            </SummarySection>

            {/* Budget */}
            <SummarySection title="Budget">
              {budgetNum > 0 && linkGoalNum > 0 ? (
                <div className="rounded-md border border-border-subtle bg-bg-input/60 px-3 py-2">
                  <div className="text-xs text-fg-muted">
                    {formatCurrency(budgetNum)} × {linkGoalNum} link
                    {linkGoalNum === 1 ? "" : "s"}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-fg-strong">
                    {formatCurrency(totalBudget)}
                  </div>
                </div>
              ) : (
                <EmptyHint>Set budget per link and link count goal.</EmptyHint>
              )}
            </SummarySection>

            {/* Exclusions */}
            {(excludedNichesList.length > 0 || competitorList.length > 0) && (
              <SummarySection title="Exclusions">
                <dl className="space-y-1 text-xs">
                  {excludedNichesList.length > 0 && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-fg-muted">Niches</dt>
                      <dd className="truncate text-right font-medium text-fg-default">
                        {excludedNichesList.length}
                      </dd>
                    </div>
                  )}
                  {competitorList.length > 0 && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-fg-muted">Blocked sites</dt>
                      <dd className="truncate text-right font-medium text-fg-default">
                        {competitorList.length}
                      </dd>
                    </div>
                  )}
                </dl>
              </SummarySection>
            )}

            {/* Notes */}
            {teamNotes.trim() && (
              <SummarySection title="Notes">
                <p className="whitespace-pre-wrap text-xs text-fg-default">
                  {teamNotes.length > 240
                    ? `${teamNotes.slice(0, 240)}…`
                    : teamNotes}
                </p>
              </SummarySection>
            )}
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}

/* ============================================================================
   Summary-panel helpers
   ============================================================================ */

function SummarySection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-[11px] tabular-nums text-fg-muted">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-fg-subtle">{children}</p>;
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="truncate text-fg-muted">{label}</dt>
      <dd className="truncate text-right font-medium text-fg-default">
        {value}
      </dd>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border-default bg-bg-input px-2 py-0.5 text-[11px] text-fg-default">
      {children}
    </span>
  );
}
