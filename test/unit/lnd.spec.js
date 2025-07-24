import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import lnService from 'ln-service';

vi.mock('ln-service');

describe('LND Service', () => {
  let originalEnv;
  let lndModule;

  beforeEach(async () => {
    // Store original environment variables
    originalEnv = {
      LND1_TLS: process.env.LND1_TLS,
      LND1_MACAROON: process.env.LND1_MACAROON,
      LND1_DNS: process.env.LND1_DNS,
    };

    // Clear mocks
    lnService.authenticatedLndGrpc.mockClear();
    lnService.getWalletInfo.mockClear();
    lnService.subscribeToInvoices.mockClear();
    
    // Reset modules to get fresh instance
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
    
    vi.resetModules();
  });

  describe('LND Connection Setup', () => {
    it('should create LND connection with valid credentials', async () => {
      process.env.LND1_TLS = 'test-tls-cert';
      process.env.LND1_MACAROON = 'test-macaroon';
      process.env.LND1_DNS = 'lnd.example.com';

      const mockLnd = { pubkey: 'test-pubkey' };
      lnService.authenticatedLndGrpc.mockReturnValue({ lnd: mockLnd });

      lndModule = await import('../../src/lnd.js');

      expect(lnService.authenticatedLndGrpc).toHaveBeenCalledWith({
        cert: 'test-tls-cert',
        macaroon: 'test-macaroon',
        socket: 'lnd.example.com:10009',
        allowSelfSigned: true,
      });
    });

    it('should throw error when LND1_TLS is missing', async () => {
      delete process.env.LND1_TLS;
      process.env.LND1_MACAROON = 'test-macaroon';
      process.env.LND1_DNS = 'lnd.example.com';

      await expect(async () => {
        await import('../../src/lnd.js');
      }).rejects.toThrow(/Missing LND credentials/);
    });

    it('should throw error when LND1_MACAROON is missing', async () => {
      process.env.LND1_TLS = 'test-tls-cert';
      delete process.env.LND1_MACAROON;
      process.env.LND1_DNS = 'lnd.example.com';

      await expect(async () => {
        await import('../../src/lnd.js');
      }).rejects.toThrow(/Missing LND credentials/);
    });

    it('should not throw error when LND1_DNS is missing (current behavior)', async () => {
      process.env.LND1_TLS = 'test-tls-cert';
      process.env.LND1_MACAROON = 'test-macaroon';
      delete process.env.LND1_DNS;

      const mockLnd = { pubkey: 'test-pubkey' };
      lnService.authenticatedLndGrpc.mockReturnValue({ lnd: mockLnd });

      // The current implementation doesn't actually check for undefined DNS
      // It creates socket as "undefined:10009" which is truthy
      // This test documents the current behavior
      const result = await import('../../src/lnd.js');
      expect(result).toBeDefined();
    });

    it('should include credential status in error message', async () => {
      delete process.env.LND1_TLS;
      delete process.env.LND1_MACAROON;
      process.env.LND1_DNS = 'lnd.example.com';

      await expect(async () => {
        await import('../../src/lnd.js');
      }).rejects.toThrow(/cert: false.*macaroon: false.*socket: lnd\.example\.com:10009/s);
    });
  });

  describe('getWalletInfo', () => {
    beforeEach(async () => {
      process.env.LND1_TLS = 'test-tls-cert';
      process.env.LND1_MACAROON = 'test-macaroon';
      process.env.LND1_DNS = 'lnd.example.com';

      const mockLnd = { pubkey: 'test-pubkey' };
      lnService.authenticatedLndGrpc.mockReturnValue({ lnd: mockLnd });
    });

    it('should return wallet info successfully', async () => {
      const mockWalletInfo = {
        public_key: 'test-pubkey',
        alias: 'test-node',
        chains: ['bitcoin'],
        version: '0.15.0',
      };
      lnService.getWalletInfo.mockResolvedValue(mockWalletInfo);

      lndModule = await import('../../src/lnd.js');
      const result = await lndModule.getWalletInfo();

      expect(result).toEqual(mockWalletInfo);
      expect(lnService.getWalletInfo).toHaveBeenCalledWith({ lnd: expect.any(Object) });
    });

    it('should handle getWalletInfo errors', async () => {
      const error = new Error('Connection failed');
      lnService.getWalletInfo.mockRejectedValue(error);

      lndModule = await import('../../src/lnd.js');

      await expect(lndModule.getWalletInfo()).rejects.toThrow('Connection failed');
    });

    it('should log error message on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Network timeout');
      lnService.getWalletInfo.mockRejectedValue(error);

      lndModule = await import('../../src/lnd.js');

      await expect(lndModule.getWalletInfo()).rejects.toThrow('Network timeout');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get wallet info:', 'Network timeout');
      
      consoleSpy.mockRestore();
    });
  });

  describe('subscribeToInvoices', () => {
    beforeEach(async () => {
      process.env.LND1_TLS = 'test-tls-cert';
      process.env.LND1_MACAROON = 'test-macaroon';
      process.env.LND1_DNS = 'lnd.example.com';

      const mockLnd = { pubkey: 'test-pubkey' };
      lnService.authenticatedLndGrpc.mockReturnValue({ lnd: mockLnd });
    });

    it('should create invoice subscription', async () => {
      const mockSubscription = {
        on: vi.fn(),
        removeAllListeners: vi.fn(),
      };
      lnService.subscribeToInvoices.mockReturnValue(mockSubscription);

      lndModule = await import('../../src/lnd.js');
      const result = lndModule.subscribeToInvoices();

      expect(result).toBe(mockSubscription);
      expect(lnService.subscribeToInvoices).toHaveBeenCalledWith({ lnd: expect.any(Object) });
    });

    it('should return subscription with event handlers', async () => {
      const mockSubscription = {
        on: vi.fn(),
        removeAllListeners: vi.fn(),
      };
      lnService.subscribeToInvoices.mockReturnValue(mockSubscription);

      lndModule = await import('../../src/lnd.js');
      const subscription = lndModule.subscribeToInvoices();

      expect(subscription.on).toBeDefined();
      expect(typeof subscription.on).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle authenticatedLndGrpc errors', async () => {
      process.env.LND1_TLS = 'test-tls-cert';
      process.env.LND1_MACAROON = 'test-macaroon';
      process.env.LND1_DNS = 'lnd.example.com';

      lnService.authenticatedLndGrpc.mockImplementation(() => {
        throw new Error('gRPC connection failed');
      });

      await expect(async () => {
        await import('../../src/lnd.js');
      }).rejects.toThrow('gRPC connection failed');
    });
  });
});
