# BigQuery Setup for Intraledger Zap Monitoring

## Overview

This document outlines the setup of BigQuery for monitoring intraledger payments in the blink-nostr service. This implementation uses the existing Kafka streaming architecture and provides better separation of concerns by avoiding direct database access.

## Why BigQuery?

1. **Architectural Consistency**: Uses the existing Kafka → BigQuery pipeline
2. **No Direct Database Access**: Removes the need for blink-nostr to connect to production MongoDB
3. **Better Performance**: BigQuery is optimized for analytical queries
4. **Scalability**: No additional load on production databases
5. **Data Freshness**: Kafka streaming provides near real-time data

## Implementation

### 1. BigQuery Client Setup

- **Added**: `@google-cloud/bigquery` dependency and `src/bigquery.js`
- **Implemented**: BigQuery queries in `src/queries.js`
- **Integrated**: BigQuery monitoring in `src/zapper.js` and `src/intraledger-monitor.js`

### 2. Environment Variables

```bash
BIGQUERY_PROJECT_ID=galoy-reporting
BIGQUERY_DATASET_ID=dataform_galoy_staging  # or dataform_galoy_bbw for production
GOOGLE_APPLICATION_CREDENTIALS=<path_to_service_account_key>
# OR
BIGQUERY_CREDENTIALS=<service_account_json_string>
```

### 3. Query Logic

The BigQuery implementation queries the `mongodb_galoy_walletinvoices` table which is populated by the existing Kafka streaming pipeline. The query identifies intraledger payments by:

- `paid = true`
- `processingCompleted = true` 
- `paymentRequest IS NOT NULL`
- `selfGenerated = false` (heuristic for intraledger payments)

## Deployment Steps

### 1. Service Account Setup

Create a BigQuery service account with the following permissions:
- `BigQuery Data Viewer`
- `BigQuery Job User`

```bash
# Create service account
gcloud iam service-accounts create blink-nostr-bigquery \
  --description="Service account for blink-nostr BigQuery access" \
  --display-name="Blink Nostr BigQuery"

# Grant BigQuery permissions
gcloud projects add-iam-policy-binding galoy-reporting \
  --member="serviceAccount:blink-nostr-bigquery@galoy-reporting.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding galoy-reporting \
  --member="serviceAccount:blink-nostr-bigquery@galoy-reporting.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Create and download key
gcloud iam service-accounts keys create blink-nostr-bigquery-key.json \
  --iam-account=blink-nostr-bigquery@galoy-reporting.iam.gserviceaccount.com
```

### 2. Environment Configuration

**For Staging**:
```bash
export BIGQUERY_PROJECT_ID=galoy-reporting
export BIGQUERY_DATASET_ID=dataform_galoy_staging
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/blink-nostr-bigquery-key.json
```

**For Production**:
```bash
export BIGQUERY_PROJECT_ID=galoy-reporting
export BIGQUERY_DATASET_ID=dataform_galoy_bbw
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/blink-nostr-bigquery-key.json
```

### 3. Kubernetes Deployment

Update the Kubernetes deployment to include the BigQuery credentials:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: blink-nostr-bigquery-creds
type: Opaque
data:
  keyfile: <base64-encoded-service-account-key>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blink-nostr
spec:
  template:
    spec:
      containers:
      - name: blink-nostr
        env:
        - name: BIGQUERY_PROJECT_ID
          value: "galoy-reporting"
        - name: BIGQUERY_DATASET_ID
          value: "dataform_galoy_staging"  # or dataform_galoy_bbw
        - name: GOOGLE_APPLICATION_CREDENTIALS
          value: "/etc/bigquery/keyfile"
        volumeMounts:
        - name: bigquery-creds
          mountPath: /etc/bigquery
          readOnly: true
      volumes:
      - name: bigquery-creds
        secret:
          secretName: blink-nostr-bigquery-creds
```

## Verification

### 1. Check BigQuery Table

Verify the `mongodb_galoy_walletinvoices` table exists and has recent data:

```sql
SELECT COUNT(*) as total_invoices,
       COUNT(CASE WHEN paid = true THEN 1 END) as paid_invoices,
       MAX(timestamp) as latest_timestamp
FROM `galoy-reporting.dataform_galoy_staging.mongodb_galoy_walletinvoices`
WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
```

### 2. Test Intraledger Payment Detection

```sql
SELECT _id, timestamp, paymentRequest, selfGenerated, paid, processingCompleted
FROM `galoy-reporting.dataform_galoy_staging.mongodb_galoy_walletinvoices`
WHERE paid = true 
  AND processingCompleted = true
  AND paymentRequest IS NOT NULL
  AND selfGenerated = false
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC
LIMIT 10
```

### 3. Monitor Service Logs

After deployment, monitor the blink-nostr service logs for:
- Successful BigQuery connection
- Query performance metrics
- Processed intraledger payments

## Performance Considerations

1. **Query Frequency**: The adaptive polling (2-30 seconds) balances freshness with BigQuery costs
2. **Data Latency**: Kafka streaming typically has <1 minute latency
3. **Query Optimization**: Time-windowed queries limit data scanned
4. **Cost Management**: BigQuery charges per query and data scanned

## Future Improvements

1. **Real-time Streaming**: Consider Pub/Sub for real-time notifications instead of polling
2. **Query Optimization**: Refine the intraledger payment detection logic
3. **Monitoring**: Add BigQuery-specific metrics and alerting
4. **Caching**: Implement query result caching for frequently accessed data