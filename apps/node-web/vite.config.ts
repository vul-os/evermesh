import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The node app's frontend build. Two things differ from
 * `apps/gateway/web/vite.config.ts`, both because this is a Tauri
 * webview rather than a plain browser SPA:
 *
 * - `build.outDir` writes straight into `crates/evermesh-node/ui`, the
 *   directory `tauri.conf.json`'s `frontendDist` already points at
 *   (unchanged from the Phase 8 scaffold) — `apps/node-web` is the
 *   *source*, `crates/evermesh-node/ui` is the *built output*, mirroring
 *   how `apps/gateway/web` and `apps/gateway/server` split source from
 *   what gets deployed.
 * - No `/api`/`/media` dev proxy: this app never fetches a gateway
 *   directly from the webview (see `src/lib/tauri.ts`) — every gateway
 *   call goes through `invoke()` to the Rust side
 *   (`crates/evermesh-node/src/gateway_client.rs`), which has no CORS
 *   concept to work around in the first place.
 */
export default defineConfig({
  plugins: [react()],
  // Tauri serves the built app from a custom `tauri://` (desktop) origin,
  // not `/`; relative asset URLs are required for `index.html`'s script
  // and CSS links to resolve there.
  base: "./",
  build: {
    outDir: "../../crates/evermesh-node/ui",
    emptyOutDir: true,
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  // Recommended by the Tauri docs: don't let Vite's own file-watcher spin
  // on the Rust build output this config just told it to write into.
  clearScreen: false,
});
