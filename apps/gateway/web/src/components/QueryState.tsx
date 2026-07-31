import type { ReactNode } from "react";

export interface QueryBoundaryProps<T> {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  loadingLabel?: string;
  /** Custom loading visual (e.g. a `SkeletonGrid`) for a boundary whose
   *  content is itself a grid — the plain text line below collapses the
   *  page to almost nothing while a request is in flight. The label is
   *  still rendered, visually hidden, so the loading state keeps one
   *  `role="status"` announcement either way. */
  loading?: ReactNode;
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
  loading,
  emptyLabel = "Nothing here yet.",
  children,
}: QueryBoundaryProps<T>): JSX.Element {
  if (isLoading) {
    if (loading) {
      return (
        <div>
          <p role="status" className="sr-only">
            {loadingLabel}
          </p>
          {loading}
        </div>
      );
    }
    return (
      <p role="status" className="py-6 text-sm text-muted">
        {loadingLabel}
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="vm-card border-red-300 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:text-red-300">
        {errorMessage(error)}
      </p>
    );
  }
  if (data === undefined) {
    return (
      <p role="status" className="py-6 text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }
  if (isEmpty?.(data)) {
    return (
      <p role="status" className="py-6 text-sm text-muted">
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
