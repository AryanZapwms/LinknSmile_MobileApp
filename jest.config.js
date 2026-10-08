// jest.config.js
// `npm test`. Tests live in __tests__/ and run the real services/ code against
// a fake backend (test-utils/fake-network.ts): no network, no device.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  // Runs before any app module is loaded: routes every axios request to the fake.
  setupFiles: ['<rootDir>/test-utils/install-fake-network.ts'],
  // jest-expo's setup requires expo-modules-core from the project root, but npm
  // installs it inside expo/. This is only a fallback: packages found the
  // normal way are not affected.
  modulePaths: ['<rootDir>/node_modules/expo/node_modules'],
};
