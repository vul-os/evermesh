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
