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
