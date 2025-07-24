import { vi } from 'vitest';

/**
 * Test utilities and mock factories for blink-nostr tests
 */

/**
 * Mock factory for creating Redis instances
 */
export const createMockRedis = () => ({
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn(),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(3600),
});

/**
 * Mock factory for creating BigQuery clients
 */
export const createMockBigQueryClient = () => ({
  query: vi.fn().mockResolvedValue([[]]),
  dataset: vi.fn().mockReturnThis(),
  table: vi.fn().mockReturnThis(),
  createLoadJob: vi.fn().mockResolvedValue([{ id: 'job-123' }]),
});

/**
 * Mock factory for creating LND instances
 */
export const createMockLnd = () => ({
  getWalletInfo: vi.fn().mockResolvedValue({
    public_key: 'mock-pubkey-123',
    alias: 'mock-node',
    chains: ['bitcoin'],
    version: '0.15.0',
  }),
  subscribeToInvoices: vi.fn().mockReturnValue({
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  }),
});

/**
 * Mock factory for creating Nostr relay instances
 */
export const createMockNostrRelay = (url = 'wss://relay.example.com') => ({
  url,
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockReturnValue({
    on: vi.fn(),
  }),
  close: vi.fn(),
});

/**
 * Mock factory for creating invoice objects
 */
export const createMockInvoice = (overrides = {}) => ({
  id: 'invoice-123',
  is_confirmed: true,
  confirmed_at: '2023-01-01T12:00:00.000Z',
  request: 'lnbc1000n1pj9x8z8pp5...',
  secret: 'payment-secret-123',
  amount: 1000,
  description: 'Test payment',
  ...overrides,
});

/**
 * Mock factory for creating zap request objects
 */
export const createMockZapRequest = (overrides = {}) => ({
  kind: 9734,
  content: 'Great post! ⚡',
  tags: [
    ['p', 'recipient-pubkey-123'],
    ['e', 'note-id-456'],
    ['relays', 'wss://relay1.com', 'wss://relay2.com'],
  ],
  created_at: Math.floor(Date.now() / 1000),
  pubkey: 'sender-pubkey-789',
  ...overrides,
});

/**
 * Mock factory for creating BigQuery invoice rows
 */
export const createMockBigQueryInvoice = (overrides = {}) => ({
  _id: 'payment-hash-123',
  timestamp: new Date('2023-01-01T12:00:00.000Z'),
  walletId: 'wallet-456',
  paymentRequest: 'lnbc1000n1pj9x8z8pp5...',
  paid: true,
  processingCompleted: true,
  secret: 'payment-secret-123',
  selfGenerated: false,
  ...overrides,
});

/**
 * Helper to create environment variable mocks
 */
export const createEnvMock = (envVars = {}) => {
  const originalEnv = {};
  
  // Store original values
  Object.keys(envVars).forEach(key => {
    originalEnv[key] = process.env[key];
    process.env[key] = envVars[key];
  });
  
  // Return cleanup function
  return () => {
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  };
};

/**
 * Helper to mock console methods
 */
export const createConsoleMock = () => {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };
  
  const mocks = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
  
  // Replace console methods
  Object.keys(mocks).forEach(method => {
    console[method] = mocks[method];
  });
  
  // Return mocks and cleanup function
  return {
    mocks,
    restore: () => {
      Object.keys(originalConsole).forEach(method => {
        console[method] = originalConsole[method];
      });
    },
  };
};

/**
 * Helper to create mock timers
 */
export const createTimerMock = () => {
  vi.useFakeTimers();
  
  return {
    advanceTime: (ms) => vi.advanceTimersByTime(ms),
    runPendingTimers: () => vi.runOnlyPendingTimersAsync(),
    restore: () => vi.useRealTimers(),
  };
};

/**
 * Helper to wait for async operations in tests
 */
export const waitFor = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to create a mock event emitter
 */
export const createMockEventEmitter = () => {
  const listeners = new Map();
  
  return {
    on: vi.fn((event, callback) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(callback);
    }),
    emit: vi.fn((event, ...args) => {
      const eventListeners = listeners.get(event) || [];
      eventListeners.forEach(callback => callback(...args));
    }),
    removeAllListeners: vi.fn((event) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    }),
    listeners,
  };
};

/**
 * Helper to create mock BigQuery query options
 */
export const createMockQueryOptions = (overrides = {}) => ({
  query: 'SELECT * FROM test_table WHERE id = @id',
  params: { id: 'test-id' },
  ...overrides,
});

/**
 * Helper to create mock wallet info
 */
export const createMockWalletInfo = (overrides = {}) => ({
  public_key: '03a1b2c3d4e5f6...',
  alias: 'test-lightning-node',
  chains: ['bitcoin'],
  version: '0.15.0-beta',
  num_pending_channels: 0,
  num_active_channels: 5,
  num_peers: 10,
  block_height: 800000,
  synced_to_chain: true,
  synced_to_graph: true,
  ...overrides,
});

/**
 * Helper to create mock Nostr events
 */
export const createMockNostrEvent = (overrides = {}) => ({
  id: 'event-id-123',
  pubkey: 'pubkey-456',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Hello Nostr!',
  sig: 'signature-789',
  ...overrides,
});

/**
 * Test data constants
 */
export const TEST_CONSTANTS = {
  MOCK_PRIVATE_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  MOCK_PUBLIC_KEY: '03a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789ab',
  MOCK_PAYMENT_HASH: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab',
  MOCK_PAYMENT_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
  MOCK_INVOICE_REQUEST: 'lnbc1000n1pj9x8z8pp5abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  MOCK_RELAY_URL: 'wss://relay.example.com',
  MOCK_TIMESTAMP: '2023-01-01T12:00:00.000Z',
};
