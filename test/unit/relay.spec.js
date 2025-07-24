import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signId, calculateId, getPublicKey } from 'nostr';
import pkg from 'nostr-tools';

// Mock the dependencies
vi.mock('nostr');
vi.mock('nostr-tools');
vi.mock('../../src/redis.js', () => ({
  redis: {
    get: vi.fn(),
  },
}));

describe('Relay Service', () => {
  let relayModule;
  let mockRedis;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset modules
    vi.resetModules();
    
    // Setup mock implementations
    getPublicKey.mockReturnValue('mock-pubkey');
    calculateId.mockResolvedValue('mock-event-id');
    signId.mockResolvedValue('mock-signature');
    
    // Mock nostr-tools
    const mockRelay = {
      url: 'wss://relay.example.com',
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockReturnValue({
        on: vi.fn(),
      }),
    };
    
    pkg.relayInit = vi.fn().mockReturnValue(mockRelay);
    
    // Import the module after mocking
    relayModule = await import('../../src/relay.js');
    
    // Get the mocked redis
    const redisModule = await import('../../src/redis.js');
    mockRedis = redisModule.redis;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('process_invoice_payment', () => {
    const mockPrivkey = 'mock-private-key';
    const mockInvoice = {
      id: 'invoice-123',
      is_confirmed: true,
      confirmed_at: '2023-01-01T12:00:00.000Z',
      request: 'lnbc1000n1...',
      secret: 'payment-secret-123',
    };

    it('should process invoice payment successfully', async () => {
      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['e', 'note-id'],
          ['relays', 'wss://relay1.com', 'wss://relay2.com'],
        ],
      };

      // Setup mocks to resolve immediately
      const mockPublish = {
        on: vi.fn((event, callback) => {
          if (event === 'ok') {
            // Simulate immediate success
            setTimeout(() => callback(), 0);
          }
        }),
      };

      const mockRelay = {
        url: 'wss://relay1.com',
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockReturnValue(mockPublish),
      };

      pkg.relayInit.mockReturnValue(mockRelay);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(mockRedis.get).toHaveBeenCalledWith('nostrInvoice:invoice-123');
      expect(getPublicKey).toHaveBeenCalledWith(mockPrivkey);
      expect(calculateId).toHaveBeenCalled();
      expect(signId).toHaveBeenCalled();
    }, 10000); // Increase timeout

    it('should handle missing invoice metadata', async () => {
      mockRedis.get.mockResolvedValue(null);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not parse metadata description as json for invoice-123'
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON in metadata', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Could not parse description as json'
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle missing zap request in metadata', async () => {
      const invalidMetadata = { kind: 1, content: 'not a zap request' };
      mockRedis.get.mockResolvedValue(JSON.stringify(invalidMetadata));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith('Could not find zap request note in metadata');
      
      consoleSpy.mockRestore();
    });

    it('should handle zap request without tags', async () => {
      const zapRequestWithoutTags = { kind: 9734, content: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(zapRequestWithoutTags));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith('No tags found');
      
      consoleSpy.mockRestore();
    });

    it('should handle zap request with empty tags', async () => {
      const zapRequestWithEmptyTags = { kind: 9734, content: 'test', tags: [] };
      mockRedis.get.mockResolvedValue(JSON.stringify(zapRequestWithEmptyTags));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith('No tags found');
      
      consoleSpy.mockRestore();
    });

    it('should handle missing p tag', async () => {
      const zapRequestWithoutPTag = {
        kind: 9734,
        content: 'test',
        tags: [['relays', 'wss://relay1.com']],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(zapRequestWithoutPTag));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith('None or multiple p tags found');

      consoleSpy.mockRestore();
    });

    it('should handle missing relays tag', async () => {
      const zapRequestWithoutRelays = {
        kind: 9734,
        content: 'test',
        tags: [['p', 'recipient-pubkey']],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(zapRequestWithoutRelays));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      expect(consoleSpy).toHaveBeenCalledWith('No relays tag found in');

      consoleSpy.mockRestore();
    });

    it('should create zap note with correct structure', async () => {
      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['e', 'note-id'],
          ['relays', 'wss://relay1.com', 'wss://relay2.com'],
        ],
      };

      // Setup mocks to resolve immediately
      const mockPublish = {
        on: vi.fn((event, callback) => {
          if (event === 'ok') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      const mockRelay = {
        url: 'wss://relay1.com',
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockReturnValue(mockPublish),
      };

      pkg.relayInit.mockReturnValue(mockRelay);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      // Verify calculateId was called with correct event structure
      expect(calculateId).toHaveBeenCalledWith(
        expect.objectContaining({
          pubkey: 'mock-pubkey',
          kind: 9735,
          content: 'Great post!',
          tags: expect.arrayContaining([
            ['p', 'recipient-pubkey'],
            ['e', 'note-id'],
            ['bolt11', 'lnbc1000n1...'],
            ['description', JSON.stringify(mockZapRequest)],
            ['preimage', 'payment-secret-123'],
          ]),
        })
      );
    }, 10000);

    it('should handle zap request without e tag', async () => {
      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['relays', 'wss://relay1.com', 'wss://relay2.com'],
        ],
      };

      // Setup mocks to resolve immediately
      const mockPublish = {
        on: vi.fn((event, callback) => {
          if (event === 'ok') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      const mockRelay = {
        url: 'wss://relay1.com',
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockReturnValue(mockPublish),
      };

      pkg.relayInit.mockReturnValue(mockRelay);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await relayModule.process_invoice_payment(mockPrivkey, mockInvoice);

      // Should still process successfully without e tag
      expect(calculateId).toHaveBeenCalled();
    }, 10000);
  });

  describe('Relay Communication', () => {
    it('should send note to multiple relays', async () => {
      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['relays', 'wss://relay1.com', 'wss://relay2.com'],
        ],
      };

      // Setup mocks to resolve immediately
      const mockPublish = {
        on: vi.fn((event, callback) => {
          if (event === 'ok') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      const mockRelay = {
        url: 'wss://relay1.com',
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockReturnValue(mockPublish),
      };

      pkg.relayInit.mockReturnValue(mockRelay);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await relayModule.process_invoice_payment('mock-privkey', {
        id: 'invoice-123',
        is_confirmed: true,
        confirmed_at: '2023-01-01T12:00:00.000Z',
        request: 'lnbc1000n1...',
        secret: 'payment-secret-123',
      });

      // Should initialize relays for each URL
      expect(pkg.relayInit).toHaveBeenCalledWith('wss://relay1.com');
      expect(pkg.relayInit).toHaveBeenCalledWith('wss://relay2.com');
    }, 10000);

    it('should handle relay connection errors gracefully', async () => {
      const mockRelay = {
        url: 'wss://failing-relay.com',
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        publish: vi.fn(),
      };

      pkg.relayInit.mockReturnValue(mockRelay);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['relays', 'wss://failing-relay.com'],
        ],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await relayModule.process_invoice_payment('mock-privkey', {
        id: 'invoice-123',
        is_confirmed: true,
        confirmed_at: '2023-01-01T12:00:00.000Z',
        request: 'lnbc1000n1...',
        secret: 'payment-secret-123',
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle publish success events', async () => {
      const mockPublish = {
        on: vi.fn((event, callback) => {
          if (event === 'ok') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      const mockRelay = {
        url: 'wss://relay.example.com',
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockReturnValue(mockPublish),
      };

      pkg.relayInit.mockReturnValue(mockRelay);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['relays', 'wss://relay.example.com'],
        ],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await relayModule.process_invoice_payment('mock-privkey', {
        id: 'invoice-123',
        is_confirmed: true,
        confirmed_at: '2023-01-01T12:00:00.000Z',
        request: 'lnbc1000n1...',
        secret: 'payment-secret-123',
      });

      // Verify that event handlers are set up
      expect(mockPublish.on).toHaveBeenCalledWith('ok', expect.any(Function));
      expect(mockPublish.on).toHaveBeenCalledWith('failed', expect.any(Function));

      consoleSpy.mockRestore();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await relayModule.process_invoice_payment('mock-privkey', {
        id: 'invoice-123',
        is_confirmed: true,
        confirmed_at: '2023-01-01T12:00:00.000Z',
        request: 'lnbc1000n1...',
        secret: 'payment-secret-123',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Could not parse description as json'
      );

      consoleSpy.mockRestore();
    });

    it('should handle nostr signing errors', async () => {
      signId.mockRejectedValue(new Error('Signing failed'));

      const mockZapRequest = {
        kind: 9734,
        content: 'Great post!',
        tags: [
          ['p', 'recipient-pubkey'],
          ['relays', 'wss://relay.example.com'],
        ],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockZapRequest));

      await expect(
        relayModule.process_invoice_payment('mock-privkey', {
          id: 'invoice-123',
          is_confirmed: true,
          confirmed_at: '2023-01-01T12:00:00.000Z',
          request: 'lnbc1000n1...',
          secret: 'payment-secret-123',
        })
      ).rejects.toThrow('Signing failed');
    });
  });
});
