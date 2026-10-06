// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // contracts/ is a verbatim copy of the web repo's lib/contracts (scripts/sync-contracts.mjs).
    ignores: ['dist/*', 'contracts/*'],
  },
]);
