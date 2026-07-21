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
        "flex gap-3 rounded-card border border-line bg-surface p-3.5 shadow-card",
        className,
      )}
    >
      <Avatar name={author.name} src={author.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium text-ink">{author.name}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {kindLabel}
          </span>
          <TimeAgo unixMs={createdAtMs} className="text-xs text-faint" />
        </header>
        <div className="mt-1 break-words text-sm text-ink">{body}</div>
      </div>
      {actions && <div className="flex shrink-0 items-start gap-2">{actions}</div>}
    </article>
  );
}
