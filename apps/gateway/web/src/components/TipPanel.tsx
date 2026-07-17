import { RecordCard } from "@vidmesh/ui";
import { useState } from "react";
import type { ReceiptView } from "../lib/api-types.js";

export interface TipPanelProps {
  /** `[railId, paymentPointer][]` from Video.payment (API.md). */
  payment: [number, string][];
  receipts: ReceiptView[];
}

const RAIL_NAMES: Record<number, string> = {
  0: "Lightning",
  1: "On-chain",
  2: "Payment pointer (Interledger/Web Monetization)",
};

function railName(rail: number): string {
  return RAIL_NAMES[rail] ?? `Rail ${rail}`;
}

/**
 * Tip button that opens a display-only modal of this creator's payment
 * pointers plus the public receipt records for this video. There is no
 * payment integration here by design — Vidmesh is economically neutral
 * (build plan §1 principle 5); this only surfaces what creators publish
 * and what receipts already exist as records.
 */
export function TipPanel({ payment, receipts }: TipPanelProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={payment.length === 0}
        className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Tip the creator
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Payment pointers" className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Payment pointers</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-lg">
                ×
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              This gateway does not process payments. Copy a pointer below and send a tip through whatever wallet or client you already use.
            </p>
            <ul className="space-y-2">
              {payment.map(([rail, pointer]) => (
                <li key={`${rail}-${pointer}`} className="rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700">
                  <div className="font-medium">{railName(rail)}</div>
                  <code className="block truncate text-xs">{pointer}</code>
                </li>
              ))}
            </ul>

            <h3 className="mb-2 mt-4 text-sm font-semibold">Receipts on this gateway</h3>
            {receipts.length === 0 ? (
              <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
                No receipts recorded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {receipts.map((r) => (
                  <li key={r.id}>
                    <RecordCard
                      author={{ name: `${r.author.slice(0, 10)}…` }}
                      createdAtMs={r.createdAt * 1000}
                      kindLabel="Receipt"
                      body={`${r.amount} ${r.currency}${r.message ? ` — “${r.message}”` : ""}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
