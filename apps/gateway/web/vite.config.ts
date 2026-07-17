import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Dev server proxies `/api` and `/media` to the gateway server
 * (apps/gateway/server, default port 8600 in dev) so the frontend can
 * be developed with plain relative fetches — no CORS, no base-URL
 * config to thread through every call site. Production deploys serve
 * this build behind the same reverse proxy / origin as the API.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8600",
        changeOrigin: true,
      },
      "/media": {
        target: "http://localhost:8600",
        changeOrigin: true,
      },
    },
  },
});
