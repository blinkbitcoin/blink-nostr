# Blink Nostr

This service connects Lightning Network payments to the Nostr protocol, enabling zap functionality for Blink Bitcoin. It listens for Lightning invoice payments and broadcasts corresponding zap receipts to Nostr relays.

## Overview

Blink Nostr is a bridge service that:

1. Connects to a Lightning Network node (LND)
2. Listens for paid Lightning invoices via LND subscriptions
3. Monitors MongoDB for intraledger payments via optimized polling
4. Retrieves zap request metadata from Redis
5. Creates and signs Nostr zap receipt events (kind 9735)
6. Broadcasts these events to specified Nostr relays

## Components

- **index.js**: Entry point that initializes the zapper service
- **zapper.js**: Main service that monitors LN payments and triggers zap processing
- **lnd.js**: Lightning Network connection and subscription handling
- **redis.js**: Redis connection for storing and retrieving invoice metadata
- **relay.js**: Nostr event creation and relay communication

## Prerequisites

To run this service, you need:

1. **Lightning Network Node (LND)**
   - Access to an LND instance
   - TLS certificate
   - Macaroon for authentication

2. **Redis**
   - Redis instance with Sentinel setup
   - Redis password

3. **Nostr**
   - Private key for signing Nostr events

4. **Node.js Environment**
   - Node.js 22 or later
   - pnpm package manager

## Environment Variables

```
# Nostr
NOSTR_PRIVATE_KEY=<your_nostr_private_key_hex>

# LND
LND1_TLS=<base64_encoded_tls_cert>
LND1_MACAROON=<hex_encoded_macaroon>
LND1_DNS=<lnd_host>

# Redis
REDIS_PASSWORD=<redis_password>
REDIS_MASTER_NAME=mymaster
REDIS_0_DNS=<redis_sentinel_0_host>
REDIS_1_DNS=<redis_sentinel_1_host>
REDIS_2_DNS=<redis_sentinel_2_host>
REDIS_0_SENTINEL_PORT=26379
REDIS_1_SENTINEL_PORT=26379
REDIS_2_SENTINEL_PORT=26379

# MongoDB (for intraledger payment monitoring)
MONGODB_CON=<mongodb_connection_string>
```

## Installation

```bash
# Clone the repository
git clone https://github.com/blinkbitcoin/blink-nostr.git
cd blink-nostr

# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Running the Service

```bash
node src/index.js
```

## Database Setup

The service monitors MongoDB for intraledger payments. Ensure the following database index exists for optimal performance:

```javascript
// Create timestamp index for efficient time-based querying
// This works with existing indexes: { paid: 1, processingCompleted: 1 }
db.walletinvoices.createIndex({
  "timestamp": 1
})
```

The service uses adaptive polling (2-30 seconds) and includes performance monitoring and circuit breakers.

## Development

This project uses:
- ESLint for code quality
- Prettier for code formatting
- Nix for development environment management

```bash
# Set up development environment with Nix
direnv allow  # If using direnv with "use flake" in .envrc

# Check code quality
pnpm code:check

# Fix formatting issues
pnpm prettier:fix
```

## How It Works

1. When a Lightning invoice is paid, the service receives a notification
2. It looks up the associated zap request metadata in Redis
3. It creates a Nostr zap receipt event (kind 9735)
4. It signs the event with the configured Nostr private key
5. It broadcasts the event to the relays specified in the zap request

This enables Nostr clients to display zap receipts for payments made through the Blink Bitcoin Lightning Network node.

## How to test in staging

* grab a nostr account with a zappable note somewhere
* configure the lightning address in that account (needs to be an address to a staging blink wallet which used signet )
* grab the note from that account and zap it, you'll get a invoice
* Pay the invoice with another wallet (NOT blink)
* Check whether the zaps are shown in your nostr client
