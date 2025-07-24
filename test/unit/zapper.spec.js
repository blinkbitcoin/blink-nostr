import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies
vi.mock('../../src/lnd.js', () => ({
  getWalletInfo: vi.fn(),
  subscribeToInvoices: vi.fn(),
}));

vi.mock('../../src/redis.js', () => ({
  redis: {
    ping: vi.fn(),
  },
}));

vi.mock('../../src/bigquery.js', () => ({
  connectToBigQuery: vi.fn(),
}));

vi.mock('../../src/relay.js', () => ({
  process_invoice_payment: vi.fn(),
}));

vi.mock('../../src/intraledger-monitor.js', () => ({
  startIntraledgerMonitor: vi.fn(),
}));

describe('Zapper Service', () => {
  let zapperModule;
  let mockLnd;
  let mockRedis;
  let mockBigQuery;
  let mockRelay;
  let mockIntraledgerMonitor;
  let originalEnv;

  beforeEach(async () => {
    // Store original environment
    originalEnv = {
      NOSTR_PRIVATE_KEY: process.env.NOSTR_PRIVATE_KEY,
    };

    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset modules
    vi.resetModules();
    
    // Import mocked modules
    const lndModule = await import('../../src/lnd.js');
    const redisModule = await import('../../src/redis.js');
    const bigqueryModule = await import('../../src/bigquery.js');
    const relayModule = await import('../../src/relay.js');
    const intraledgerModule = await import('../../src/intraledger-monitor.js');
    
    mockLnd = {
      getWalletInfo: lndModule.getWalletInfo,
      subscribeToInvoices: lndModule.subscribeToInvoices,
    };
    
    mockRedis = redisModule.redis;
    mockBigQuery = { connectToBigQuery: bigqueryModule.connectToBigQuery };
    mockRelay = { process_invoice_payment: relayModule.process_invoice_payment };
    mockIntraledgerMonitor = { startIntraledgerMonitor: intraledgerModule.startIntraledgerMonitor };
    
    // Import the module under test
    zapperModule = await import('../../src/zapper.js');
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
    
    vi.resetModules();
  });

  describe('run_zapper', () => {
    it('should throw error when NOSTR_PRIVATE_KEY is missing', async () => {
      delete process.env.NOSTR_PRIVATE_KEY;

      await expect(zapperModule.run_zapper()).rejects.toThrow('set NOSTR_PRIVATE_KEY');
    });

    it('should throw error when wallet info cannot be retrieved', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      mockLnd.getWalletInfo.mockResolvedValue(null);

      await expect(zapperModule.run_zapper()).rejects.toThrow('Could not get wallet info');
    });

    it('should throw error when wallet info retrieval fails', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      mockLnd.getWalletInfo.mockRejectedValue(new Error('LND connection failed'));

      await expect(zapperModule.run_zapper()).rejects.toThrow('LND connection failed');
    });

    it('should throw error when Redis ping fails', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      mockLnd.getWalletInfo.mockResolvedValue({ public_key: 'test-pubkey' });
      mockRedis.ping.mockResolvedValue(null);

      await expect(zapperModule.run_zapper()).rejects.toThrow('Could not ping redis');
    });

    it('should throw error when Redis ping throws', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      mockLnd.getWalletInfo.mockResolvedValue({ public_key: 'test-pubkey' });
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      await expect(zapperModule.run_zapper()).rejects.toThrow('Could not ping redis');
    });

    it('should throw error when BigQuery connection fails', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      mockLnd.getWalletInfo.mockResolvedValue({ public_key: 'test-pubkey' });
      mockRedis.ping.mockResolvedValue('PONG');
      mockBigQuery.connectToBigQuery.mockImplementation(() => {
        throw new Error('BigQuery connection failed');
      });

      await expect(zapperModule.run_zapper()).rejects.toThrow('Could not connect to BigQuery');
    });

    it('should successfully initialize all services', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      
      const mockWalletInfo = { public_key: 'test-pubkey', alias: 'test-node' };
      const mockSubscription = { on: vi.fn() };
      const mockBigQueryClient = { query: vi.fn() };

      mockLnd.getWalletInfo.mockResolvedValue(mockWalletInfo);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBigQuery.connectToBigQuery.mockReturnValue(mockBigQueryClient);
      mockLnd.subscribeToInvoices.mockReturnValue(mockSubscription);
      mockIntraledgerMonitor.startIntraledgerMonitor.mockResolvedValue(undefined);

      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await zapperModule.run_zapper();

      expect(mockLnd.getWalletInfo).toHaveBeenCalled();
      expect(mockRedis.ping).toHaveBeenCalled();
      expect(mockBigQuery.connectToBigQuery).toHaveBeenCalled();
      expect(mockLnd.subscribeToInvoices).toHaveBeenCalled();
      expect(mockIntraledgerMonitor.startIntraledgerMonitor).toHaveBeenCalledWith(
        'test-private-key',
        mockBigQueryClient
      );

      expect(consoleSpy).toHaveBeenCalledWith({ walletInfo: mockWalletInfo }, 'walletInfo');
      expect(consoleSpy).toHaveBeenCalledWith('🚀 "galoy-nostr" Lightning trigger ready');

      consoleSpy.mockRestore();
    });

    it('should set up invoice subscription event handler', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      
      const mockWalletInfo = { public_key: 'test-pubkey' };
      const mockSubscription = { on: vi.fn() };
      const mockBigQueryClient = { query: vi.fn() };

      mockLnd.getWalletInfo.mockResolvedValue(mockWalletInfo);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBigQuery.connectToBigQuery.mockReturnValue(mockBigQueryClient);
      mockLnd.subscribeToInvoices.mockReturnValue(mockSubscription);
      mockIntraledgerMonitor.startIntraledgerMonitor.mockResolvedValue(undefined);

      await zapperModule.run_zapper();

      expect(mockSubscription.on).toHaveBeenCalledWith('invoice_updated', expect.any(Function));
    });

    it('should handle confirmed invoices in subscription', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      
      const mockWalletInfo = { public_key: 'test-pubkey' };
      const mockSubscription = { on: vi.fn() };
      const mockBigQueryClient = { query: vi.fn() };

      mockLnd.getWalletInfo.mockResolvedValue(mockWalletInfo);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBigQuery.connectToBigQuery.mockReturnValue(mockBigQueryClient);
      mockLnd.subscribeToInvoices.mockReturnValue(mockSubscription);
      mockIntraledgerMonitor.startIntraledgerMonitor.mockResolvedValue(undefined);
      mockRelay.process_invoice_payment.mockResolvedValue(undefined);

      await zapperModule.run_zapper();

      // Get the invoice handler
      const invoiceHandler = mockSubscription.on.mock.calls.find(
        call => call[0] === 'invoice_updated'
      )[1];

      // Test confirmed invoice
      const confirmedInvoice = { is_confirmed: true, id: 'test-invoice' };
      await invoiceHandler(confirmedInvoice);

      expect(mockRelay.process_invoice_payment).toHaveBeenCalledWith(
        'test-private-key',
        confirmedInvoice
      );
    });

    it('should ignore unconfirmed invoices in subscription', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      
      const mockWalletInfo = { public_key: 'test-pubkey' };
      const mockSubscription = { on: vi.fn() };
      const mockBigQueryClient = { query: vi.fn() };

      mockLnd.getWalletInfo.mockResolvedValue(mockWalletInfo);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBigQuery.connectToBigQuery.mockReturnValue(mockBigQueryClient);
      mockLnd.subscribeToInvoices.mockReturnValue(mockSubscription);
      mockIntraledgerMonitor.startIntraledgerMonitor.mockResolvedValue(undefined);
      mockRelay.process_invoice_payment.mockResolvedValue(undefined);

      await zapperModule.run_zapper();

      // Get the invoice handler
      const invoiceHandler = mockSubscription.on.mock.calls.find(
        call => call[0] === 'invoice_updated'
      )[1];

      // Test unconfirmed invoice
      const unconfirmedInvoice = { is_confirmed: false, id: 'test-invoice' };
      await invoiceHandler(unconfirmedInvoice);

      expect(mockRelay.process_invoice_payment).not.toHaveBeenCalled();
    });

    it('should handle invoice processing errors gracefully', async () => {
      process.env.NOSTR_PRIVATE_KEY = 'test-private-key';
      
      const mockWalletInfo = { public_key: 'test-pubkey' };
      const mockSubscription = { on: vi.fn() };
      const mockBigQueryClient = { query: vi.fn() };

      mockLnd.getWalletInfo.mockResolvedValue(mockWalletInfo);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBigQuery.connectToBigQuery.mockReturnValue(mockBigQueryClient);
      mockLnd.subscribeToInvoices.mockReturnValue(mockSubscription);
      mockIntraledgerMonitor.startIntraledgerMonitor.mockResolvedValue(undefined);
      mockRelay.process_invoice_payment.mockRejectedValue(new Error('Processing failed'));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await zapperModule.run_zapper();

      // Get the invoice handler
      const invoiceHandler = mockSubscription.on.mock.calls.find(
        call => call[0] === 'invoice_updated'
      )[1];

      // Test confirmed invoice that fails processing
      const confirmedInvoice = { is_confirmed: true, id: 'test-invoice' };
      await invoiceHandler(confirmedInvoice);

      expect(consoleSpy).toHaveBeenCalledWith('process threw an error', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
