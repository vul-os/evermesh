import { useQuery } from "@tanstack/react-query";
import { getPolicy } from "../api.js";
import { QueryBoundary } from "../components/QueryState.js";

/**
 * The moderation-policy page (spec 009 §1/§7): every gateway MUST
 * publish this, and it MUST NOT be removed from the uniform UI. It also
 * carries the "counts are this gateway's claims" explainer (spec 009
 * §6) so viewers understand that view/comment/reaction counts describe
 * this gateway's index, not the substrate.
 */
export function Policy(): JSX.Element {
  const query = useQuery({ queryKey: ["policy"], queryFn: getPolicy });

  return (
    <QueryBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={query.data}
      loadingLabel="Loading policy…"
    >
      {(policy) => (
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold">{policy.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{policy.description}</p>

          <section className="mt-6 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
            <p>
              <strong>Counts are this gateway&rsquo;s claims.</strong> View, comment, and reaction counts shown
              throughout this site reflect only what {policy.name} has selected and indexed — not a global count
              across the Vidmesh network. Other gateways serving the same content may show different numbers.
            </p>
          </section>

          <section
            className="prose prose-slate mt-6 max-w-none dark:prose-invert"
            // Server-rendered, same-origin moderation policy HTML from this
            // gateway operator (API.md `GET /api/policy`). Not user content.
            dangerouslySetInnerHTML={{ __html: policy.moderationPolicyHtml }}
          />

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Subscribed takedown feeds</h2>
            {policy.feeds.length === 0 ? (
              <p role="status" className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                This gateway isn&rsquo;t subscribed to any compliance feeds.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {policy.feeds.map((f) => (
                  <li key={f.feed} className="rounded border border-slate-200 px-3 py-1.5 dark:border-slate-700">
                    <span className="font-medium">{f.publisher}</span> — <code className="text-xs">{f.feed}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <dl className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Videos indexed</dt>
              <dd className="text-lg font-semibold">{policy.stats.videos}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">De-indexed</dt>
              <dd className="text-lg font-semibold">{policy.stats.deindexed}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Policy log entries</dt>
              <dd className="text-lg font-semibold">{policy.stats.policyLogEntries}</dd>
            </div>
          </dl>
        </div>
      )}
    </QueryBoundary>
  );
}
