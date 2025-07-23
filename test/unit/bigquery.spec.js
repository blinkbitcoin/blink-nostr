import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BigQuery } from '@google-cloud/bigquery';
import {
  createFindRecentlyPaidInvoicesQuery,
  createGetLatestInvoiceTimestampQuery,
} from '../../src/queries';

vi.mock('@google-cloud/bigquery');

describe('BigQuery Service', () => {
  let mockQuery;
  let mockClient;
  let originalEnv;
  let bigqueryModule;

  beforeEach(async () => {
    mockQuery = vi.fn();
    mockClient = {
      query: mockQuery,
    };
    BigQuery.mockClear();

    // Store original environment variables
    originalEnv = {
      BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID,
      BIGQUERY_CREDENTIALS: process.env.BIGQUERY_CREDENTIALS,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    };

    // Reset modules to clear cached bigquery instance
    vi.resetModules();

    // Dynamically import the module to get fresh instance
    bigqueryModule = await import('../../src/bigquery.js');
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

    // Clear any cached BigQuery instance
    vi.resetModules();
  });

  describe('connectToBigQuery', () => {
    it('should create BigQuery client with default project ID', () => {
      delete process.env.BIGQUERY_PROJECT_ID;
      delete process.env.BIGQUERY_CREDENTIALS;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const mockBigQueryInstance = { projectId: 'galoy-reporting' };
      BigQuery.mockImplementation(() => mockBigQueryInstance);

      const result = bigqueryModule.connectToBigQuery();

      expect(BigQuery).toHaveBeenCalledWith({
        projectId: 'galoy-reporting',
      });
      expect(result).toBe(mockBigQueryInstance);
    });

    it('should use custom project ID from environment variable', () => {
      process.env.BIGQUERY_PROJECT_ID = 'custom-project';
      delete process.env.BIGQUERY_CREDENTIALS;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const mockBigQueryInstance = { projectId: 'custom-project' };
      BigQuery.mockImplementation(() => mockBigQueryInstance);

      const result = bigqueryModule.connectToBigQuery();

      expect(BigQuery).toHaveBeenCalledWith({
        projectId: 'custom-project',
      });
      expect(result).toBe(mockBigQueryInstance);
    });

    it('should parse and use BIGQUERY_CREDENTIALS from environment', () => {
      const credentials = { type: 'service_account', project_id: 'test-project' };
      process.env.BIGQUERY_CREDENTIALS = JSON.stringify(credentials);
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const mockBigQueryInstance = { credentials };
      BigQuery.mockImplementation(() => mockBigQueryInstance);

      const result = bigqueryModule.connectToBigQuery();

      expect(BigQuery).toHaveBeenCalledWith({
        projectId: 'galoy-reporting',
        credentials,
      });
      expect(result).toBe(mockBigQueryInstance);
    });

    it('should use GOOGLE_APPLICATION_CREDENTIALS keyFilename when provided', () => {
      const keyFilename = '/path/to/service-account.json';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;
      delete process.env.BIGQUERY_CREDENTIALS;

      const mockBigQueryInstance = { keyFilename };
      BigQuery.mockImplementation(() => mockBigQueryInstance);

      const result = bigqueryModule.connectToBigQuery();

      expect(BigQuery).toHaveBeenCalledWith({
        projectId: 'galoy-reporting',
        keyFilename,
      });
      expect(result).toBe(mockBigQueryInstance);
    });

    it('should throw error for invalid BIGQUERY_CREDENTIALS JSON', () => {
      process.env.BIGQUERY_CREDENTIALS = 'invalid-json';
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      expect(() => bigqueryModule.connectToBigQuery()).toThrow('Invalid BIGQUERY_CREDENTIALS JSON');
    });

    it('should return cached instance on subsequent calls', () => {
      delete process.env.BIGQUERY_CREDENTIALS;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const mockBigQueryInstance = { projectId: 'galoy-reporting' };
      BigQuery.mockImplementation(() => mockBigQueryInstance);

      const result1 = bigqueryModule.connectToBigQuery();
      const result2 = bigqueryModule.connectToBigQuery();

      expect(BigQuery).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });
  });

  describe('findRecentlyPaidInvoices', () => {
    it('should call BigQuery with the correct query and parameters', async () => {
      const lastCheckedTimestamp = new Date('2023-01-01T00:00:00.000Z');
      const expectedOptions = createFindRecentlyPaidInvoicesQuery(lastCheckedTimestamp);
      mockQuery.mockResolvedValue([[]]);

      await bigqueryModule.findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp);

      expect(mockClient.query).toHaveBeenCalledWith(expectedOptions);
    });

    it('should return the rows from the query result', async () => {
      const lastCheckedTimestamp = new Date();
      const mockRows = [{ _id: 'hash1' }, { _id: 'hash2' }];
      mockQuery.mockResolvedValue([mockRows]);

      const result = await bigqueryModule.findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp);

      expect(result).toEqual(mockRows);
    });

    it('should handle BigQuery connection errors', async () => {
      const lastCheckedTimestamp = new Date();
      const connectionError = new Error('Connection failed');
      mockQuery.mockRejectedValue(connectionError);

      await expect(bigqueryModule.findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp))
        .rejects.toThrow('Connection failed');
    });

    it('should handle query execution errors', async () => {
      const lastCheckedTimestamp = new Date();
      const queryError = new Error('Query execution failed');
      mockQuery.mockRejectedValue(queryError);

      await expect(bigqueryModule.findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp))
        .rejects.toThrow('Query execution failed');
    });

    it('should handle empty result sets', async () => {
      const lastCheckedTimestamp = new Date();
      mockQuery.mockResolvedValue([[]]);

      const result = await bigqueryModule.findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp);

      expect(result).toEqual([]);
    });
  });

  describe('getLatestInvoiceTimestamp', () => {
    it('should call BigQuery with the correct query', async () => {
      const expectedOptions = createGetLatestInvoiceTimestampQuery();
      mockQuery.mockResolvedValue([[]]);

      await bigqueryModule.getLatestInvoiceTimestamp(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(expectedOptions);
    });

    it('should return the timestamp from the query result', async () => {
      const mockTimestamp = '2023-01-01T12:00:00.000Z';
      mockQuery.mockResolvedValue([[{ latestTimestamp: { value: mockTimestamp } }]]);

      const result = await bigqueryModule.getLatestInvoiceTimestamp(mockClient);

      expect(result).toEqual(new Date(mockTimestamp));
    });

    it('should return a default timestamp if no rows are returned', async () => {
      mockQuery.mockResolvedValue([[]]);
      const now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      const result = await bigqueryModule.getLatestInvoiceTimestamp(mockClient);

      expect(result).toEqual(new Date(now - 5 * 60 * 1000));
    });

    it('should handle BigQuery connection errors', async () => {
      const connectionError = new Error('BigQuery connection failed');
      mockQuery.mockRejectedValue(connectionError);

      await expect(bigqueryModule.getLatestInvoiceTimestamp(mockClient))
        .rejects.toThrow('BigQuery connection failed');
    });

    it('should handle query execution errors', async () => {
      const queryError = new Error('Query failed');
      mockQuery.mockRejectedValue(queryError);

      await expect(bigqueryModule.getLatestInvoiceTimestamp(mockClient))
        .rejects.toThrow('Query failed');
    });

    it('should handle malformed timestamp responses', async () => {
      mockQuery.mockResolvedValue([[{ latestTimestamp: { value: 'invalid-date' } }]]);

      const result = await bigqueryModule.getLatestInvoiceTimestamp(mockClient);

      // The current implementation will create an invalid Date object
      // In a real scenario, this should be handled better
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(true);
    });

    it('should handle null timestamp values', async () => {
      mockQuery.mockResolvedValue([[{ latestTimestamp: null }]]);

      const result = await bigqueryModule.getLatestInvoiceTimestamp(mockClient);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeCloseTo(Date.now() - 5 * 60 * 1000, -3);
    });

    it('should handle missing latestTimestamp field', async () => {
      mockQuery.mockResolvedValue([[{ someOtherField: 'value' }]]);

      const result = await bigqueryModule.getLatestInvoiceTimestamp(mockClient);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeCloseTo(Date.now() - 5 * 60 * 1000, -3);
    });
  });
});
