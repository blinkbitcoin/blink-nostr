import { getWalletInfo, subscribeToInvoices } from "./lnd.js"
import { redis } from "./redis.js"
import { process_invoice_payment } from "./relay.js"

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

    const sub = subscribeToInvoices()
    console.log(`🚀 "galoy-nostr" trigger ready`)

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
  }
