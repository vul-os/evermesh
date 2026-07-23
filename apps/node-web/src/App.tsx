import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { GatewayProvider } from "./lib/GatewayContext.js";
import { Browse } from "./routes/Browse.js";
import { Library } from "./routes/Library.js";
import { Listen } from "./routes/Listen.js";
import { NotFound } from "./routes/NotFound.js";
import { Settings } from "./routes/Settings.js";
import { Watch } from "./routes/Watch.js";

/**
 * The node app's page list — the desktop-client counterpart of
 * `apps/gateway/web/src/App.tsx`'s router. `GatewayProvider` wraps
 * `Layout` (not the other way around) because `Layout` itself reads the
 * active-gateway selection for its header picker.
 */
export const router = createBrowserRouter([
  {
    element: (
      <GatewayProvider>
        <Layout />
      </GatewayProvider>
    ),
    children: [
      { index: true, element: <Browse /> },
      { path: "library", element: <Library /> },
      { path: "watch/:id", element: <Watch /> },
      { path: "listen/:id", element: <Listen /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
