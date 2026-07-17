import type { ReactNode } from "react";
import { Avatar } from "./Avatar.js";
import { TimeAgo } from "./TimeAgo.js";
import { cn } from "./cn.js";

export interface RecordCardProps {
  author: { name: string; avatarUrl?: string | null };
  /** Unix ms. */
  createdAtMs: number;
  /** Human label for the record kind, e.g. "Comment", "Claim: author". */
  kindLabel: string;
  /** Short summary of the record body (comment text, claim statement, ...). */
  body: ReactNode;
  /** Optional right-aligned slot (reply button, status badge, ...). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Generic display for any signed record surfaced in the UI (comments,
 * claims, receipts, notices). Kind-specific panels compose this rather
 * than reinventing author/time/body layout each time.
 */
export function RecordCard({ author, createdAtMs, kindLabel, body, actions, className }: RecordCardProps): JSX.Element {
  return (
    <article
      className={cn(
        "flex gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      <Avatar name={author.name} src={author.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium text-slate-900 dark:text-slate-100">{author.name}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {kindLabel}
          </span>
          <TimeAgo unixMs={createdAtMs} className="text-xs text-slate-500 dark:text-slate-400" />
        </header>
        <div className="mt-1 break-words text-sm text-slate-800 dark:text-slate-200">{body}</div>
      </div>
      {actions && <div className="flex shrink-0 items-start gap-2">{actions}</div>}
    </article>
  );
}
