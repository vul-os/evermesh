import { useState, type FormEvent } from "react";
import { useGateways } from "../lib/GatewayContext.js";
import { getBudgets, getNodeStatus, setBudget, validateGatewayUrl } from "../lib/tauri.js";
import type { Budget, NodeStatus } from "../lib/types.js";
import { useAsync } from "../lib/useAsync.js";

/**
 * Replaces the Phase 8 scaffold's three static panels
 * (`crates/evermesh-node/ui/index.html`'s "Pinned content" /
 * "Subscriptions" / "Budgets") with the two things that are actually
 * configurable now: which gateways this node browses, and its own
 * disk/bandwidth budget (spec 000 §4 — a node "honors its own budgets").
 * "Subscriptions" (auto-pin-by-follow) isn't built yet — see the crate
 * README's deferred list — so it isn't presented here as if it were.
 */
export function Settings(): JSX.Element {
  const { gateways, current, add, remove, setCurrent } = useGateways();
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState<string>();
  const [adding, setAdding] = useState(false);

  const status = useAsync<NodeStatus>(getNodeStatus, []);
  const budgetState = useAsync<Budget>(getBudgets, []);
  const [diskGb, setDiskGb] = useState<string>("");
  const [bandwidthMbps, setBandwidthMbps] = useState<string>("");
  const [savedBudget, setSavedBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string>();

  const diskValue = diskGb !== "" ? diskGb : (budgetState.data?.diskGb?.toString() ?? "");
  const bandwidthValue = bandwidthMbps !== "" ? bandwidthMbps : (budgetState.data?.bandwidthMbps?.toString() ?? "");

  const onAddGateway = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setAdding(true);
    setAddError(undefined);
    try {
      await validateGatewayUrl(newUrl.trim());
      add(newUrl.trim());
      setNewUrl("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const onSaveBudget = async (e: FormEvent) => {
    e.preventDefault();
    setBudgetError(undefined);
    setSavedBudget(false);
    const disk = Number(diskValue);
    const bandwidth = Number(bandwidthValue);
    if (!Number.isFinite(disk) || disk < 0 || !Number.isFinite(bandwidth) || bandwidth < 0) {
      setBudgetError("Both fields must be non-negative numbers.");
      return;
    }
    try {
      await setBudget({ diskGb: disk, bandwidthMbps: bandwidth });
      budgetState.reload();
      setSavedBudget(true);
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">Settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">This node</h1>
        {status.data && (
          <>
            <p className="mt-1 text-sm text-muted">
              evermesh-node v{status.data.version} · {status.data.pinnedCount} item{status.data.pinnedCount === 1 ? "" : "s"} pinned
            </p>
            <p className="mt-1 break-all font-mono text-xs text-faint">{status.data.dbPath}</p>
          </>
        )}
      </div>

      <section className="vm-card p-5">
        <h2 className="text-lg font-semibold text-ink">Gateways</h2>
        <p className="mt-1 text-sm text-muted">
          Every read this app makes goes to one of these, over plain HTTP(S) — there is no default gateway baked in.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {gateways.length === 0 && <li className="text-sm text-faint">No gateways added yet.</li>}
          {gateways.map((g) => (
            <li key={g} className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setCurrent(g)}
                aria-pressed={current === g}
                className={"min-w-0 flex-1 truncate text-left font-mono text-sm " + (current === g ? "font-semibold text-signal" : "text-ink")}
              >
                {current === g ? "● " : ""}
                {g}
              </button>
              <button type="button" onClick={() => remove(g)} className="vm-btn vm-btn-ghost text-xs">
                Remove
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={(e) => void onAddGateway(e)} className="mt-4 flex gap-2">
          <label htmlFor="gateway-url" className="sr-only">
            Gateway URL
          </label>
          <input
            id="gateway-url"
            type="url"
            required
            placeholder="https://gateway.example"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="vm-field flex-1"
          />
          <button type="submit" disabled={adding} className="vm-btn vm-btn-primary shrink-0">
            {adding ? "Checking…" : "Add"}
          </button>
        </form>
        {addError && (
          <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
            {addError}
          </p>
        )}
      </section>

      <section className="vm-card p-5">
        <h2 className="text-lg font-semibold text-ink">Budgets</h2>
        <p className="mt-1 text-sm text-muted">
          The disk space and upload bandwidth this node will use for pinned/seeded content (spec 000 §4). Not yet
          enforced against pin/eviction — this records your intent; automatic eviction when over budget is future
          work.
        </p>

        <form onSubmit={(e) => void onSaveBudget(e)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="vm-label">
            Disk (GB)
            <input
              type="number"
              min={0}
              className="vm-field"
              value={diskValue}
              onChange={(e) => {
                setDiskGb(e.target.value);
                setSavedBudget(false);
              }}
            />
          </label>
          <label className="vm-label">
            Bandwidth (Mbps)
            <input
              type="number"
              min={0}
              className="vm-field"
              value={bandwidthValue}
              onChange={(e) => {
                setBandwidthMbps(e.target.value);
                setSavedBudget(false);
              }}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="vm-btn vm-btn-primary">
              Save budget
            </button>
            {savedBudget && <span className="ml-3 text-sm text-verified">Saved.</span>}
          </div>
        </form>
        {budgetError && (
          <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
            {budgetError}
          </p>
        )}
      </section>
    </div>
  );
}
