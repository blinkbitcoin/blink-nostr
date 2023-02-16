import { getWalletInfo, subscribeToInvoices } from "./lnd.js"
import { process_invoice_payment } from "./relay.js"

export const run_zapper = async () => {
    const privkey = process.env.NOSTR_PRIVATE_KEY
    if (!privkey) {
      console.log("set NOSTR_PRIVATE_KEY")
      return
    }
  
    try {
        const walletInfo = await getWalletInfo()
        if (!walletInfo) {
            console.log("Could not get wallet info")
            return
        }    
    } catch (e) {
        console.log("Could not get wallet info", e)
        return
    }

    const sub = subscribeToInvoices()
  
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