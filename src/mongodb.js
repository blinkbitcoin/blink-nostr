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

// Optimized function to find recently paid invoices
export const findRecentlyPaidInvoices = async (lastCheckedTime) => {
  try {
    // Uses existing index { paid: 1, processingCompleted: 1 } and new timestamp index { timestamp: 1 }
    const invoices = await WalletInvoice.find({
      paid: true,
      processingCompleted: true,
      paymentRequest: { $exists: true, $ne: null },
      timestamp: { $gt: lastCheckedTime }
    })
    .sort({ timestamp: 1 })
    .limit(50) // Reduced from 100 for better performance
    .lean() // Use lean() for better performance - returns plain JS objects
    
    return invoices
  } catch (error) {
    console.error('Error finding recently paid invoices:', error)
    throw error
  }
}

// Function to get the latest processed timestamp for resuming after restart
export const getLatestInvoiceTimestamp = async () => {
  try {
    const latestInvoice = await WalletInvoice.findOne({
      paid: true,
      processingCompleted: true,
      paymentRequest: { $exists: true, $ne: null }
    })
    .sort({ timestamp: -1 })
    .limit(1)
    .lean()
    
    return latestInvoice ? latestInvoice.timestamp : new Date(Date.now() - 300000) // 5 minutes ago as fallback
  } catch (error) {
    console.error('Error getting latest invoice timestamp:', error)
    return new Date(Date.now() - 300000) // 5 minutes ago as fallback
  }
}
