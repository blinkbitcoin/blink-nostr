import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQuery } from '@google-cloud/bigquery';
import { findRecentlyPaidInvoices, getLatestInvoiceTimestamp } from '../../src/bigquery';
import {
  createFindRecentlyPaidInvoicesQuery,
  createGetLatestInvoiceTimestampQuery,
} from '../../src/queries';

vi.mock('@google-cloud/bigquery');

describe('BigQuery Service', () => {
  let mockQuery;
  let mockClient;

  beforeEach(() => {
    mockQuery = vi.fn();
    mockClient = {
      query: mockQuery,
    };
    BigQuery.mockClear();
  });

  describe('findRecentlyPaidInvoices', () => {
    it('should call BigQuery with the correct query and parameters', async () => {
      const lastCheckedTimestamp = new Date('2023-01-01T00:00:00.000Z');
      const expectedOptions = createFindRecentlyPaidInvoicesQuery(lastCheckedTimestamp);
      mockQuery.mockResolvedValue([[]]);

      await findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp);

      expect(mockClient.query).toHaveBeenCalledWith(expectedOptions);
    });

    it('should return the rows from the query result', async () => {
      const lastCheckedTimestamp = new Date();
      const mockRows = [{ _id: 'hash1' }, { _id: 'hash2' }];
      mockQuery.mockResolvedValue([mockRows]);

      const result = await findRecentlyPaidInvoices(mockClient, lastCheckedTimestamp);

      expect(result).toEqual(mockRows);
    });
  });

  describe('getLatestInvoiceTimestamp', () => {
    it('should call BigQuery with the correct query', async () => {
      const expectedOptions = createGetLatestInvoiceTimestampQuery();
      mockQuery.mockResolvedValue([[]]);

      await getLatestInvoiceTimestamp(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(expectedOptions);
    });

    it('should return the timestamp from the query result', async () => {
      const mockTimestamp = '2023-01-01T12:00:00.000Z';
      mockQuery.mockResolvedValue([[{ latestTimestamp: { value: mockTimestamp } }]]);

      const result = await getLatestInvoiceTimestamp(mockClient);

      expect(result).toEqual(new Date(mockTimestamp));
    });

    it('should return a default timestamp if no rows are returned', async () => {
      mockQuery.mockResolvedValue([[]]);
      const now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      const result = await getLatestInvoiceTimestamp(mockClient);

      expect(result).toEqual(new Date(now - 5 * 60 * 1000));
    });
  });
});
