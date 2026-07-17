import { Link } from "react-router-dom";

export function NotFound(): JSX.Element {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        There&rsquo;s nothing at this address on this gateway.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-700 underline dark:text-brand-200">
        Back to the latest videos
      </Link>
    </div>
  );
}
