import { MoonIcon, NowPlayingBar, QueueProvider, SunIcon } from "@evermesh/ui";
import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useGateways } from "../lib/GatewayContext.js";
import { useTheme } from "../lib/useTheme.js";

/**
 * The shell every route renders inside — the node app's counterpart to
 * `apps/gateway/web/src/components/Layout.tsx`: same dark-mode toggle,
 * same `QueueProvider`/`NowPlayingBar` pairing so audio survives route
 * changes, same footer convention. Swaps the gateway's search box for a
 * gateway-origin picker, since this app can point at more than one
 * gateway (a gateway's own frontend only ever points at itself).
 */
export function Layout(): JSX.Element {
  const { theme, toggle } = useTheme();
  const { gateways, current, setCurrent } = useGateways();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <QueueProvider>
      <div className="flex min-h-screen flex-col bg-surface-base text-ink">
        <a href="#main" className="skip-link">
          Skip to content
        </a>

        <header className="sticky top-0 z-30 border-b border-line bg-surface-base/85 backdrop-blur supports-[backdrop-filter]:bg-surface-base/70">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
            <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="Home">
              <svg viewBox="0 0 256 256" aria-hidden="true" className="h-6 w-6 shrink-0 transition-transform duration-200 group-hover:scale-110">
                <path
                  className="fill-ink"
                  d="M40,187 C40,159 82,143 128,143 C174,143 216,159 216,187 C216,213 174,227 128,227 C82,227 40,213 40,187 Z"
                />
                <path
                  className="fill-ink"
                  d="M66,124 C66,101 98,86 132,86 C166,86 194,101 194,124 C194,145 166,159 132,159 C98,159 66,145 66,124 Z"
                />
                <path
                  className="fill-brand-700 dark:fill-brand-400"
                  d="M90,68 C90,49 110,37 132,37 C154,37 172,49 172,68 C172,85 154,97 132,97 C110,97 90,85 90,68 Z"
                />
              </svg>
              <span className="font-display text-lg font-extrabold tracking-tight">evermesh node</span>
            </Link>

            <div className="flex min-w-[12rem] flex-1 items-center">
              <label htmlFor="gateway-select" className="sr-only">
                Active gateway
              </label>
              {gateways.length > 0 ? (
                <select
                  id="gateway-select"
                  value={current ?? ""}
                  onChange={(e) => setCurrent(e.target.value || undefined)}
                  className="vm-field max-w-sm"
                >
                  {gateways.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              ) : (
                <button type="button" onClick={() => navigate("/settings")} className="vm-btn vm-btn-secondary text-xs">
                  Add a gateway to get started →
                </button>
              )}
            </div>

            <nav aria-label="Primary">
              <ul className="flex items-center gap-5 text-sm font-medium text-muted [&_a]:relative [&_a]:py-1 [&_a]:transition-colors [&_a:hover]:text-ink">
                <li>
                  <Link to="/">Browse</Link>
                </li>
                <li>
                  <Link to="/library">Library</Link>
                </li>
                <li>
                  <Link to="/settings">Settings</Link>
                </li>
              </ul>
            </nav>

            <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="vm-icon-btn">
              {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
            </button>
          </div>
        </header>

        <div id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none">
          <Outlet />
        </div>

        <NowPlayingBar />

        <footer className="border-t border-line bg-surface py-6 text-sm text-muted">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4">
            <p>Evermesh node — a desktop media client. Browses gateways over HTTP; verifies every record locally.</p>
            <span className="text-xs text-faint">Pinned content plays back offline, from disk.</span>
          </div>
        </footer>
      </div>
    </QueueProvider>
  );
}
