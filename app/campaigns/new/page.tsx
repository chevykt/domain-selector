import { BackLink } from "@/components/ui/back-link";
import { BriefForm } from "@/components/brief-form";

export const metadata = { title: "New campaign — Domain Selector" };

// Covers the createCampaign Server Action invoked from the BriefForm.
export const maxDuration = 60;

export default function NewCampaignPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-6">
        <BackLink href="/">Back to campaigns</BackLink>
      </nav>

      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
          New Campaign
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Capture the client brief in one pass. The live preview on the right
          updates as you fill the form — submit when it looks correct.
        </p>
      </header>

      <BriefForm />
    </main>
  );
}
