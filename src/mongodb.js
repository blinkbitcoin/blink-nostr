import mongoose from 'mongoose'

// MongoDB connection setup
export const connectToMongoDB = async () => {
  const mongoUrl = process.env.MONGODB_CON
  if (!mongoUrl) {
    throw new Error('MONGODB_CON environment variable is required')
  }

  try {
    await mongoose.connect(mongoUrl, {
      autoIndex: false,
      compressors: ["snappy", "zlib"],
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 120000,
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
      retryWrites: true,
      writeConcern: {
        w: "majority",
      },
      retryReads: true,
      readPreference: "primaryPreferred",
    })
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

// WalletInvoice schema - matches the core API schema
const walletInvoiceSchema = new mongoose.Schema({
  _id: { type: String }, // payment hash
  walletId: { type: String, required: true },
  accountId: { type: String, required: true },
  cents: { type: Number },
  secret: { type: String, required: true },
  currency: { type: String, required: true },
  timestamp: { type: Date, required: true },
  selfGenerated: { type: Boolean, required: true },
  processingCompleted: { type: Boolean, required: true },
  pubkey: { type: String, required: true },
  paid: { type: Boolean, required: true },
  paymentRequest: { type: String },
  externalId: { type: String, required: true },
}, {
  collection: 'walletinvoices'
})

export const WalletInvoice = mongoose.model('WalletInvoice', walletInvoiceSchema)

// Optimized function to find recently paid invoices using only existing indexes
// Strategy: Use time-windowed queries to keep dataset small and leverage existing indexes
export const findRecentlyPaidInvoices = async (lastCheckedTime) => {
  try {
    // Use existing index { paid: 1, processingCompleted: 1 } efficiently
    // Query in smaller time windows to reduce dataset and improve performance
    const now = new Date()
    const maxTimeWindow = 1000 * 60 * 60 * 2 // 2 hours max window
    const timeWindow = Math.min(now.getTime() - lastCheckedTime.getTime(), maxTimeWindow)
    const endTime = new Date(lastCheckedTime.getTime() + timeWindow)

    const invoices = await WalletInvoice.find({
      paid: true,
      processingCompleted: true,
      paymentRequest: { $exists: true, $ne: null },
      timestamp: {
        $gt: lastCheckedTime,
        $lte: endTime // Limit time window to keep dataset small
      }
    })
    .sort({ _id: 1 }) // Sort by _id instead of timestamp for better index usage
    .limit(50)
    .lean() // Use lean() for better performance - returns plain JS objects

    // Sort by timestamp in memory since we have a small dataset
    return invoices.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  } catch (error) {
    console.error('Error finding recently paid invoices:', error)
    throw error
  }
}

// Function to get the latest processed timestamp for resuming after restart
export const getLatestInvoiceTimestamp = async () => {
  try {
    // Use existing index { paid: 1, processingCompleted: 1 } and sort by _id for better performance
    const latestInvoice = await WalletInvoice.findOne({
      paid: true,
      processingCompleted: true,
      paymentRequest: { $exists: true, $ne: null }
    })
    .sort({ _id: -1 }) // Sort by _id instead of timestamp for better index usage
    .limit(1)
    .lean()

    return latestInvoice ? latestInvoice.timestamp : new Date(Date.now() - 300000) // 5 minutes ago as fallback
  } catch (error) {
    console.error('Error getting latest invoice timestamp:', error)
    return new Date(Date.now() - 300000) // 5 minutes ago as fallback
  }
}
