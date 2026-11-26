// expo-crypto is a native module; in Node tests use Node's own UUID generator.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID(),
}));
