import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api.js";

export function Auth(): JSX.Element {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => (mode === "login" ? login(handle, password) : register(handle, password)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/me");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || !password) return;
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-5 text-xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1>

      <div role="tablist" aria-label="Sign in or create an account" className="mb-5 inline-flex gap-0.5 rounded-control border border-line bg-surface-2 p-0.5">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={`rounded-[6px] px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === "login" ? "bg-surface-base text-ink shadow-card" : "text-muted hover:text-ink"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => setMode("register")}
          className={`rounded-[6px] px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === "register" ? "bg-surface-base text-ink shadow-card" : "text-muted hover:text-ink"}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="vm-card space-y-4 p-5">
        <label className="vm-label">
          Handle
          <input required autoComplete="username" value={handle} onChange={(e) => setHandle(e.target.value)} className="vm-field" />
        </label>
        <label className="vm-label">
          Password
          <input
            required
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="vm-field"
          />
        </label>

        {mode === "register" && (
          <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-muted">
            This gateway will hold your signing key on your behalf (custody). You can export your identity at any
            time from your profile page — see the identity-export flow.
          </p>
        )}

        <button type="submit" disabled={mutation.isPending} className="vm-btn vm-btn-primary w-full">
          {mutation.isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        {mutation.isError && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {mutation.error instanceof Error ? mutation.error.message : "Something went wrong."}
          </p>
        )}
      </form>
    </div>
  );
}
