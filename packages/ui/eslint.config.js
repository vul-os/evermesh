import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// @evermesh/ui is a shared React component library (no build step of its
// own — consumers import straight from src/, see "main"/"types" in
// package.json), no test dir. One flat tsconfig.json (include: ["src"]),
// no project references.
export default defineConfig([
  globalIgnores(['node_modules']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Player.tsx's one finding: `track.mode = isActive ? "showing" :
      // "hidden"` on a native TextTrack read off videoRef.current.textTracks.
      // Assigning .mode is the only browser API for toggling caption
      // visibility — there's no immutable alternative, same category of
      // necessary imperative DOM write as `video.volume =`/
      // `video.currentTime =` a few lines above it in the same file, which
      // this rule doesn't flag (its heuristic treats a value reached via
      // property-access-then-indexing off a ref differently from a direct
      // `.current.prop =`). One of the newer React Compiler-derived checks;
      // downgraded per the same triage diwan documents fleet-wide for this
      // rule category.
      'react-hooks/immutability': 'warn',
    },
  },
])
