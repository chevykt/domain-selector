import Link from "next/link";

import { BriefForm } from "@/components/brief-form";

export const metadata = { title: "New campaign — Domain Selector" };

export default function NewCampaignPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm">
        <Link
          href="/"
          className="text-fg-muted transition-colors hover:text-fg-strong"
        >
          ← Back to campaigns
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
          New campaign
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Capture the client brief in one pass. After creating the campaign
          you&apos;ll upload the vendor inventory CSV and run scoring.
        </p>
      </header>

      <BriefForm />
    </main>
  );
}
