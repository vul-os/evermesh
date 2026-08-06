import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// gateway-server is plain Node/TypeScript (Fastify backend), no JSX, one
// flat tsconfig.json (include: ["src", "test"]) with no project references —
// projectService resolves both trees against it directly.
export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'data']),
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
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
      // csam.ts's StubMatcher.checkBlob(blob, _meta) already used the
      // leading-underscore convention for "intentionally unused, kept for
      // interface-signature symmetry" before this config existed — matching
      // that convention rather than fighting it (same option diwan/wibbly
      // use fleet-wide).
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
])
