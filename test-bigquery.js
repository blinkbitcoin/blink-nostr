#!/usr/bin/env node

/**
 * Test script to validate BigQuery connection and query functionality
 * Run with: node test-bigquery.js
 */

import { connectToBigQuery, findRecentlyPaidInvoices, getLatestInvoiceTimestamp } from './src/bigquery.js'

async function testBigQueryConnection() {
  console.log('🔍 Testing BigQuery connection...')
  
  try {
    // Test connection
    const bigquery = await connectToBigQuery()
    console.log('✅ Successfully connected to BigQuery')
    
    // Test getting latest timestamp
    console.log('\n📅 Testing latest timestamp query...')
    const latestTimestamp = await getLatestInvoiceTimestamp()
    console.log(`Latest invoice timestamp: ${latestTimestamp.toISOString()}`)
    
    // Test finding recent invoices
    console.log('\n📦 Testing recent invoices query...')
    const testTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    const recentInvoices = await findRecentlyPaidInvoices(testTime)
    console.log(`Found ${recentInvoices.length} recent invoices`)
    
    if (recentInvoices.length > 0) {
      console.log('\nSample invoice:')
      const sample = recentInvoices[0]
      console.log({
        paymentHash: sample._id,
        timestamp: sample.timestamp,
        walletId: sample.walletId,
        paid: sample.paid,
        processingCompleted: sample.processingCompleted,
        hasPaymentRequest: !!sample.paymentRequest
      })
    }
    
    // Test table structure
    console.log('\n🔍 Testing table structure...')
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'galoy-reporting'
    const datasetId = process.env.BIGQUERY_DATASET_ID || 'dataform_galoy_staging'
    const tableId = 'mongodb_galoy_walletinvoices'
    
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = '${tableId}'
      ORDER BY ordinal_position
      LIMIT 10
    `
    
    const [rows] = await bigquery.query(query)
    console.log('Table schema (first 10 columns):')
    rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`)
    })
    
    console.log('\n✅ All tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    
    // Provide helpful debugging information
    console.log('\n🔧 Debugging information:')
    console.log('Environment variables:')
    console.log(`  BIGQUERY_PROJECT_ID: ${process.env.BIGQUERY_PROJECT_ID || 'not set'}`)
    console.log(`  BIGQUERY_DATASET_ID: ${process.env.BIGQUERY_DATASET_ID || 'not set'}`)
    console.log(`  GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set'}`)
    console.log(`  BIGQUERY_CREDENTIALS: ${process.env.BIGQUERY_CREDENTIALS ? 'set' : 'not set'}`)
    
    process.exit(1)
  }
}

// Run the test
testBigQueryConnection()
