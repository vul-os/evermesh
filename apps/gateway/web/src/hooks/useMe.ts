import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ApiError, getMe } from "../api.js";
import type { MeResponse } from "../lib/api-types.js";

/**
 * Current session, or `null` when signed out (a 401 from `/api/me` is
 * expected steady state for anonymous viewers, not an error to surface).
 * Any other failure (network, 5xx) propagates as a query error.
 */
export function useMe(): UseQueryResult<MeResponse | null> {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await getMe();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.code === "unauthorized")) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}
