import type { ReactNode } from "react";

export interface QueryBoundaryProps<T> {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  children: (data: T) => ReactNode;
}

/**
 * Every query in this app renders through here so loading/error/empty
 * states are consistent everywhere (required: "the web app must render
 * usable, with empty states, when the API returns zero content").
 */
export function QueryBoundary<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  loadingLabel = "Loading…",
  emptyLabel = "Nothing here yet.",
  children,
}: QueryBoundaryProps<T>): JSX.Element {
  if (isLoading) {
    return (
      <p role="status" className="py-6 text-sm text-slate-500 dark:text-slate-400">
        {loadingLabel}
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="py-6 text-sm text-red-700 dark:text-red-300">
        {errorMessage(error)}
      </p>
    );
  }
  if (data === undefined) {
    return (
      <p role="status" className="py-6 text-sm text-slate-500 dark:text-slate-400">
        {emptyLabel}
      </p>
    );
  }
  if (isEmpty?.(data)) {
    return (
      <p role="status" className="py-6 text-sm text-slate-500 dark:text-slate-400">
        {emptyLabel}
      </p>
    );
  }
  return <>{children(data)}</>;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
