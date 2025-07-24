import { BigQuery } from '@google-cloud/bigquery'
import {
  createFindRecentlyPaidInvoicesQuery,
  createGetLatestInvoiceTimestampQuery,
} from './queries.js'

let bigquery

export const connectToBigQuery = () => {
  if (bigquery) {
    return bigquery
  }

  const options = {
    projectId: process.env.BIGQUERY_PROJECT_ID || 'galoy-reporting',
  }

  if (process.env.BIGQUERY_CREDENTIALS) {
    try {
      options.credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS)
    } catch (error) {
      console.error('Error parsing BIGQUERY_CREDENTIALS:', error)
      throw new Error('Invalid BIGQUERY_CREDENTIALS JSON')
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS
  }

  bigquery = new BigQuery(options)
  return bigquery
}

export const findRecentlyPaidInvoices = async (client, lastCheckedTimestamp) => {
  const options = createFindRecentlyPaidInvoicesQuery(lastCheckedTimestamp)
  const [rows] = await client.query(options)
  return rows
}

export const getLatestInvoiceTimestamp = async (client) => {
  const options = createGetLatestInvoiceTimestampQuery()
  const [rows] = await client.query(options)

  if (rows.length > 0 && rows[0].latestTimestamp) {
    return new Date(rows[0].latestTimestamp.value)
  }
  // Return a default value if no timestamp is found
  return new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
}
