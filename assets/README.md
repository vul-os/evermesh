# assets

Brand assets for Vidmesh: a hand-written SVG mark and wordmark, an
architecture diagram, and a social share card. **Status: built** (see §13/§14
of the build plan).

## Inventory

| File | Purpose |
|---|---|
| `logo.svg` | Full lockup (mark + "vidmesh" wordmark) for light backgrounds. `viewBox="0 0 960 256"`. |
| `logo-dark.svg` | Same geometry, recolored for dark backgrounds. |
| `favicon.svg` | The mark only (no wordmark), simplified and bolded to stay legible at 16px. `viewBox="0 0 256 256"`. |
| `architecture.svg` | Creators → substrate (records + blobs) → gateways → viewers/nodes, in the same visual style. Ships its own neutral card background so it reads on any page. |
| `og-image.svg` / `og-image.png` | 1200×630 social share card: the dark-variant lockup on the brand indigo background, plus the tagline. The PNG is a headless-Chrome export of the SVG for platforms that don't render SVG previews. |

## The mark

A hexagon of six nodes and edges (the mesh) with three inner spokes
converging on a filled triangle at the center (the play button) — "a mesh
of independent participants meeting at video." Everything is drawn by hand
as `<path>`/`<circle>` elements: no raster effects, no gradients, no filters.

The "vidmesh" wordmark is built the same way: every letter is a hand-plotted
path (straight segments, round joins/caps) on a shared x-height/ascender
grid. There is no `<text>` or `font-family` anywhere in `logo.svg` or
`logo-dark.svg` — the wordmark renders identically on every system, with no
font to load or fall back on.

## Palette

Flat colors only, two per variant, no gradients:

| Token | Light variant (`logo.svg`, `favicon.svg`) | Dark variant (`logo-dark.svg`, `og-image.svg`) |
|---|---|---|
| Structure (mesh, wordmark) | `#3C3489` deep indigo | `#C9C2F5` light lavender |
| Accent (play triangle) | `#1D9E75` signal teal | `#2FE3A6` bright teal |

Contrast was checked against the backgrounds each variant is meant for
(WCAG relative luminance): deep indigo on white is ~10:1; light lavender and
bright teal on the dark palette's backgrounds (`#14101F` site dark background,
`#3C3489` OG card background) both land above 6:1. Signal teal `#1D9E75` on
*white* is only ~3.4:1 — enough for large text, icons, and borders (WCAG
1.4.11 non-text contrast), but not for small body text, so the site CSS
never sets small text in teal on a light background; it reserves teal for
accents and reserves indigo for text and links.

## Usage rules

- Never recolor the mark to anything outside the two palettes above; never
  add a gradient, drop shadow, or blur.
- Keep the mesh-and-triangle geometry intact when resizing — it's designed
  to read at both 16px (`favicon.svg`) and 512px.
- Pick the light or dark variant based on the background it sits on, via
  `<picture>` + `prefers-color-scheme` (see `apps/site/index.html` for the
  pattern) — don't force one variant onto the wrong background.
- `apps/site/assets/` holds copies of these files so the site directory is
  deployable on its own; if you edit a file here, copy it there too (or vice
  versa) to keep them in sync.
