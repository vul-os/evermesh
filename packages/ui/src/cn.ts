/**
 * Minimal class-name joiner. Falsy values (false/null/undefined/"") are
 * dropped so conditional Tailwind classes read cleanly at call sites:
 *
 *   cn("btn", isActive && "btn-active", error && "btn-error")
 *
 * Deliberately not a full `clsx` reimplementation (no object-map form) —
 * this package's components only ever need the array form.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...parts: ClassValue[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(" ");
}
