import { findRecentlyPaidInvoices, getLatestInvoiceTimestamp } from './mongodb.js'
import { process_invoice_payment } from './relay.js'

// Track the last time we checked for new payments
let lastCheckedTime = null

// Set to track processed payment hashes to avoid duplicates
const processedPaymentHashes = new Set()

// Performance monitoring
let queryCount = 0
let totalQueryTime = 0

export const startIntraledgerMonitor = async (privkey) => {
  console.log('🔍 Starting optimized intraledger payment monitor')
  
  // Initialize lastCheckedTime from database
  try {
    lastCheckedTime = await getLatestInvoiceTimestamp()
    console.log(`📅 Starting from timestamp: ${lastCheckedTime.toISOString()}`)
  } catch (error) {
    console.error('Error initializing timestamp:', error)
    lastCheckedTime = new Date(Date.now() - 300000) // 5 minutes ago
  }
  
  // Adaptive polling interval
  let pollInterval = 5000 // Start with 5 seconds
  const minInterval = 2000 // Minimum 2 seconds
  const maxInterval = 30000 // Maximum 30 seconds
  
  const poll = async () => {
    const queryStart = Date.now()
    
    try {
      const recentInvoices = await findRecentlyPaidInvoices(lastCheckedTime)
      
      const queryDuration = Date.now() - queryStart
      queryCount++
      totalQueryTime += queryDuration
      
      // Log performance stats every 100 queries
      if (queryCount % 100 === 0) {
        const avgQueryTime = totalQueryTime / queryCount
        console.log(`📊 Query performance: ${avgQueryTime.toFixed(2)}ms avg, ${queryDuration}ms last`)
      }
      
      // Skip if query is too slow (circuit breaker)
      if (queryDuration > 5000) {
        console.warn(`⚠️  Slow query detected (${queryDuration}ms), skipping processing`)
        return
      }
      
      let processedCount = 0
      
      for (const invoice of recentInvoices) {
        const paymentHash = invoice._id
        
        // Skip if we've already processed this payment
        if (processedPaymentHashes.has(paymentHash)) {
          continue
        }
        
        // Mark as processed to avoid duplicates
        processedPaymentHashes.add(paymentHash)
        
        // Create a mock invoice object that matches what LND would provide
        const mockInvoice = {
          id: paymentHash,
          is_confirmed: true,
          confirmed_at: invoice.timestamp,
          request: invoice.paymentRequest,
          secret: invoice.secret
        }
        
        console.log(`📦 Processing intraledger payment: ${paymentHash}`)
        
        try {
          await process_invoice_payment(privkey, mockInvoice)
          processedCount++
        } catch (error) {
          console.error(`Error processing intraledger payment ${paymentHash}:`, error)
        }
      }
      
      // Update last checked time to the most recent invoice timestamp
      if (recentInvoices.length > 0) {
        const latestTimestamp = Math.max(...recentInvoices.map(inv => inv.timestamp.getTime()))
        lastCheckedTime = new Date(latestTimestamp)

        if (processedCount > 0) {
          console.log(`✅ Processed ${processedCount} intraledger payments`)
        }
      } else {
        // If no new invoices, advance time by a smaller increment to avoid gaps
        const now = new Date()
        const timeDiff = now.getTime() - lastCheckedTime.getTime()
        const maxIncrement = 1000 * 60 * 30 // 30 minutes max increment
        const increment = Math.min(timeDiff, maxIncrement)
        lastCheckedTime = new Date(lastCheckedTime.getTime() + increment)
      }
      
      // Adaptive polling: faster when there's activity, slower when idle
      if (recentInvoices.length > 0) {
        pollInterval = Math.max(minInterval, pollInterval * 0.8) // Speed up
      } else {
        pollInterval = Math.min(maxInterval, pollInterval * 1.2) // Slow down
      }
      
      // Clean up old processed hashes to prevent memory leak
      if (processedPaymentHashes.size > 5000) {
        const hashArray = Array.from(processedPaymentHashes)
        const toKeep = hashArray.slice(-2500) // Keep last 2500
        processedPaymentHashes.clear()
        toKeep.forEach(hash => processedPaymentHashes.add(hash))
        console.log(`🧹 Cleaned up processed hashes, keeping ${toKeep.length}`)
      }
      
    } catch (error) {
      console.error('Error in intraledger monitor poll:', error)
      // Slow down polling on errors
      pollInterval = Math.min(maxInterval, pollInterval * 1.5)
    }
    
    // Schedule next poll with adaptive interval
    setTimeout(poll, pollInterval)
  }
  
  // Start polling
  poll()
  
  // Log status every 5 minutes
  setInterval(() => {
    console.log(`📈 Monitor status: ${processedPaymentHashes.size} hashes tracked, ${pollInterval}ms interval`)
  }, 300000)
}
