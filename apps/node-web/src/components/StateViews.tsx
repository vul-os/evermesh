import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }): JSX.Element {
  return (
    <p role="status" className="py-10 text-center text-sm text-muted">
      {label}
    </p>
  );
}

export function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <p role="alert" className="vm-card px-6 py-10 text-center text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p role="status" className="vm-card px-6 py-14 text-center text-sm text-muted">
      {children}
    </p>
  );
}
