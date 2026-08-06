import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// gateway-web is a React + Vite + Tailwind + TanStack Query app. One flat
// tsconfig.json (include: src, test, vite.config.ts, vitest.config.ts,
// tailwind.config.ts, postcss.config.js), no project references —
// projectService resolves the whole tree against it in one pass.
export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'tsconfig.tsbuildinfo']),
  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}', 'vite.config.ts', 'vitest.config.ts', 'tailwind.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Vitest + Testing Library globals for the test tree.
  {
    files: ['test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
    rules: {
      // 5 findings, all the same shape: a scripted fake (jsonResponse()'s
      // fake Response, verifiedBadge.test.tsx's fetchCbor/throwing fetcher)
      // implementing an interface whose real method IS async
      // (Response.json/arrayBuffer, verifyRecordById's fetchCbor param), so
      // the fake must return a Promise to satisfy the type even though its
      // own fake body never needs to await anything. Same idiom wibbly
      // documents fleet-wide for test fixtures; require-await has no
      // narrower configurable option, so this is scoped to test files
      // rather than disabled repo-wide.
      '@typescript-eslint/require-await': 'warn',
    },
  },
  // postcss.config.js is listed in tsconfig.json's "include", but this
  // project has no allowJs — tsc (and so projectService) never actually
  // processes .js files as part of this program, so there is no type
  // information to resolve honestly here. Untyped instead.
  {
    files: ['postcss.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
])
