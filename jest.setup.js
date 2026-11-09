// In-memory AsyncStorage mock (v3 ships no jest mock).
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  const api = {
    getItem: jest.fn(async k => (store.has(k) ? store.get(k) : null)),
    setItem: jest.fn(async (k, v) => { store.set(k, String(v)); }),
    removeItem: jest.fn(async k => { store.delete(k); }),
    clear: jest.fn(async () => { store.clear(); }),
  };
  return { __esModule: true, default: api, ...api };
});
