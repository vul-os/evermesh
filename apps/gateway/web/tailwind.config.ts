import type { Config } from "tailwindcss";

/**
 * Brand palette (see assets/README.md): deep indigo `#3C3489` as
 * `brand`, signal teal `#1D9E75` as `accent`, both wired through CSS
 * custom properties (src/styles/index.css) rather than hard-coded hex
 * so a gateway operator can re-skin accents by overriding the
 * properties alone — no rebuild of this file. `darkMode: "class"`
 * because the theme toggle (src/hooks/useTheme.ts) sets `dark` on
 * `<html>` explicitly (persisted + `prefers-color-scheme` default)
 * rather than relying purely on the media query.
 */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // @vidmesh/ui ships .tsx sources with no build step; Tailwind's JIT
    // scanner must see them directly or their classes get purged.
    "../../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--vm-brand-50)",
          100: "var(--vm-brand-100)",
          200: "var(--vm-brand-200)",
          300: "var(--vm-brand-300)",
          400: "var(--vm-brand-400)",
          500: "var(--vm-brand-500)",
          600: "var(--vm-brand-600)",
          700: "var(--vm-brand-700)",
          800: "var(--vm-brand-800)",
          900: "var(--vm-brand-900)",
          950: "var(--vm-brand-950)",
          DEFAULT: "var(--vm-brand-600)",
        },
        accent: {
          50: "var(--vm-accent-50)",
          100: "var(--vm-accent-100)",
          200: "var(--vm-accent-200)",
          300: "var(--vm-accent-300)",
          400: "var(--vm-accent-400)",
          500: "var(--vm-accent-500)",
          600: "var(--vm-accent-600)",
          700: "var(--vm-accent-700)",
          800: "var(--vm-accent-800)",
          900: "var(--vm-accent-900)",
          950: "var(--vm-accent-950)",
          DEFAULT: "var(--vm-accent-600)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
