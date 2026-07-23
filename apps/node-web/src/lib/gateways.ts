/**
 * The gateway URL allow-list `Settings.tsx` manages. Persisted in
 * `localStorage` rather than through a Rust-side table: unlike pins and
 * budgets (`crates/evermesh-node/src/pinning.rs`, the source of truth
 * for anything that gates what gets downloaded or kept on disk), *which
 * gateways this window has open tabs to* is pure UI convenience state —
 * nothing else reads it, and every actual fetch still goes through
 * `gateway_client.rs`'s own `http(s)`-only URL validation regardless of
 * what's in this list.
 */

const STORAGE_KEY = "evermesh-node:gateways";
const CURRENT_KEY = "evermesh-node:current-gateway";

export function listGateways(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addGateway(url: string): string[] {
  const trimmed = url.trim().replace(/\/+$/, "");
  const next = Array.from(new Set([...listGateways(), trimmed]));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable (private mode, quota) — in-memory only for this session. */
  }
  return next;
}

export function removeGateway(url: string): string[] {
  const next = listGateways().filter((g) => g !== url);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* see addGateway */
  }
  if (getCurrentGateway() === url) setCurrentGateway(next[0]);
  return next;
}

export function getCurrentGateway(): string | undefined {
  try {
    return localStorage.getItem(CURRENT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setCurrentGateway(url: string | undefined): void {
  try {
    if (url) localStorage.setItem(CURRENT_KEY, url);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    /* see addGateway */
  }
}
