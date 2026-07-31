import type { ReactNode } from "react";

/** The grid rhythm `Browse.tsx` and `SkeletonGrid` below share — kept in
 *  one place so a card and its loading placeholder can't drift apart. */
export const GRID_CLASS = "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function LoadingState({ label = "Loading…" }: { label?: string }): JSX.Element {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <SkeletonGrid />
    </>
  );
}

/**
 * A grid-shaped loading placeholder — ported from
 * `apps/gateway/web/src/components/VideoGrid.tsx`'s `SkeletonGrid`, same
 * shape, same reasoning: a lone "Loading…" line collapses this desktop
 * client's browse view to almost nothing while the native `fetch_catalog`
 * call is in flight.
 */
export function SkeletonGrid({ count = 8 }: { count?: number }): JSX.Element {
  return (
    <ul aria-hidden="true" className={GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-video w-full rounded-card border border-line-strong bg-surface-2" />
          <div className="mt-2.5 flex gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
            <div className="mt-0.5 flex-1 space-y-2">
              <div className="h-3 w-[85%] rounded-full bg-surface-2" />
              <div className="h-2.5 w-[45%] rounded-full bg-surface-2" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <p role="alert" className="vm-card border-red-300 px-6 py-10 text-center text-sm text-red-700 dark:border-red-800 dark:text-red-300">
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div role="status" className="vm-card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 text-faint">
        <rect x="4" y="9" width="32" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M16 15.5v9l9-4.5-9-4.5Z" fill="currentColor" />
      </svg>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
