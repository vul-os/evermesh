import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * A small, dependency-free stand-in for `@tanstack/react-query` (which
 * `apps/gateway/web` uses): this app's every data source is a Tauri
 * `invoke()` call, not a browser `fetch()`, and there is exactly one
 * consumer per query with no cross-route cache-sharing need to justify a
 * full query-client dependency. Re-runs `fn` whenever `deps` changes;
 * guards against setting state after the component driving a stale call
 * unmounts or `deps` changes again mid-flight.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fnRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // `deps` is caller-controlled (the dependency array this hook exists
    // to forward) plus `reloadToken` to support `reload()` — not a fixed
    // literal ESLint's exhaustive-deps rule could check statically, but
    // this project lints with `tsc --noEmit` only (see
    // apps/gateway/web/package.json), which does not flag this.
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, error, loading, reload };
}
