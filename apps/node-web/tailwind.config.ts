import type { Config } from "tailwindcss";

/**
 * Same token layer as `apps/gateway/web/tailwind.config.ts` (see that
 * file's comment for the full rationale) — the node app is a different
 * *shell* (Tauri desktop client vs. browser SPA) around the same uniform
 * component layer (`@evermesh/ui`), so it reuses the identical palette
 * rather than inventing a second one. Kept as a separate file (not
 * imported from gateway/web) because the two apps are independent pnpm
 * packages with independent `content` globs.
 */
const ramp = (name: string) => ({
  50: `var(--bo-${name}-50)`,
  100: `var(--bo-${name}-100)`,
  200: `var(--bo-${name}-200)`,
  300: `var(--bo-${name}-300)`,
  400: `var(--bo-${name}-400)`,
  500: `var(--bo-${name}-500)`,
  600: `var(--bo-${name}-600)`,
  700: `var(--bo-${name}-700)`,
  800: `var(--bo-${name}-800)`,
  900: `var(--bo-${name}-900)`,
  950: `var(--bo-${name}-950)`,
});

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // @evermesh/ui ships .tsx sources with no build step; Tailwind's JIT
    // scanner must see them directly or their classes get purged.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { ...ramp("brand"), DEFAULT: "var(--bo-brand-600)" },
        accent: { ...ramp("accent"), DEFAULT: "var(--bo-accent-600)" },
        slate: ramp("neutral"),
        red: ramp("live"),
        surface: {
          DEFAULT: "var(--bo-surface)",
          2: "var(--bo-surface-2)",
          base: "var(--bo-bg)",
        },
        line: "var(--bo-border)",
        "line-strong": "var(--bo-border-strong)",
        ink: "var(--bo-fg)",
        muted: "var(--bo-muted)",
        faint: "var(--bo-faint)",
        signal: "var(--bo-signal)",
        verified: "var(--bo-verified)",
        live: "var(--bo-live)",
      },
      fontFamily: {
        display: "var(--bo-font-display)",
        sans: "var(--bo-font-sans)",
        mono: "var(--bo-font-mono)",
      },
      borderRadius: {
        card: "var(--bo-radius)",
        control: "var(--bo-radius-sm)",
      },
      boxShadow: {
        card: "var(--bo-shadow)",
        elevated: "var(--bo-shadow-lg)",
      },
      transitionTimingFunction: {
        vm: "var(--bo-ease)",
      },
    },
  },
  plugins: [],
} satisfies Config;
