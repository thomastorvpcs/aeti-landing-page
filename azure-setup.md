# Azure Infrastructure Requirements
## Apple Business Trade-In — Reseller Onboarding Portal

**Prepared for:** Azure / Infrastructure Team  
**Requested by:** Development Team  
**Date:** April 2026

---

## Overview

The onboarding portal currently runs across two platforms:
- **AWS** — S3 (file storage) and SQS (job queue)
- **Render** — Node.js/Express web service, background worker process, and PostgreSQL database

This document describes all Azure resources needed to fully replicate that infrastructure. Once provisioned, the team will need the output connection strings and hostnames to update the application configuration.

---

## Resources Required

### 1. Resource Group

A single resource group to contain all ABTI-related Azure resources.

| Setting | Value |
|---------|-------|
| Name | `RG-PCS-ABTI` |
| OWNER tag | `Thomas Torvund` |
| PURPOSE tag | `Apple Business Trade-In Reseller Portal` |
| ENV tag | `DEV` |
| Region | East US (or preferred region) |

---

### 2. Storage Account + Blob Container
**Replaces:** AWS S3 bucket

Used to store all reseller documents uploaded during onboarding:
- W-9 tax form
- Bank letter
- Vendor setup form (generated PDF)
- Signed NDA (received from Acrobat Sign after e-signing)

Documents are private — never publicly accessible. Access is granted via short-lived SAS URLs (5-minute expiry) generated server-side for the internal dashboard.

| Setting | Value |
|---------|-------|
| Storage account name | `abtiresellerdocs` *(must be globally unique — adjust if taken)* |
| Replication | LRS (locally redundant) |
| Performance | Standard |
| HTTPS only | Yes |
| Minimum TLS version | TLS 1.2 |
| Allow blob public access | **No** |
| Blob container name | `reseller-docs` |
| Container access level | **Private** |
| Encryption at rest | Default (Microsoft-managed keys) |

**Folder structure inside the container:**
```
reseller-docs/
└── resellers/
    └── {reseller-uuid}/
        ├── w9.pdf
        ├── bank_letter.pdf
        ├── vendor_setup_form.pdf
        └── signed_nda.pdf
```

---

### 3. Service Bus Namespace + Queue
**Replaces:** AWS SQS

Used to queue onboarding jobs asynchronously. When a reseller submits their form, a job is placed on this queue. A background worker process picks it up and handles all integrations (sending the NDA, generating documents, sending emails).

| Setting | Value |
|---------|-------|
| Namespace name | `abti-onboarding` *(must be globally unique — adjust if taken)* |
| Pricing tier | **Standard** *(required for dead-letter queuing)* |
| Region | Same as resource group |
| Queue name | `onboarding-jobs` |
| Lock duration | 60 seconds |
| Max delivery count | 5 *(messages that fail 5 times are moved to the dead-letter queue)* |
| Dead-lettering on expiration | Yes |
| Message TTL | 7 days (default) |

The lock duration and max delivery count mirror the current SQS visibility timeout and retry settings so the worker logic does not need to change.

---

### 4. Azure Database for PostgreSQL
**Replaces:** Render PostgreSQL

Primary application database. Stores all reseller submissions, application status, and dashboard user accounts.

| Setting | Value |
|---------|-------|
| Server name | `abti-db` *(must be globally unique — adjust if taken)* |
| Tier | Flexible Server — Burstable B1ms (dev/staging) or General Purpose D2s_v3 (production) |
| PostgreSQL version | 18 |
| Admin username | `abtidbadmin` *(or per convention)* |
| Admin password | Generate a strong password — store in Key Vault |
| Storage | 32 GB (auto-grow enabled) |
| Backup retention | 7 days |
| Geo-redundant backup | No (enable for production) |
| Public network access | Disabled — restrict to App Service via VNet or firewall rules |
| SSL enforcement | Enabled |

**Database to create:** `abti_onboarding`

---

### 5. App Service Plan
**Replaces:** Render web service + worker service hosting

A single App Service Plan that hosts both the web API and the worker as separate App Services.

| Setting | Value |
|---------|-------|
| Plan name | `abti-plan` |
| OS | Linux |
| SKU | B2 (dev/staging) or P1v3 (production) |
| Region | Same as resource group |

---

### 6. App Service — Web API
**Replaces:** Render web service

Hosts the Node.js/Express API that handles form submissions, file uploads, webhooks, and the internal dashboard.

| Setting | Value |
|---------|-------|
| App name | `abti-api` *(must be globally unique — becomes `abti-api.azurewebsites.net`)* |
| Runtime | Node.js 20 LTS |
| App Service Plan | `abti-plan` (from above) |
| Always On | Yes |
| HTTPS only | Yes |
| Minimum TLS version | 1.2 |

**Environment variables to set** (see full list in `.env.example`):
```
NODE_ENV=production
DATABASE_URL=<connection string from step 4>
AZURE_STORAGE_CONNECTION_STRING=<from step 2>
AZURE_BLOB_CONTAINER=reseller-docs
AZURE_SERVICE_BUS_CONNECTION_STRING=<from step 3>
AZURE_SERVICE_BUS_QUEUE_NAME=onboarding-jobs
JWT_SECRET=<generate a strong random string>
SENDGRID_API_KEY=<existing value>
ACROBAT_CLIENT_ID=<existing value>
ACROBAT_CLIENT_SECRET=<existing value>
ACROBAT_REFRESH_TOKEN=<existing value>
ACROBAT_API_BASE_URL=https://api.na4.adobesign.com
ACROBAT_NDA_TEMPLATE_ID=<existing value>
PCS_LEGAL_EMAIL=<existing value>
PCS_OPS_EMAIL=<existing value>
NETSUITE_ACCOUNT_ID=<existing value>
... (remaining NetSuite vars)
```

---

### 7. App Service — Worker
**Replaces:** Render worker service

Hosts the background worker process that polls the Service Bus queue and handles all integrations (NetSuite, Acrobat Sign, document generation, email).

| Setting | Value |
|---------|-------|
| App name | `abti-worker` *(must be globally unique)* |
| Runtime | Node.js 20 LTS |
| App Service Plan | `abti-plan` (shared with web API) |
| Always On | Yes |
| Start command | `node src/workers/onboarding-worker.js` |

**Environment variables:** Same as the web API above. The worker reads the same env vars.

---

## Shared Access Policy (Service Bus)

Create a Shared Access Policy on the queue (not the namespace) with **Send + Listen** permissions only. The application does not need Manage rights.

Provide the connection string for this policy to the development team — not the root namespace connection string.

---

## Provisioning Script

The script below creates all required resources using the Azure CLI. Run it from any terminal with the Azure CLI installed (`az login` first). Update the variables at the top to match your naming conventions before running.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── CONFIGURATION — update these before running ────────────────────────────
RESOURCE_GROUP="RG-PCS-ABTI"
LOCATION="eastus"                          # change to preferred Azure region
DB_LOCATION="centralus"                    # PostgreSQL region (eastus/eastus2 are restricted)
RG_OWNER="Thomas Torvund"
RG_PURPOSE="Apple Business Trade-In Reseller Portal"
RG_ENV="DEV"

# Storage (replaces S3)
STORAGE_ACCOUNT="abtiresellerdocs"         # must be globally unique, lowercase, 3–24 chars
BLOB_CONTAINER="reseller-docs"

# Service Bus (replaces SQS)
SERVICE_BUS_NAMESPACE="abti-onboarding"   # must be globally unique
SERVICE_BUS_QUEUE="onboarding-jobs"
SERVICE_BUS_POLICY="app-send-listen"

# PostgreSQL (replaces Render PostgreSQL)
DB_SERVER="abti-db"                        # must be globally unique
DB_ADMIN="abtidbadmin"
DB_PASSWORD="<generate-a-strong-password>" # change before running
DB_NAME="abti_onboarding"

# App Service (replaces Render web + worker)
APP_PLAN="abti-plan"
APP_API="abti-api"                         # becomes abti-api.azurewebsites.net
APP_WORKER="abti-worker"
# ───────────────────────────────────────────────────────────────────────────

echo ""
echo "=== ABTI Azure Resource Provisioning ==="
echo ""

# 1. Resource Group
echo "Creating resource group..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags OWNER="$RG_OWNER" PURPOSE="$RG_PURPOSE" ENV="$RG_ENV" \
  --output none

# 2. Storage Account
echo "Creating storage account..."
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --allow-blob-public-access false \
  --min-tls-version TLS1_2 \
  --output none

# 3. Blob Container (private — no public access)
echo "Creating blob container..."
STORAGE_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].value" --output tsv)

az storage container create \
  --name "$BLOB_CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$STORAGE_KEY" \
  --public-access off \
  --output none

# 4. Service Bus Namespace (Standard tier — required for dead-letter queuing)
echo "Creating Service Bus namespace..."
az servicebus namespace create \
  --name "$SERVICE_BUS_NAMESPACE" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard \
  --output none

# 5. Service Bus Queue
#    - lock-duration PT1M  = 60s, matches current SQS visibility timeout
#    - max-delivery-count 5 = matches current retry limit before dead-lettering
echo "Creating Service Bus queue..."
az servicebus queue create \
  --name "$SERVICE_BUS_QUEUE" \
  --namespace-name "$SERVICE_BUS_NAMESPACE" \
  --resource-group "$RESOURCE_GROUP" \
  --lock-duration PT1M \
  --max-delivery-count 5 \
  --enable-dead-lettering-on-message-expiration true \
  --output none

# 6. Shared Access Policy — Send + Listen only (no Manage)
echo "Creating queue access policy..."
az servicebus queue authorization-rule create \
  --name "$SERVICE_BUS_POLICY" \
  --queue-name "$SERVICE_BUS_QUEUE" \
  --namespace-name "$SERVICE_BUS_NAMESPACE" \
  --resource-group "$RESOURCE_GROUP" \
  --rights Send Listen \
  --output none

# 7. PostgreSQL Flexible Server
echo "Creating PostgreSQL server..."
az postgres flexible-server create \
  --name "$DB_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$DB_LOCATION" \
  --admin-user "$DB_ADMIN" \
  --admin-password "$DB_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 18 \
  --storage-size 32 \
  --backup-retention 7 \
  --public-access None \
  --output none

# 8. Create the application database
echo "Creating application database..."
az postgres flexible-server db create \
  --database-name "$DB_NAME" \
  --server-name "$DB_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --output none

# 9. App Service Plan (Linux)
echo "Creating App Service plan..."
az appservice plan create \
  --name "$APP_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --is-linux \
  --sku B2 \
  --output none

# 10. Web API App Service
echo "Creating web API App Service..."
az webapp create \
  --name "$APP_API" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_PLAN" \
  --runtime "NODE:20-lts" \
  --output none

az webapp config set \
  --name "$APP_API" \
  --resource-group "$RESOURCE_GROUP" \
  --always-on true \
  --min-tls-version "1.2" \
  --ftps-state Disabled \
  --output none

az webapp update \
  --name "$APP_API" \
  --resource-group "$RESOURCE_GROUP" \
  --https-only true \
  --output none

# 11. Worker App Service
echo "Creating worker App Service..."
az webapp create \
  --name "$APP_WORKER" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_PLAN" \
  --runtime "NODE:20-lts" \
  --output none

az webapp config set \
  --name "$APP_WORKER" \
  --resource-group "$RESOURCE_GROUP" \
  --always-on true \
  --startup-file "node src/workers/onboarding-worker.js" \
  --min-tls-version "1.2" \
  --ftps-state Disabled \
  --output none

# ── OUTPUT — connection strings and hostnames for the dev team ─────────────
echo ""
echo "=== Provisioning complete. Provide the following to the dev team: ==="
echo ""

STORAGE_CONN=$(az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString --output tsv)

SB_CONN=$(az servicebus queue authorization-rule keys list \
  --name "$SERVICE_BUS_POLICY" \
  --queue-name "$SERVICE_BUS_QUEUE" \
  --namespace-name "$SERVICE_BUS_NAMESPACE" \
  --resource-group "$RESOURCE_GROUP" \
  --query primaryConnectionString --output tsv)

DB_CONN="postgresql://${DB_ADMIN}:${DB_PASSWORD}@${DB_SERVER}.postgres.database.azure.com/${DB_NAME}?sslmode=require"

echo "# Storage (replaces S3)"
echo "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN"
echo "AZURE_BLOB_CONTAINER=$BLOB_CONTAINER"
echo ""
echo "# Service Bus (replaces SQS)"
echo "AZURE_SERVICE_BUS_CONNECTION_STRING=$SB_CONN"
echo "AZURE_SERVICE_BUS_QUEUE_NAME=$SERVICE_BUS_QUEUE"
echo ""
echo "# Database (replaces Render PostgreSQL)"
echo "DATABASE_URL=$DB_CONN"
echo ""
echo "# App Service hostnames"
echo "Web API: https://${APP_API}.azurewebsites.net"
echo "Worker:  https://${APP_WORKER}.azurewebsites.net"
echo ""
echo "These replace the following (which can be removed):"
echo "  AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT"
echo "  S3_BUCKET, SQS_QUEUE_URL"
echo "  Render DATABASE_URL, Render web service URL, Render worker service URL"
echo ""
```

**Prerequisites:** Azure CLI installed and logged in (`az login`). No other tools required.

---

## What to Hand Back to the Dev Team

Once provisioned, please provide the following values so the application configuration can be updated:

```
# Storage (replaces S3)
AZURE_STORAGE_CONNECTION_STRING=<storage account connection string>
AZURE_BLOB_CONTAINER=reseller-docs

# Service Bus (replaces SQS)
AZURE_SERVICE_BUS_CONNECTION_STRING=<queue-scoped SAS connection string>
AZURE_SERVICE_BUS_QUEUE_NAME=onboarding-jobs

# Database (replaces Render PostgreSQL)
DATABASE_URL=postgresql://abtidbadmin:<password>@abti-db.postgres.database.azure.com/abti_onboarding?sslmode=require

# App Service hostnames
Web API: https://abti-api.azurewebsites.net
Worker:  https://abti-worker.azurewebsites.net
```

These replace the following which can then be removed:
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_ENDPOINT
S3_BUCKET
SQS_QUEUE_URL
Render DATABASE_URL
Render web service URL
Render worker service URL
```

---

## Security Notes

- **No public blob access** — all documents are private. The application generates short-lived SAS URLs server-side; files are never exposed directly.
- **Managed Identity** — for a production hardening pass, the storage account key and Service Bus connection string can be replaced with Managed Identity bindings to eliminate long-lived credentials entirely. This is recommended but can be done as a follow-up after the initial migration.
- **Service Bus policy scope** — the connection string shared with the app should be scoped to the queue with Send+Listen only, not the full namespace.
- **PostgreSQL** — public network access is disabled. Configure VNet integration between the App Services and the database server, or add the App Service outbound IPs to the PostgreSQL firewall rules.
- **Database password** — store the PostgreSQL admin password in Azure Key Vault rather than directly in App Service environment variables for production.

---

## Verification Checklist

- [ ] Resource group created
- [ ] Storage account created with public blob access disabled and TLS 1.2 enforced
- [ ] Blob container `reseller-docs` created with private access
- [ ] Service Bus namespace created on Standard tier
- [ ] Queue `onboarding-jobs` created with 60s lock duration and max delivery count of 5
- [ ] Dead-letter queue visible on the Service Bus queue
- [ ] Queue-scoped Shared Access Policy created with Send + Listen only
- [ ] PostgreSQL Flexible Server created with SSL enforced
- [ ] Database `abti_onboarding` created
- [ ] App Service Plan created (Linux, B2 or higher)
- [ ] Web API App Service created (`abti-api`) with Always On and HTTPS only
- [ ] Worker App Service created (`abti-worker`) with correct start command
- [ ] All connection strings and hostnames handed back to dev team
