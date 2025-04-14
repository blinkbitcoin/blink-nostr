import lnService from 'ln-service'

const getLndConnection = () => {
  const cert = process.env.LND1_TLS
  const macaroon = process.env.LND1_MACAROON
  const socket = `${process.env.LND1_DNS}:10009`
  
  if (!cert || !macaroon || !socket) {
    throw new Error(`Missing LND credentials: 
      cert: ${!!cert}, 
      macaroon: ${!!macaroon}, 
      socket: ${socket}`)
  }

  return lnService.authenticatedLndGrpc({
    cert,
    macaroon,
    socket,
    allowSelfSigned: true,
  })
}

const {lnd} = getLndConnection()

export const getWalletInfo = async () => {
  try {
    return await lnService.getWalletInfo({lnd})
  } catch (e) {
    console.error('Failed to get wallet info:', e.message)
    throw e
  }
}

export const subscribeToInvoices = () => lnService.subscribeToInvoices({lnd})
