// In-memory stand-in for expo-secure-store. Use it from a test file with:
//   jest.mock('expo-secure-store', () => require('../test-utils/mock-secure-store'));

/** Everything "written to the device", for assertions. */
export const secureStoreData = new Map<string, string>();

export const getItemAsync = async (key: string) => secureStoreData.get(key) ?? null;
export const setItemAsync = async (key: string, value: string) => {
  secureStoreData.set(key, value);
};
export const deleteItemAsync = async (key: string) => {
  secureStoreData.delete(key);
};
