import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { Auth } from "./routes/Auth.js";
import { Channel } from "./routes/Channel.js";
import { Home } from "./routes/Home.js";
import { Me } from "./routes/Me.js";
import { NotFound } from "./routes/NotFound.js";
import { Policy } from "./routes/Policy.js";
import { Upload } from "./routes/Upload.js";
import { Watch } from "./routes/Watch.js";

/**
 * The uniform reference UI's page list (spec 009 §7): every gateway
 * ships exactly these routes. A gateway MAY add more; it MUST NOT
 * remove `/policy`, `/watch/:id` (verification badge lives there), or
 * `/me` (identity export lives there).
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "watch/:id", element: <Watch /> },
      { path: "channel/:identityId", element: <Channel /> },
      { path: "upload", element: <Upload /> },
      { path: "policy", element: <Policy /> },
      { path: "auth", element: <Auth /> },
      { path: "me", element: <Me /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
