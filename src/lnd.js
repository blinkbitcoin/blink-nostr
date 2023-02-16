import lnService from 'ln-service'

const {lnd} = lnService.authenticatedLndGrpc({
    cert: process.env.LND1_TLS,
    macaroon: process.env.LND1_MACAROON,
    socket: `${process.env.LND1_DNS}:10009`,
  })

export const getWalletInfo = () => lnService.getWalletInfo({lnd})
export const subscribeToInvoices = () => lnService.subscribeToInvoices({lnd})