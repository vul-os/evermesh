import { useEffect, useState } from "react";

/**
 * Relative-time label ("3 minutes ago") backed by a real `<time
 * dateTime>` element so assistive tech and copy/paste get the absolute
 * timestamp. Re-renders on an interval so long-open pages stay accurate;
 * respects `prefers-reduced-motion` by not animating (there is nothing
 * to animate here — the interval only changes text content).
 */

export interface TimeAgoProps {
  /** Unix seconds (spec records use seconds; API.md timestamps are ms). */
  unixMs: number;
  className?: string;
}

const UNITS: [number, string][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.348, "week"],
  [12, "month"],
  [Number.POSITIVE_INFINITY, "year"],
];

/** Pure formatting function — kept separate from the component for testing. */
export function formatTimeAgo(unixMs: number, now: number = Date.now()): string {
  let diffSeconds = Math.max(0, Math.round((now - unixMs) / 1000));
  if (diffSeconds < 5) return "just now";

  let value = diffSeconds;
  let unitName = "second";
  for (const [amount, name] of UNITS) {
    if (value < amount) {
      unitName = name;
      break;
    }
    value = Math.round(value / amount);
    unitName = name;
  }
  const plural = value === 1 ? "" : "s";
  return `${value} ${unitName}${plural} ago`;
}

export function TimeAgo({ unixMs, className }: TimeAgoProps): JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time dateTime={new Date(unixMs).toISOString()} className={className} title={new Date(unixMs).toLocaleString()}>
      {formatTimeAgo(unixMs, now)}
    </time>
  );
}
