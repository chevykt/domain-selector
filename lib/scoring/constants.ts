// A scoring run is hard-capped by the route's `maxDuration` (60s on Vercel).
// Any campaign that has sat in SCORING_IN_PROGRESS longer than this was claimed
// by a process that died (function timeout / crash) before it could release the
// lock in its catch block. Since a live run can't exceed the 60s cap, anything
// past this threshold is provably dead and safe to take over / recover from.
export const STALE_LOCK_MS = 90_000;

// True when a campaign's SCORING_IN_PROGRESS lock is old enough to be considered
// dead (its owning process timed out/crashed before releasing it). `now` is
// injectable for testing; defaults to the current time.
export function isScoringLockStale(
  status: string,
  updatedAt: Date,
  now: number = Date.now()
): boolean {
  return (
    status === "SCORING_IN_PROGRESS" &&
    now - updatedAt.getTime() >= STALE_LOCK_MS
  );
}
