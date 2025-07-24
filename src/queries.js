const projectId = process.env.BIGQUERY_PROJECT_ID || 'galoy-reporting'
const datasetId = process.env.BIGQUERY_DATASET_ID || 'dataform_galoy_staging'
const tableId = 'mongodb_galoy_walletinvoices'

const fullTableId = `${projectId}.${datasetId}.${tableId}`

export const createFindRecentlyPaidInvoicesQuery = (lastCheckedTimestamp) => {
  const query = `
    SELECT _id, timestamp, walletId, paymentRequest, paid, processingCompleted, secret
    FROM \`${fullTableId}\`
    WHERE paid = true 
      AND processingCompleted = true
      AND paymentRequest IS NOT NULL
      AND selfGenerated = false
      AND timestamp > @lastCheckedTimestamp
    ORDER BY timestamp ASC
    LIMIT 1000
  `

  const options = {
    query,
    params: {
      lastCheckedTimestamp: lastCheckedTimestamp.toISOString(),
    },
  }

  return options
}

export const createGetLatestInvoiceTimestampQuery = () => {
  const query = `
    SELECT MAX(timestamp) as latestTimestamp
    FROM \`${fullTableId}\`
    WHERE paid = true 
      AND processingCompleted = true
      AND paymentRequest IS NOT NULL
      AND selfGenerated = false
  `
  return { query }
}
