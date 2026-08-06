import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DependencyList } from "react";

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
  // Assigning fnRef.current directly in the render body mutates a ref
  // during render, which react-hooks/refs flags — render is meant to stay
  // pure. useLayoutEffect (no deps, so it runs after every render) is
  // React's own documented place for this "always point at the latest
  // callback" idiom instead.
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

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
    // to forward) plus `reloadToken` to support `reload()` — a spread, not
    // a fixed literal, so exhaustive-deps can't statically verify it and
    // warns (real ESLint as of this repo's lint pass; ineligible for a
    // narrower fix since the array's whole point is being caller-shaped).
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, error, loading, reload };
}
