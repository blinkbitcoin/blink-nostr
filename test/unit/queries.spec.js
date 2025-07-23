import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Query Builder', () => {
  let originalEnv;
  let queriesModule;

  beforeEach(async () => {
    // Store original environment variables
    originalEnv = {
      BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID,
      BIGQUERY_DATASET_ID: process.env.BIGQUERY_DATASET_ID,
    };
    
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

  describe('createFindRecentlyPaidInvoicesQuery', () => {
    it('should create query with default project and dataset', async () => {
      delete process.env.BIGQUERY_PROJECT_ID;
      delete process.env.BIGQUERY_DATASET_ID;

      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      expect(result).toEqual({
        query: expect.stringContaining('`galoy-reporting.dataform_galoy_staging.mongodb_galoy_walletinvoices`'),
        params: {
          lastCheckedTimestamp: '2023-01-01T12:00:00.000Z',
        },
      });
    });

    it('should create query with custom project and dataset', async () => {
      process.env.BIGQUERY_PROJECT_ID = 'custom-project';
      process.env.BIGQUERY_DATASET_ID = 'custom_dataset';

      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      expect(result).toEqual({
        query: expect.stringContaining('`custom-project.custom_dataset.mongodb_galoy_walletinvoices`'),
        params: {
          lastCheckedTimestamp: '2023-01-01T12:00:00.000Z',
        },
      });
    });

    it('should include all required fields in SELECT clause', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      const expectedFields = ['_id', 'timestamp', 'walletId', 'paymentRequest', 'paid', 'processingCompleted', 'secret'];
      expectedFields.forEach(field => {
        expect(result.query).toContain(field);
      });
    });

    it('should include correct WHERE conditions', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      expect(result.query).toContain('paid = true');
      expect(result.query).toContain('processingCompleted = true');
      expect(result.query).toContain('paymentRequest IS NOT NULL');
      expect(result.query).toContain('selfGenerated = false');
      expect(result.query).toContain('timestamp > @lastCheckedTimestamp');
    });

    it('should include ORDER BY and LIMIT clauses', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      expect(result.query).toContain('ORDER BY timestamp ASC');
      expect(result.query).toContain('LIMIT 1000');
    });

    it('should handle different timestamp formats', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const timestamp1 = new Date('2023-12-31T23:59:59.999Z');
      const result1 = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp1);
      
      expect(result1.params.lastCheckedTimestamp).toBe('2023-12-31T23:59:59.999Z');

      const timestamp2 = new Date('2023-01-01T00:00:00.000Z');
      const result2 = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp2);
      
      expect(result2.params.lastCheckedTimestamp).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should parameterize timestamp to prevent SQL injection', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      // Should use parameterized query, not direct string interpolation
      expect(result.query).toContain('@lastCheckedTimestamp');
      expect(result.query).not.toContain('2023-01-01T12:00:00.000Z');
      expect(result.params.lastCheckedTimestamp).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('createGetLatestInvoiceTimestampQuery', () => {
    it('should create query with default project and dataset', async () => {
      delete process.env.BIGQUERY_PROJECT_ID;
      delete process.env.BIGQUERY_DATASET_ID;

      queriesModule = await import('../../src/queries.js');
      
      const result = queriesModule.createGetLatestInvoiceTimestampQuery();

      expect(result).toEqual({
        query: expect.stringContaining('`galoy-reporting.dataform_galoy_staging.mongodb_galoy_walletinvoices`'),
      });
    });

    it('should create query with custom project and dataset', async () => {
      process.env.BIGQUERY_PROJECT_ID = 'custom-project';
      process.env.BIGQUERY_DATASET_ID = 'custom_dataset';

      queriesModule = await import('../../src/queries.js');
      
      const result = queriesModule.createGetLatestInvoiceTimestampQuery();

      expect(result).toEqual({
        query: expect.stringContaining('`custom-project.custom_dataset.mongodb_galoy_walletinvoices`'),
      });
    });

    it('should select MAX timestamp', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const result = queriesModule.createGetLatestInvoiceTimestampQuery();

      expect(result.query).toContain('SELECT MAX(timestamp) as latestTimestamp');
    });

    it('should include correct WHERE conditions', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const result = queriesModule.createGetLatestInvoiceTimestampQuery();

      expect(result.query).toContain('paid = true');
      expect(result.query).toContain('processingCompleted = true');
      expect(result.query).toContain('paymentRequest IS NOT NULL');
      expect(result.query).toContain('selfGenerated = false');
    });

    it('should not include parameters', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const result = queriesModule.createGetLatestInvoiceTimestampQuery();

      expect(result.params).toBeUndefined();
    });

    it('should not include ORDER BY or LIMIT clauses', async () => {
      queriesModule = await import('../../src/queries.js');
      
      const result = queriesModule.createGetLatestInvoiceTimestampQuery();

      expect(result.query).not.toContain('ORDER BY');
      expect(result.query).not.toContain('LIMIT');
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      delete process.env.BIGQUERY_PROJECT_ID;
      delete process.env.BIGQUERY_DATASET_ID;

      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      expect(result.query).toContain('galoy-reporting.dataform_galoy_staging.mongodb_galoy_walletinvoices');
    });

    it('should handle empty string environment variables', async () => {
      process.env.BIGQUERY_PROJECT_ID = '';
      process.env.BIGQUERY_DATASET_ID = '';

      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      // Empty strings should fall back to defaults
      expect(result.query).toContain('galoy-reporting.dataform_galoy_staging.mongodb_galoy_walletinvoices');
    });

    it('should use environment variables when provided', async () => {
      process.env.BIGQUERY_PROJECT_ID = 'test-project-123';
      process.env.BIGQUERY_DATASET_ID = 'test_dataset_456';

      queriesModule = await import('../../src/queries.js');
      
      const timestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(timestamp);

      expect(result.query).toContain('test-project-123.test_dataset_456.mongodb_galoy_walletinvoices');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should not allow SQL injection through timestamp parameter', async () => {
      queriesModule = await import('../../src/queries.js');
      
      // Try to inject SQL through the timestamp
      const maliciousTimestamp = new Date('2023-01-01T12:00:00.000Z');
      const result = queriesModule.createFindRecentlyPaidInvoicesQuery(maliciousTimestamp);

      // Should use parameterized query
      expect(result.query).toContain('@lastCheckedTimestamp');
      expect(result.params.lastCheckedTimestamp).toBe('2023-01-01T12:00:00.000Z');
    });
  });
});
