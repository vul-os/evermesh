import { Link } from "react-router-dom";

export function NotFound(): JSX.Element {
  return (
    <div className="vm-card px-6 py-14 text-center">
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-muted">There&rsquo;s nothing at this address.</p>
      <Link to="/" className="mt-4 inline-block vm-btn vm-btn-primary">
        Back to Browse
      </Link>
    </div>
  );
}
