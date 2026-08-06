import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// node-web is a React + Vite + Tailwind app (Tauri 2 webview). One flat
// tsconfig.json (include: src, vite.config.ts, tailwind.config.ts,
// postcss.config.js), no project references — projectService resolves
// the tree against it in one pass. No test/ dir exists yet (package.json
// has no "test" script), so there's no separate test-file block here.
export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'tsconfig.tsbuildinfo']),
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts', 'tailwind.config.ts'],
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
  // postcss.config.js is listed in tsconfig.json's "include", but this
  // project has no allowJs — tsc (and so projectService) never actually
  // processes .js files as part of this program (same gap as gateway-web).
  // Untyped instead.
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
