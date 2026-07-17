# apps/site

The vidmesh.org landing page: static, hand-crafted HTML + CSS, no framework,
no JavaScript required for content. Deployable to any static host as-is.

**Status: built** — hero, three-role explainer, principles summary, spec
index, FAQ, and full head metadata are in place. `assets/` is a self-contained
copy of the brand assets so this directory can be deployed on its own.

## Preview locally

No build step. From this directory:

```sh
python3 -m http.server 8080
# then open http://localhost:8080/
```

Any other static file server works equally well (`npx serve`, `caddy file-server`, etc).

## Deploy

This directory is self-contained — `index.html`, `style.css`, `robots.txt`,
`sitemap.xml`, `site.webmanifest`, and `assets/` are everything the site
needs. Copy `apps/site/*` to any static host (GitHub Pages, Netlify,
Cloudflare Pages, S3 + CDN, a single nginx `root`) with no build command.

Before going live on the real domain, double-check:

- `<link rel="canonical">` and the `og:url` / `og:image` values in
  `index.html` already point at `https://vidmesh.org/` — update them if the
  site is deployed elsewhere first.
- `robots.txt` and `sitemap.xml` both assume the `https://vidmesh.org/` origin.

## Design

- Colors are CSS custom properties on `:root`, overridden under
  `@media (prefers-color-scheme: dark)` — no JavaScript theme toggle, no
  flash of unstyled content.
- Fonts: system font stack only (`-apple-system, "Segoe UI", Roboto, ...`).
  The wordmark in the logo is drawn as SVG path outlines, not text.
- Logo swaps for its dark-background variant via `<picture>` +
  `prefers-color-scheme`, natively, without a script.
- Layout is a handful of stacked `<section>`s with a max content width; no
  grid framework, no build step.

## Lighthouse notes

Written to score well without special-casing the audit: no render-blocking
scripts, no web fonts, no layout-shift-prone images (explicit `width`/
`height` on the hero logo), one small stylesheet, semantic landmarks
(`header`/`nav`/`main`/`section`/`footer`), a full head (title, description,
canonical, Open Graph, Twitter card, theme-color for light and dark,
favicon, manifest, apple-touch-icon), and every image has descriptive `alt`
text. If a real Lighthouse run turns up something below 95, it is most
likely a hosting-level issue (missing cache headers, no compression) rather
than the markup — check the static host's response headers first.
