// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // contracts/ is a verbatim copy of the web repo's lib/contracts (scripts/sync-contracts.mjs).
    ignores: ['dist/*', 'contracts/*'],
  },
  {
    // jest.mock() factories run before the file's imports, so they have to use require().
    files: ['__tests__/**', 'test-utils/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
