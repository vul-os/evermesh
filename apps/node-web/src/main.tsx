/**
 * Evermesh node app frontend entry point. React 18 + Vite + Tailwind +
 * react-router-dom (data router) — the same stack as
 * `apps/gateway/web/src/main.tsx`, minus `@tanstack/react-query` (see
 * `src/lib/useAsync.ts`) and `@evermesh/kernel` (no WASM here — see
 * `src/lib/tauri.ts`'s module doc for why).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App.js";
import "./styles/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element missing from index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
