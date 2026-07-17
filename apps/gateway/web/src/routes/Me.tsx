import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { exportIdentity, logout, updateProfile } from "../api.js";
import { QueryBoundary } from "../components/QueryState.js";
import { useMe } from "../hooks/useMe.js";

/**
 * Profile edit + the identity-export flow. Spec 009 §5: a custodial
 * gateway MUST demonstrate the exit path — export genesis + chain +
 * held keys on demand, password re-confirmed. This is non-negotiable
 * and MUST NOT be removed from the uniform UI (spec 009 §7).
 */
export function Me(): JSX.Element {
  const query = useMe();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return (
    <QueryBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={query.data ?? undefined}
      loadingLabel="Loading your profile…"
      emptyLabel="Sign in to view your profile."
    >
      {(me) => (
        <div className="max-w-xl space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{me.handle}</h1>
            <button type="button" onClick={() => logoutMutation.mutate()} className="text-sm underline">
              Sign out
            </button>
          </div>

          <ProfileForm name={me.profile?.name ?? ""} about={me.profile?.about ?? ""} />
          <ExportSection />
        </div>
      )}
    </QueryBoundary>
  );
}

function ProfileForm({ name: initialName, about: initialAbout }: { name: string; about: string }): JSX.Element {
  const [name, setName] = useState(initialName);
  const [about, setAbout] = useState(initialAbout);
  // GAP: API.md's profile update takes `avatarBlobId` but documents no
  // endpoint for uploading an avatar image to get one. Left as a plain
  // optional text input (paste an existing blob id) until the contract
  // adds an avatar upload endpoint.
  const [avatarBlobId, setAvatarBlobId] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => updateProfile({ name, about: about || undefined, avatarBlobId: avatarBlobId || undefined }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 className="text-lg font-semibold">Edit profile</h2>
      <label className="block text-sm font-medium">
        Display name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="block text-sm font-medium">
        About
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="block text-sm font-medium">
        Avatar blob id (optional)
        <input
          value={avatarBlobId}
          onChange={(e) => setAvatarBlobId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <button type="submit" disabled={mutation.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {mutation.isPending ? "Saving…" : "Save profile"}
      </button>
      {mutation.isSuccess && <p role="status" className="text-sm text-accent-700 dark:text-accent-300">Saved.</p>}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {mutation.error instanceof Error ? mutation.error.message : "Could not save profile."}
        </p>
      )}
    </form>
  );
}

function ExportSection(): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => exportIdentity(password),
    onSuccess: (result) => {
      downloadJson(result, "vidmesh-identity-export.json");
      setConfirming(false);
      setPassword("");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    mutation.mutate();
  };

  return (
    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="export-heading">
      <h2 id="export-heading" className="text-lg font-semibold">
        Export your identity
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Download your genesis record, rotation chain, and the signing keys this gateway holds for you. Leaving this
        gateway never requires anything from us — this export plus a key rotation is the whole exit path (spec 009
        §5).
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-200"
        >
          Export my identity
        </button>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 space-y-2">
          <label className="block text-sm font-medium">
            Confirm your password to continue
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={mutation.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {mutation.isPending ? "Preparing export…" : "Confirm and download"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
              Cancel
            </button>
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {mutation.error instanceof Error ? mutation.error.message : "Could not export your identity."}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
