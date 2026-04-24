# Azure Infrastructure Setup
## ABTI Reseller Onboarding Portal

**Prepared for:** Azure / Infrastructure Team  
**Requested by:** Development Team (Thomas Torvund — Thomas.Torvund@pcsww.com)  
**Date:** April 2026

---

## Overview

This document describes all Azure resources required to run the ABTI Reseller Onboarding Portal in the company Azure subscription. Two fully isolated environments are required: **production** and **staging**.

### Application components

| Component | Technology | Azure Service |
|---|---|---|
| Frontend (public-facing portal + dashboard) | React / Vite | Azure Static Web Apps |
| API server | Node.js / Express | Azure App Service (Linux) |
| Background worker | Node.js | Azure App Service (Linux) |
| Database | PostgreSQL | Azure Database for PostgreSQL Flexible Server |
| File storage | — | Azure Blob Storage |
| Job queue | — | Azure Service Bus |

**Deployment is fully automated via GitHub Actions.** Once the resources exist and the connection strings are provided to the dev team, all future deployments happen on every push to `master` (production) or `staging` (staging).

---

## Environment Structure

| Resource | Production name | Staging name |
|---|---|---|
| Resource group | `RG-PCS-ABTI-PROD` | `RG-PCS-ABTI-STAGING` |
| Static Web App | `abti-frontend-prod` | `abti-frontend-staging` |
| App Service Plan | `abti-plan-prod` | `abti-plan-staging` |
| API App Service | `abti-api-prod` | `abti-api-staging` |
| Worker App Service | `abti-worker-prod` | `abti-worker-staging` |
| PostgreSQL Server | `abti-db-prod` | shared server, separate DB |
| PostgreSQL Database | `abti_onboarding` | `abti_onboarding_staging` |
| Storage Account | `abtistorageprod` | `abtistoragestaging` |
| Blob Container | `reseller-docs` | `reseller-docs` |
| Service Bus Namespace | `abti-bus-prod` | `abti-bus-staging` |
| Service Bus Queue | `aeti-onboarding` | `aeti-onboarding` |

> **Note:** Resource names containing `.azurewebsites.net` or `.azurestaticapps.net` must be globally unique across all Azure customers. Adjust names if any are already taken — the dev team will update the application configuration to match whatever names are chosen.

---

## Resource Specifications

### Resource Groups

Two resource groups, one per environment.

| Tag | Value |
|---|---|
| OWNER | `Thomas Torvund` |
| PURPOSE | `ABTI Reseller Onboarding Portal` |
| ENV | `PROD` / `STAGING` |
| Region | East US (or preferred region — use the same region for all resources) |

---

### Storage Account + Blob Container

Used to store all reseller documents: W-9, bank letter, generated vendor setup form PDF, and signed NDA. Files are **never publicly accessible** — the application generates short-lived SAS URLs (5-minute expiry) for internal dashboard access only.

**Required for each environment (prod + staging):**

| Setting | Production | Staging |
|---|---|---|
| Storage account name | `abtistorageprod` | `abtistoragestaging` |
| Replication | ZRS (zone-redundant) | LRS (locally redundant) |
| Performance tier | Standard | Standard |
| HTTPS only | **Yes** | Yes |
| Minimum TLS version | **TLS 1.2** | TLS 1.2 |
| Allow blob public access | **No** | No |
| Blob container name | `reseller-docs` | `reseller-docs` |
| Container access level | **Private** | Private |
| Blob soft delete | **Yes — 35 days** | Yes — 7 days |

---

### Service Bus Namespace + Queue

Used to queue onboarding jobs asynchronously. When a reseller submits their form, a job is placed on this queue. The background worker picks it up and handles all integrations (NetSuite, Acrobat Sign, email).

**Required for each environment:**

| Setting | Value |
|---|---|
| Pricing tier | **Standard** *(required — Basic tier does not support dead-letter queuing)* |
| Queue name | `aeti-onboarding` |
| Lock duration | **60 seconds** |
| Max delivery count | **5** *(messages that fail 5× are moved to the dead-letter queue automatically)* |
| Dead-lettering on expiration | Yes |
| Message TTL | 7 days |

After creating the queue, create a **Shared Access Policy** on the queue (not the namespace root) with **Send + Listen** rights only. The dev team needs the connection string from this policy — not the root namespace connection string.

---

### Azure Database for PostgreSQL — Flexible Server

**One server, two databases** (one per environment). This is the most cost-effective approach for staging.

| Setting | Production | Staging |
|---|---|---|
| Server name | `abti-db-prod` | `abti-db-staging` |
| PostgreSQL version | 16 | 16 |
| Compute tier | General Purpose — D2s_v3 (2 vCores) | Burstable — B1ms |
| Admin username | `abtidbadmin` | `abtidbadmin` |
| Admin password | Generate strong password — store in Key Vault | Generate separate password |
| Storage | 32 GB, auto-grow enabled | 32 GB |
| Backup retention | **35 days** | 7 days |
| Geo-redundant backup | Yes | No |
| SSL enforcement | **Enabled** | Enabled |
| Public network access | Restricted (see Firewall section below) | Restricted |

**Databases to create on each server:**

| Server | Database name |
|---|---|
| `abti-db-prod` | `abti_onboarding` |
| `abti-db-staging` | `abti_onboarding_staging` |

The dev team will run database migrations after provisioning. They need to connect temporarily from a dev machine — see the Firewall section below.

---

### App Service Plan

One plan per environment. Both App Services (API + worker) in the same environment share a plan.

| Setting | Production | Staging |
|---|---|---|
| Plan name | `abti-plan-prod` | `abti-plan-staging` |
| OS | **Linux** | Linux |
| SKU | **P1v3** (Premium v3, 1 vCore) | B2 (Basic, 2 vCores) |
| Region | Same as resource group | Same |

> P1v3 is recommended for production over B-series — it supports deployment slots if needed in the future, has no cold-start delays (Always On is available), and provides better baseline performance.

---

### App Service — API (`abti-api-prod` / `abti-api-staging`)

Hosts the Node.js/Express API that handles form submissions, file uploads, Acrobat Sign webhooks, and the internal dashboard.

| Setting | Value |
|---|---|
| Runtime | **Node.js 20 LTS** |
| App Service Plan | `abti-plan-prod` / `abti-plan-staging` |
| Always On | **Yes** |
| HTTPS Only | **Yes** |
| Minimum TLS version | **1.2** |
| FTP state | **Disabled** |
| SCM (Kudu) HTTPS only | Yes |

No startup command needed — the app reads `package.json` `start` script automatically.

---

### App Service — Worker (`abti-worker-prod` / `abti-worker-staging`)

Hosts the background worker that polls the Service Bus queue. It runs as a long-lived process.

| Setting | Value |
|---|---|
| Runtime | **Node.js 20 LTS** |
| App Service Plan | Same plan as API |
| **Startup command** | `node src/workers/onboarding-worker.js` |
| Always On | **Yes** |
| HTTPS Only | Yes |
| Minimum TLS version | 1.2 |
| FTP state | Disabled |

---

### Azure Static Web Apps — Frontend

Hosts the React frontend (both the public-facing onboarding form and the internal dashboard). Two separate Static Web Apps are required so that staging and production have different API backend URLs.

| Setting | Production | Staging |
|---|---|---|
| Resource name | `abti-frontend-prod` | `abti-frontend-staging` |
| Source | GitHub repository, `master` branch | GitHub repository, `staging` branch |
| App location | `./frontend` | `./frontend` |
| Output location | `dist` | `dist` |
| SKU | Free | Free |

> Static Web Apps are **free tier** — no cost. They include global CDN, HTTPS, and custom domain support.

**Important:** After creation, Azure generates a deployment token for each SWA. Provide both tokens to the dev team — they are stored as GitHub Actions secrets and used in the automated deployment pipeline.

---

## Firewall Configuration

### PostgreSQL — Firewall Rules

| Rule name | IP / Range | Purpose |
|---|---|---|
| `AllowAzureServices` | Azure IPs (built-in toggle) | Allows App Services to connect |
| `DevAccess-Thomas` | Thomas's office IP | Allows running database migrations from dev machine |

> Enable **"Allow access to Azure services"** in the PostgreSQL firewall settings. This covers all App Service outbound IPs without needing to list them individually.

After the initial migration is complete and the firewall rule for the dev machine is no longer needed, it can be removed.

### App Service Outbound IPs

If "Allow Azure services" is not acceptable for your security policy, the App Service outbound IPs can be whitelisted individually. The dev team can provide these after the App Services are created (Portal → App Service → Properties → Outbound IP addresses).

---

## Environment Variables (App Service Configuration)

Set these under **App Service → Configuration → Application settings** for each App Service. Both the API and worker in the same environment use identical settings.

The dev team will provide the secret values (NetSuite credentials, Acrobat Sign credentials, SendGrid API key, etc.). The Azure team needs to provide the storage, service bus, and database connection strings.

### Variables the Azure team provides (from the resources above)

```
# Database
DB_HOST=<postgresql-server>.postgres.database.azure.com
DB_PORT=5432
DB_NAME=abti_onboarding                    # staging: abti_onboarding_staging
DB_USER=abtidbadmin
DB_PASSWORD=<admin-password>

# Storage
AZURE_STORAGE_CONNECTION_STRING=<storage-account-connection-string>
AZURE_BLOB_CONTAINER=reseller-docs

# Service Bus
AZURE_SERVICE_BUS_CONNECTION_STRING=<queue-scoped-sas-connection-string>
AZURE_SERVICE_BUS_QUEUE_NAME=aeti-onboarding
```

### Variables the dev team provides

```
# Application
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://<static-web-app-hostname>

# Security
DB_ENCRYPTION_KEY=<32+ character random secret — DIFFERENT per environment>
JWT_SECRET=<random secret — DIFFERENT per environment>
JWT_EXPIRES_IN=8h
ADMIN_SECRET=<secret required to create dashboard user accounts>

# NetSuite
NETSUITE_ACCOUNT_ID=
NETSUITE_CONSUMER_KEY=
NETSUITE_CONSUMER_SECRET=
NETSUITE_TOKEN_ID=
NETSUITE_TOKEN_SECRET=
NETSUITE_RESTLET_URL=

# Acrobat Sign
ACROBAT_CLIENT_ID=
ACROBAT_CLIENT_SECRET=
ACROBAT_REFRESH_TOKEN=
ACROBAT_API_BASE_URL=https://api.na1.adobesign.com
ACROBAT_NDA_TEMPLATE_ID=

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=abtiquestions@pcsww.com
SENDGRID_FROM_NAME=PCS Partner Program
SENDGRID_TEMPLATE_WELCOME=
SENDGRID_TEMPLATE_INTERNAL_ALERT=
SENDGRID_SUPPORT_EMAIL=abtiquestions@pcsww.com

# Internal routing
PCS_OPS_EMAIL=ops@pcsww.com
PCS_LEGAL_EMAIL=legal@pcsww.com
PCS_LEGAL_NAME=PCS Legal Team
```

> **Staging note:** In staging, `PCS_OPS_EMAIL` and `PCS_LEGAL_EMAIL` should be set to the dev team's own email addresses to avoid sending test notifications to the real ops and legal teams.

---

## GitHub Actions — Secrets Required

The CI/CD pipelines need the following secrets added to the GitHub repository under **Settings → Secrets and variables → Actions**.

The Azure team provides all of these by downloading publish profiles and deployment tokens from the Portal.

| Secret name | Where to get it |
|---|---|
| `AZUREAPPSERVICE_PUBLISHPROFILE_PROD_API` | Portal → `abti-api-prod` → Deployment Center → Manage publish profile → Download |
| `AZUREAPPSERVICE_PUBLISHPROFILE_PROD_WORKER` | Portal → `abti-worker-prod` → same steps |
| `AZUREAPPSERVICE_PUBLISHPROFILE_STAGING_API` | Portal → `abti-api-staging` → same steps |
| `AZUREAPPSERVICE_PUBLISHPROFILE_STAGING_WORKER` | Portal → `abti-worker-staging` → same steps |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` | Portal → `abti-frontend-prod` → Manage deployment token |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING` | Portal → `abti-frontend-staging` → Manage deployment token |

---

## Provisioning Script

The script below creates all resources using the Azure CLI. Run it from any machine with the Azure CLI installed and authenticated (`az login`). Review and update the variables at the top before running.

**Prerequisites:** `az` CLI installed, `az login` completed with a subscription that has Contributor access.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── CONFIGURATION — review before running ──────────────────────────────────────
LOCATION="eastus"              # change to preferred Azure region

# Resource groups
RG_PROD="RG-PCS-ABTI-PROD"
RG_STAGING="RG-PCS-ABTI-STAGING"

# Tags
OWNER="Thomas Torvund"
PURPOSE="ABTI Reseller Onboarding Portal"

# Storage
STORAGE_PROD="abtistorageprod"        # globally unique, lowercase, 3–24 chars
STORAGE_STAGING="abtistoragestaging"
BLOB_CONTAINER="reseller-docs"

# Service Bus
BUS_PROD="abti-bus-prod"             # globally unique
BUS_STAGING="abti-bus-staging"
BUS_QUEUE="aeti-onboarding"
BUS_POLICY="app-send-listen"

# PostgreSQL
DB_PROD="abti-db-prod"               # globally unique
DB_STAGING="abti-db-staging"
DB_ADMIN="abtidbadmin"
DB_PASSWORD_PROD="<generate-strong-password>"    # CHANGE before running
DB_PASSWORD_STAGING="<generate-strong-password>" # CHANGE before running — use a different password
DB_NAME_PROD="abti_onboarding"
DB_NAME_STAGING="abti_onboarding_staging"

# App Service
PLAN_PROD="abti-plan-prod"
PLAN_STAGING="abti-plan-staging"
API_PROD="abti-api-prod"
API_STAGING="abti-api-staging"
WORKER_PROD="abti-worker-prod"
WORKER_STAGING="abti-worker-staging"
# ───────────────────────────────────────────────────────────────────────────────

echo "=== ABTI Azure Provisioning ==="
echo ""

# ── Resource Groups ─────────────────────────────────────────────────────────────
echo "[1/12] Creating resource groups..."
az group create \
  --name "$RG_PROD" \
  --location "$LOCATION" \
  --tags OWNER="$OWNER" PURPOSE="$PURPOSE" ENV="PROD" \
  --output none

az group create \
  --name "$RG_STAGING" \
  --location "$LOCATION" \
  --tags OWNER="$OWNER" PURPOSE="$PURPOSE" ENV="STAGING" \
  --output none

# ── Storage Accounts ────────────────────────────────────────────────────────────
echo "[2/12] Creating storage accounts..."
for STORAGE_NAME in "$STORAGE_PROD" "$STORAGE_STAGING"; do
  if [ "$STORAGE_NAME" = "$STORAGE_PROD" ]; then RG="$RG_PROD"; SKU="Standard_ZRS"; else RG="$RG_STAGING"; SKU="Standard_LRS"; fi
  az storage account create \
    --name "$STORAGE_NAME" \
    --resource-group "$RG" \
    --location "$LOCATION" \
    --sku "$SKU" \
    --kind StorageV2 \
    --https-only true \
    --allow-blob-public-access false \
    --min-tls-version TLS1_2 \
    --output none
done

# ── Blob Containers ─────────────────────────────────────────────────────────────
echo "[3/12] Creating blob containers..."
for STORAGE_NAME in "$STORAGE_PROD" "$STORAGE_STAGING"; do
  if [ "$STORAGE_NAME" = "$STORAGE_PROD" ]; then RG="$RG_PROD"; else RG="$RG_STAGING"; fi
  STORAGE_KEY=$(az storage account keys list \
    --account-name "$STORAGE_NAME" \
    --resource-group "$RG" \
    --query "[0].value" --output tsv)
  az storage container create \
    --name "$BLOB_CONTAINER" \
    --account-name "$STORAGE_NAME" \
    --account-key "$STORAGE_KEY" \
    --public-access off \
    --output none
done

# Enable soft delete on production storage (35 days)
az storage blob service-properties delete-policy update \
  --account-name "$STORAGE_PROD" \
  --enable true \
  --days-retained 35 \
  --output none

# Enable soft delete on staging storage (7 days)
az storage blob service-properties delete-policy update \
  --account-name "$STORAGE_STAGING" \
  --enable true \
  --days-retained 7 \
  --output none

# ── Service Bus ─────────────────────────────────────────────────────────────────
echo "[4/12] Creating Service Bus namespaces and queues..."
for ENV in prod staging; do
  if [ "$ENV" = "prod" ]; then BUS="$BUS_PROD"; RG="$RG_PROD"; else BUS="$BUS_STAGING"; RG="$RG_STAGING"; fi
  az servicebus namespace create \
    --name "$BUS" \
    --resource-group "$RG" \
    --location "$LOCATION" \
    --sku Standard \
    --output none

  az servicebus queue create \
    --name "$BUS_QUEUE" \
    --namespace-name "$BUS" \
    --resource-group "$RG" \
    --lock-duration PT1M \
    --max-delivery-count 5 \
    --enable-dead-lettering-on-message-expiration true \
    --output none

  az servicebus queue authorization-rule create \
    --name "$BUS_POLICY" \
    --queue-name "$BUS_QUEUE" \
    --namespace-name "$BUS" \
    --resource-group "$RG" \
    --rights Send Listen \
    --output none
done

# ── PostgreSQL ──────────────────────────────────────────────────────────────────
echo "[5/12] Creating PostgreSQL servers (this takes several minutes)..."
az postgres flexible-server create \
  --name "$DB_PROD" \
  --resource-group "$RG_PROD" \
  --location "$LOCATION" \
  --admin-user "$DB_ADMIN" \
  --admin-password "$DB_PASSWORD_PROD" \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose \
  --version 16 \
  --storage-size 32 \
  --backup-retention 35 \
  --geo-redundant-backup Enabled \
  --public-access None \
  --output none

az postgres flexible-server create \
  --name "$DB_STAGING" \
  --resource-group "$RG_STAGING" \
  --location "$LOCATION" \
  --admin-user "$DB_ADMIN" \
  --admin-password "$DB_PASSWORD_STAGING" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --backup-retention 7 \
  --geo-redundant-backup Disabled \
  --public-access None \
  --output none

echo "[6/12] Creating databases..."
az postgres flexible-server db create \
  --database-name "$DB_NAME_PROD" \
  --server-name "$DB_PROD" \
  --resource-group "$RG_PROD" \
  --output none

az postgres flexible-server db create \
  --database-name "$DB_NAME_STAGING" \
  --server-name "$DB_STAGING" \
  --resource-group "$RG_STAGING" \
  --output none

# Enable Azure services access on both DB servers
echo "[7/12] Configuring database firewall..."
az postgres flexible-server firewall-rule create \
  --name "AllowAzureServices" \
  --server-name "$DB_PROD" \
  --resource-group "$RG_PROD" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none

az postgres flexible-server firewall-rule create \
  --name "AllowAzureServices" \
  --server-name "$DB_STAGING" \
  --resource-group "$RG_STAGING" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none

# ── App Service Plans ────────────────────────────────────────────────────────────
echo "[8/12] Creating App Service plans..."
az appservice plan create \
  --name "$PLAN_PROD" \
  --resource-group "$RG_PROD" \
  --location "$LOCATION" \
  --is-linux \
  --sku P1v3 \
  --output none

az appservice plan create \
  --name "$PLAN_STAGING" \
  --resource-group "$RG_STAGING" \
  --location "$LOCATION" \
  --is-linux \
  --sku B2 \
  --output none

# ── API App Services ─────────────────────────────────────────────────────────────
echo "[9/12] Creating API App Services..."
for APP in "$API_PROD" "$API_STAGING"; do
  if [ "$APP" = "$API_PROD" ]; then RG="$RG_PROD"; PLAN="$PLAN_PROD"; else RG="$RG_STAGING"; PLAN="$PLAN_STAGING"; fi
  az webapp create \
    --name "$APP" \
    --resource-group "$RG" \
    --plan "$PLAN" \
    --runtime "NODE:20-lts" \
    --output none
  az webapp config set \
    --name "$APP" \
    --resource-group "$RG" \
    --always-on true \
    --min-tls-version "1.2" \
    --ftps-state Disabled \
    --output none
  az webapp update \
    --name "$APP" \
    --resource-group "$RG" \
    --https-only true \
    --output none
done

# ── Worker App Services ──────────────────────────────────────────────────────────
echo "[10/12] Creating worker App Services..."
for APP in "$WORKER_PROD" "$WORKER_STAGING"; do
  if [ "$APP" = "$WORKER_PROD" ]; then RG="$RG_PROD"; PLAN="$PLAN_PROD"; else RG="$RG_STAGING"; PLAN="$PLAN_STAGING"; fi
  az webapp create \
    --name "$APP" \
    --resource-group "$RG" \
    --plan "$PLAN" \
    --runtime "NODE:20-lts" \
    --output none
  az webapp config set \
    --name "$APP" \
    --resource-group "$RG" \
    --always-on true \
    --startup-file "node src/workers/onboarding-worker.js" \
    --min-tls-version "1.2" \
    --ftps-state Disabled \
    --output none
  az webapp update \
    --name "$APP" \
    --resource-group "$RG" \
    --https-only true \
    --output none
done

# ── Output ───────────────────────────────────────────────────────────────────────
echo "[11/12] Collecting connection strings..."
echo ""
echo "================================================================"
echo "  PROVISIONING COMPLETE — share the following with the dev team"
echo "================================================================"
echo ""
echo "## PRODUCTION"
echo ""

STORAGE_CONN_PROD=$(az storage account show-connection-string \
  --name "$STORAGE_PROD" --resource-group "$RG_PROD" \
  --query connectionString --output tsv)

BUS_CONN_PROD=$(az servicebus queue authorization-rule keys list \
  --name "$BUS_POLICY" --queue-name "$BUS_QUEUE" \
  --namespace-name "$BUS_PROD" --resource-group "$RG_PROD" \
  --query primaryConnectionString --output tsv)

echo "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN_PROD"
echo "AZURE_BLOB_CONTAINER=$BLOB_CONTAINER"
echo "AZURE_SERVICE_BUS_CONNECTION_STRING=$BUS_CONN_PROD"
echo "AZURE_SERVICE_BUS_QUEUE_NAME=$BUS_QUEUE"
echo "DB_HOST=${DB_PROD}.postgres.database.azure.com"
echo "DB_NAME=$DB_NAME_PROD"
echo "DB_USER=$DB_ADMIN"
echo "DB_PASSWORD=$DB_PASSWORD_PROD"
echo ""
echo "API URL:    https://${API_PROD}.azurewebsites.net"
echo "Worker URL: https://${WORKER_PROD}.azurewebsites.net"
echo ""
echo "## STAGING"
echo ""

STORAGE_CONN_STAGING=$(az storage account show-connection-string \
  --name "$STORAGE_STAGING" --resource-group "$RG_STAGING" \
  --query connectionString --output tsv)

BUS_CONN_STAGING=$(az servicebus queue authorization-rule keys list \
  --name "$BUS_POLICY" --queue-name "$BUS_QUEUE" \
  --namespace-name "$BUS_STAGING" --resource-group "$RG_STAGING" \
  --query primaryConnectionString --output tsv)

echo "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN_STAGING"
echo "AZURE_BLOB_CONTAINER=$BLOB_CONTAINER"
echo "AZURE_SERVICE_BUS_CONNECTION_STRING=$BUS_CONN_STAGING"
echo "AZURE_SERVICE_BUS_QUEUE_NAME=$BUS_QUEUE"
echo "DB_HOST=${DB_STAGING}.postgres.database.azure.com"
echo "DB_NAME=$DB_NAME_STAGING"
echo "DB_USER=$DB_ADMIN"
echo "DB_PASSWORD=$DB_PASSWORD_STAGING"
echo ""
echo "API URL:    https://${API_STAGING}.azurewebsites.net"
echo "Worker URL: https://${WORKER_STAGING}.azurewebsites.net"
echo ""
echo "================================================================"
echo "  MANUAL STEPS REMAINING (cannot be scripted)"
echo "================================================================"
echo ""
echo "1. Create Static Web Apps (see section below)"
echo "2. Add dev team's firewall IP to both PostgreSQL servers"
echo "3. Download publish profiles and share as GitHub secrets"
echo "4. Share Static Web App deployment tokens as GitHub secrets"
echo ""
```

---

## Static Web Apps — Manual Creation (Portal)

Static Web Apps require a GitHub connection that is easier to set up through the Portal than the CLI. Do this after the script above has completed.

**Steps (repeat for both production and staging):**

1. Azure Portal → **Static Web Apps** → **Create**
2. Fill in:
   - Resource group: `RG-PCS-ABTI-PROD` (or STAGING)
   - Name: `abti-frontend-prod` (or `abti-frontend-staging`)
   - Plan type: **Free**
   - Region: Same as other resources
   - Source: **GitHub**
   - Organization / Repository: *(dev team will provide the GitHub org and repo name)*
   - Branch: `master` for production, `staging` for staging
   - Build preset: **React**
   - App location: `./frontend`
   - Output location: `dist`
3. Complete creation. Azure will add a GitHub Actions workflow file to the repository automatically.
4. After creation: **Manage deployment token** → copy the token → provide to dev team (stored as a GitHub Actions secret).

---

## Firewall — Dev Machine Access (Temporary)

The dev team needs to connect to the PostgreSQL servers from their local machine to run database migrations. Add a temporary firewall rule on both servers:

**Portal → PostgreSQL server → Networking → Add current client IP address**

Or via CLI (replace IP with the dev team's public IP):
```bash
az postgres flexible-server firewall-rule create \
  --name "DevAccess-ThomasTorvund" \
  --server-name "abti-db-prod" \
  --resource-group "RG-PCS-ABTI-PROD" \
  --start-ip-address <dev-machine-ip> \
  --end-ip-address <dev-machine-ip>

az postgres flexible-server firewall-rule create \
  --name "DevAccess-ThomasTorvund" \
  --server-name "abti-db-staging" \
  --resource-group "RG-PCS-ABTI-STAGING" \
  --start-ip-address <dev-machine-ip> \
  --end-ip-address <dev-machine-ip>
```

This rule can be removed after the initial migrations are run.

---

## What to Hand Back to the Dev Team

After provisioning is complete, the dev team needs the following to configure the application and CI/CD pipelines.

**1. Connection strings (output by the script above)**
```
# Production
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_SERVICE_BUS_CONNECTION_STRING=...
DB_HOST=...
DB_PASSWORD=...

# Staging
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_SERVICE_BUS_CONNECTION_STRING=...
DB_HOST=...
DB_PASSWORD=...
```

**2. GitHub Actions secrets (4 publish profiles + 2 SWA tokens)**

Download publish profiles: Portal → App Service → **Deployment Center** → **Manage publish profile** → Download

| Secret name | Source |
|---|---|
| `AZUREAPPSERVICE_PUBLISHPROFILE_PROD_API` | `abti-api-prod` publish profile |
| `AZUREAPPSERVICE_PUBLISHPROFILE_PROD_WORKER` | `abti-worker-prod` publish profile |
| `AZUREAPPSERVICE_PUBLISHPROFILE_STAGING_API` | `abti-api-staging` publish profile |
| `AZUREAPPSERVICE_PUBLISHPROFILE_STAGING_WORKER` | `abti-worker-staging` publish profile |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` | `abti-frontend-prod` deployment token |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING` | `abti-frontend-staging` deployment token |

---

## Verification Checklist

### Resource Groups
- [ ] `RG-PCS-ABTI-PROD` created with correct tags
- [ ] `RG-PCS-ABTI-STAGING` created with correct tags

### Storage
- [ ] `abtistorageprod` — public blob access disabled, TLS 1.2, ZRS, soft delete 35 days
- [ ] `abtistoragestaging` — public blob access disabled, TLS 1.2, LRS, soft delete 7 days
- [ ] Container `reseller-docs` created in each account with **Private** access

### Service Bus
- [ ] Both namespaces created on **Standard** tier (not Basic)
- [ ] Queue `aeti-onboarding` created in each with lock duration 60s and max delivery count 5
- [ ] Dead-letter queue visible on each queue
- [ ] Queue-scoped policy `app-send-listen` created with Send + Listen only (not Manage)

### PostgreSQL
- [ ] `abti-db-prod` — GeneralPurpose D2s_v3, backup 35 days, geo-redundant, SSL enforced
- [ ] `abti-db-staging` — Burstable B1ms, backup 7 days, SSL enforced
- [ ] Database `abti_onboarding` created on prod server
- [ ] Database `abti_onboarding_staging` created on staging server
- [ ] "Allow Azure services" firewall rule enabled on both servers
- [ ] Dev machine IP firewall rule added on both servers (temporary)

### App Services
- [ ] `abti-plan-prod` (Linux, P1v3) and `abti-plan-staging` (Linux, B2) created
- [ ] `abti-api-prod` — Node 20, Always On, HTTPS Only, TLS 1.2, FTP disabled
- [ ] `abti-worker-prod` — Node 20, Always On, startup command set, HTTPS Only, FTP disabled
- [ ] `abti-api-staging` — same as prod
- [ ] `abti-worker-staging` — same as prod

### Static Web Apps
- [ ] `abti-frontend-prod` linked to `master` branch
- [ ] `abti-frontend-staging` linked to `staging` branch
- [ ] Both deployment tokens copied and ready to share

### Handoff
- [ ] All connection strings collected and shared securely with dev team
- [ ] All 6 GitHub Actions secrets (4 publish profiles + 2 SWA tokens) shared with dev team
