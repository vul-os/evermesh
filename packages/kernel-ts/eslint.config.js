import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// @evermesh/kernel is plain Node/TypeScript wrapping the WASM kernel
// (../wasm/, gitignored — built via `pnpm build:wasm`, required to be
// present for type-aware linting of src/index.ts to resolve its import).
// One flat tsconfig.json (include: ["src"]), no project references.
// scripts/emit-cjs.mjs is a tiny build script outside tsconfig's include,
// so it gets untyped linting like athar/gateway-server's tooling scripts.
export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'wasm']),
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // kernel.test.ts's skip-mode wrapper `(name, _fn) => test(...skip)`
      // deliberately ignores the real test body when wasm isn't built —
      // leading underscore for "intentionally unused" (same option
      // diwan/wibbly use fleet-wide).
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // node:test's test(name, fn) is a fire-and-forget registration API by
  // design — node --test tracks and awaits every top-level test() call
  // itself. All 7 no-floating-promises findings measured here are exactly
  // this shape (kernel.test.ts's own top-level t(...) calls), same as
  // gateway-server's test/**.
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
])
