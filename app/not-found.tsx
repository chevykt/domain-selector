import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 text-xs uppercase tracking-wider text-fg-subtle">
        404
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
        Not found
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        The page or campaign you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="mt-6">
        <Button>Back to campaigns</Button>
      </Link>
    </main>
  );
}
