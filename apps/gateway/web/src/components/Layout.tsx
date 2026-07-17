import { cn } from "@vidmesh/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe.js";
import { useTheme } from "../hooks/useTheme.js";

/**
 * The header/nav/footer shell every page renders inside. Owns the parts
 * of the uniform UI that must not vary by gateway product decisions:
 * the skip link, the dark-mode toggle, and the "powered by vidmesh" +
 * moderation-policy footer link (spec 009 §7).
 */
export function Layout(): JSX.Element {
  const { theme, toggle } = useTheme();
  const { data: me } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");

  // Focus management on route change: move focus to the main landmark
  // so screen-reader/keyboard users land on new content, not stuck on
  // whatever link they clicked in the old page.
  useEffect(() => {
    mainRef.current?.focus();
  }, [location.pathname]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand-700 dark:text-brand-200">
            vidmesh
          </Link>

          <form role="search" onSubmit={onSearch} className="flex min-w-[12rem] flex-1 items-center">
            <label htmlFor="site-search" className="sr-only">
              Search videos
            </label>
            <input
              id="site-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this gateway…"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </form>

          <nav aria-label="Primary">
            <ul className="flex items-center gap-4 text-sm">
              <li>
                <Link to="/upload">Upload</Link>
              </li>
              <li>
                <Link to="/policy">Policy</Link>
              </li>
              <li>
                <Link to={me ? "/me" : "/auth"}>{me ? me.handle : "Sign in"}</Link>
              </li>
            </ul>
          </nav>

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
              "rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-600",
            )}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      <div id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none">
        <Outlet />
      </div>

      <footer className="border-t border-slate-200 py-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4">
          <p>
            Powered by{" "}
            <a href="https://vidmesh.org" className="text-brand-700 underline dark:text-brand-200">
              vidmesh
            </a>
            — many gateways, one substrate.
          </p>
          <Link to="/policy" className="underline">
            What this gateway serves
          </Link>
        </div>
      </footer>
    </div>
  );
}
