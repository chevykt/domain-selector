"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ANCHOR_STRATEGY_OPTIONS,
  LINK_TYPE_OPTIONS,
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

export function BriefForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Core fields
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* ---------- 01 Client ---------- */}
      <Card>
        <CardHeader
          step={1}
          title="Client"
          description="Who this campaign is for and which industry profile drives the scoring caps."
        />
        <CardBody className="grid gap-5 md:grid-cols-2">
          <Field
            label="Client name"
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
            label="Industry profile"
            hint="Adjusts dimension caps for the scoring engine."
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

      {/* ---------- 02 Niches & Target Pages ---------- */}
      <Card>
        <CardHeader
          step={2}
          title="Niches & target pages"
          description="Drives niche-match scoring. Niche keywords are matched against publishers' niche fields; target page keywords add to that signal."
        />
        <CardBody className="space-y-5">
          <Field
            label="Client niches"
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

          <Field label="Target pages" required error={fieldErrors.targetPages}>
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
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-default text-fg-muted hover:bg-bg-hover hover:text-fg-default disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addTargetPage}
              >
                + Add target page
              </Button>
            </div>
          </Field>
        </CardBody>
      </Card>

      {/* ---------- 03 Domain Criteria ---------- */}
      <Card>
        <CardHeader
          step={3}
          title="Domain criteria"
          description="Hard quality thresholds — domains failing these are filtered into the excluded view."
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
              label="Minimum traffic"
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
              label="Geo focus"
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
              label="Follow link preference"
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
              label="Link types preferred"
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

      {/* ---------- 04 Budget & Goals ---------- */}
      <Card>
        <CardHeader
          step={4}
          title="Budget & goals"
          description="Per-link budget powers the price-efficiency dimension; link goal drives totals on the shortlist."
        />
        <CardBody className="grid gap-5 md:grid-cols-3">
          <Field
            label="Budget per link ($)"
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
            label="Link count goal"
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
            label="Anchor text strategy"
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

      {/* ---------- 05 Exclusions ---------- */}
      <Card>
        <CardHeader
          step={5}
          title="Exclusions"
          description="Hard blocklist. Domains matching any of these are disqualified — visible in the excluded view with the reason."
        />
        <CardBody className="space-y-5">
          <Field
            label="Excluded niches / topics"
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
            label="Competitor / sites to avoid"
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

      {/* ---------- 06 Notes ---------- */}
      <Card>
        <CardHeader
          step={6}
          title="Team notes"
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

      {/* ---------- Submit ---------- */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Creating…" : "Create campaign →"}
        </Button>
      </div>
    </form>
  );
}
