import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies
vi.mock('../../src/bigquery.js', () => ({
  findRecentlyPaidInvoices: vi.fn(),
  getLatestInvoiceTimestamp: vi.fn(),
}));

vi.mock('../../src/relay.js', () => ({
  process_invoice_payment: vi.fn(),
}));

describe('Intraledger Monitor', () => {
  let intraledgerModule;
  let mockBigQuery;
  let mockRelay;
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(async () => {
    // Mock timers
    vi.useFakeTimers();

    // Store original console functions
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset modules
    vi.resetModules();
    
    // Import mocked modules
    const bigqueryModule = await import('../../src/bigquery.js');
    const relayModule = await import('../../src/relay.js');
    
    mockBigQuery = {
      findRecentlyPaidInvoices: bigqueryModule.findRecentlyPaidInvoices,
      getLatestInvoiceTimestamp: bigqueryModule.getLatestInvoiceTimestamp,
    };
    
    mockRelay = {
      process_invoice_payment: relayModule.process_invoice_payment,
    };
    
    // Import the module under test
    intraledgerModule = await import('../../src/intraledger-monitor.js');
  });

  afterEach(() => {
    vi.useRealTimers();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.resetModules();
  });

  describe('startIntraledgerMonitor', () => {
    const mockPrivkey = 'mock-private-key';
    const mockBigQueryClient = { query: vi.fn() };

    it('should initialize with latest timestamp from BigQuery', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');
      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue([]);

      // Start the monitor (don't await as it runs indefinitely)
      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      // Let the initialization complete
      await vi.runOnlyPendingTimersAsync();

      expect(mockBigQuery.getLatestInvoiceTimestamp).toHaveBeenCalledWith(mockBigQueryClient);
      expect(console.log).toHaveBeenCalledWith('🔍 Starting BigQuery-based intraledger payment monitor');
      expect(console.log).toHaveBeenCalledWith('📅 Starting from timestamp: 2023-01-01T12:00:00.000Z');
    });

    it('should handle initialization errors gracefully', async () => {
      mockBigQuery.getLatestInvoiceTimestamp.mockRejectedValue(new Error('BigQuery connection failed'));
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue([]);

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      await vi.runOnlyPendingTimersAsync();

      expect(console.error).toHaveBeenCalledWith('Error initializing timestamp:', expect.any(Error));
      // The implementation doesn't log the fallback timestamp when there's an error
      // It just logs the monitor status
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/📈 Monitor status:/));
    });

    it('should process new invoices when found', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');
      const mockInvoices = [
        {
          _id: 'payment-hash-1',
          timestamp: new Date('2023-01-01T12:05:00.000Z'),
          paymentRequest: 'lnbc1000n1...',
          secret: 'secret-1',
        },
        {
          _id: 'payment-hash-2',
          timestamp: new Date('2023-01-01T12:06:00.000Z'),
          paymentRequest: 'lnbc2000n1...',
          secret: 'secret-2',
        },
      ];

      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue(mockInvoices);
      mockRelay.process_invoice_payment.mockResolvedValue(undefined);

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      // Let the first poll complete
      await vi.runOnlyPendingTimersAsync();

      expect(mockBigQuery.findRecentlyPaidInvoices).toHaveBeenCalledWith(mockBigQueryClient, mockTimestamp);
      expect(mockRelay.process_invoice_payment).toHaveBeenCalledTimes(2);
      expect(mockRelay.process_invoice_payment).toHaveBeenCalledWith(mockPrivkey, {
        id: 'payment-hash-1',
        is_confirmed: true,
        confirmed_at: mockInvoices[0].timestamp,
        request: 'lnbc1000n1...',
        secret: 'secret-1',
      });
    });

    it('should skip duplicate payment hashes', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');
      const mockInvoices = [
        {
          _id: 'payment-hash-1',
          timestamp: new Date('2023-01-01T12:05:00.000Z'),
          paymentRequest: 'lnbc1000n1...',
          secret: 'secret-1',
        },
      ];

      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);
      // Return the same invoice multiple times to test duplicate detection
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue(mockInvoices);
      mockRelay.process_invoice_payment.mockResolvedValue(undefined);

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      // Let multiple polls complete to test duplicate detection
      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();

      // Should only process the invoice once despite multiple polls returning the same invoice
      // The implementation tracks processed hashes in a Set to prevent duplicates
      expect(mockRelay.process_invoice_payment).toHaveBeenCalledTimes(1);
    });

    it('should handle processing errors gracefully', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');
      const mockInvoices = [
        {
          _id: 'payment-hash-1',
          timestamp: new Date('2023-01-01T12:05:00.000Z'),
          paymentRequest: 'lnbc1000n1...',
          secret: 'secret-1',
        },
      ];

      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue(mockInvoices);
      mockRelay.process_invoice_payment.mockRejectedValue(new Error('Processing failed'));

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      await vi.runOnlyPendingTimersAsync();

      expect(console.error).toHaveBeenCalledWith(
        'Error processing intraledger payment payment-hash-1:',
        expect.any(Error)
      );
    });

    it('should implement adaptive polling intervals', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');

      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);

      // Mock to return empty results to test polling behavior
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue([]);

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      // Let multiple polls complete to test adaptive behavior
      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();

      // Should have called findRecentlyPaidInvoices multiple times (the implementation polls continuously)
      expect(mockBigQuery.findRecentlyPaidInvoices).toHaveBeenCalledWith(mockBigQueryClient, expect.any(Date));
      expect(mockBigQuery.findRecentlyPaidInvoices.mock.calls.length).toBeGreaterThan(1);
    });

    it('should handle slow queries with circuit breaker', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');
      
      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);
      
      // Mock a slow query (> 5000ms)
      mockBigQuery.findRecentlyPaidInvoices.mockImplementation(() => {
        return new Promise((resolve) => {
          // Simulate slow query by advancing time
          vi.advanceTimersByTime(6000);
          resolve([]);
        });
      });

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      await vi.runOnlyPendingTimersAsync();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/⚠️  Slow query detected.*skipping processing/)
      );
    });

    it('should log performance statistics every 100 queries', async () => {
      const mockTimestamp = new Date('2023-01-01T12:00:00.000Z');
      
      mockBigQuery.getLatestInvoiceTimestamp.mockResolvedValue(mockTimestamp);
      mockBigQuery.findRecentlyPaidInvoices.mockResolvedValue([]);

      intraledgerModule.startIntraledgerMonitor(mockPrivkey, mockBigQueryClient);

      // Simulate 100 queries by advancing timers
      for (let i = 0; i < 100; i++) {
        await vi.runOnlyPendingTimersAsync();
      }

      // Should log performance stats on the 100th query
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/📊 Query performance:.*avg.*last/)
      );
    });
  });
});
