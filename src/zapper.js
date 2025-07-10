import { getWalletInfo, subscribeToInvoices } from "./lnd.js"
import { redis } from "./redis.js"
import { process_invoice_payment } from "./relay.js"
import { connectToMongoDB } from "./mongodb.js"
import { startIntraledgerMonitor } from "./intraledger-monitor.js"

export const run_zapper = async () => {
    const privkey = process.env.NOSTR_PRIVATE_KEY
    if (!privkey) {
        throw new Error("set NOSTR_PRIVATE_KEY")
    }

    const walletInfo = await getWalletInfo()
    if (!walletInfo) {
      throw new Error("Could not get wallet info")
    }
    console.log({ walletInfo }, "walletInfo")

    try {
        const redisOk = await redis.ping()
        if (!redisOk) {
            throw new Error("Could not ping redis")
        }
    } catch (e) {
        throw new Error("Could not ping redis", e)
    }

    // Connect to MongoDB for intraledger payment monitoring
    try {
        await connectToMongoDB()
    } catch (e) {
        throw new Error("Could not connect to MongoDB", e)
    }

    // Start monitoring for Lightning Network payments via LND
    const sub = subscribeToInvoices()
    console.log(`🚀 "galoy-nostr" Lightning trigger ready`)

    sub.on("invoice_updated", async (invoice) => {
      if (!invoice.is_confirmed) {
        return
      }

      try {
        await process_invoice_payment(privkey, invoice)
        return
      } catch(e) {
        console.log("process threw an error", e)
        return
      }
    })

    // Start monitoring for intraledger payments via optimized database polling
    await startIntraledgerMonitor(privkey)
  }
