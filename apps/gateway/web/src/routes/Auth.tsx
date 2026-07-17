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
    <div className="max-w-sm">
      <div role="tablist" aria-label="Sign in or create an account" className="mb-4 flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "login" ? "bg-brand-600 text-white" : "border border-slate-300 dark:border-slate-700"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => setMode("register")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "register" ? "bg-brand-600 text-white" : "border border-slate-300 dark:border-slate-700"}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium">
          Handle
          <input
            required
            autoComplete="username"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            required
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {mode === "register" && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This gateway will hold your signing key on your behalf (custody). You can export your identity at any
            time from your profile page — see the identity-export flow.
          </p>
        )}

        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
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
