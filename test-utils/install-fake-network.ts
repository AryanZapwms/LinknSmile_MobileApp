// Jest setup file (see jest.config.js). Runs before each test file's imports.
//
// Every axios instance copies `axios.defaults` when it is created, so setting
// the adapter here means all requests made by app code in tests go to the
// fake backend from ./fake-network. A test that forgets to install a handler
// fails loudly instead of reaching a real server.
import axios from 'axios';

axios.defaults.adapter = (config) => {
  const fake = (globalThis as { __fakeNetwork?: (config: unknown) => Promise<never> }).__fakeNetwork;
  if (!fake) {
    throw new Error(`Unexpected network request in a test: ${config.method?.toUpperCase()} ${config.url}`);
  }
  return fake(config);
};
