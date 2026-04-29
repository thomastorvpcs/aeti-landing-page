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
| **Virtual Network** | **`abti-vnet-prod`** | *(not required — see note)* |
| Static Web App | `abti-frontend-prod` | `abti-frontend-staging` |
| App Service Plan | `abti-plan-prod` | `abti-plan-staging` |
| API App Service | `abti-api-prod` | `abti-api-staging` |
| Worker App Service | `abti-worker-prod` | `abti-worker-staging` |
| PostgreSQL Server | `abti-db-prod` | `abti-db-staging` |
| PostgreSQL Database | `abti_onboarding` | `abti_onboarding_staging` |
| Storage Account | `abtistorageprod` | `abtistoragestaging` |
| Blob Container | `reseller-docs` | `reseller-docs` |
| Service Bus Namespace | `abti-bus-prod` | `abti-bus-staging` |
| Service Bus Queue | `aeti-onboarding` | `aeti-onboarding` |

> **Note on VNet:** Production uses a private Virtual Network so the database has no public internet exposure. Staging uses public access with IP firewall rules — staging does not hold real customer data and the B2 App Service Plan does not support VNet Integration.

> **Note on resource names:** Names ending in `.azurewebsites.net` or `.azurestaticapps.net` must be globally unique across all Azure customers. Adjust names if any are already taken — the dev team will update the application configuration to match whatever names are chosen.

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

### Virtual Network — Production Only

The production database must not be reachable from the public internet. A Virtual Network with two subnets isolates it completely — the App Services connect through VNet Integration and the database has no public endpoint.

| Setting | Value |
|---|---|
| VNet name | `abti-vnet-prod` |
| Resource group | `RG-PCS-ABTI-PROD` |
| Address space | `10.0.0.0/16` |

**Subnets:**

| Subnet name | Address range | Purpose |
|---|---|---|
| `subnet-appservice` | `10.0.1.0/24` | App Service Regional VNet Integration (outbound traffic from API + worker) |
| `subnet-postgres` | `10.0.2.0/24` | PostgreSQL Flexible Server VNet injection (delegated to `Microsoft.DBforPostgreSQL/flexibleServers`) |

**Private DNS Zone:**

| Setting | Value |
|---|---|
| Zone name | `abti-db-prod.private.postgres.database.azure.com` |
| Linked VNet | `abti-vnet-prod` |

This DNS zone allows the App Services (inside the VNet) to resolve the PostgreSQL hostname to its private IP rather than a public address.

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

| Setting | Production | Staging |
|---|---|---|
| Server name | `abti-db-prod` | `abti-db-staging` |
| PostgreSQL version | 16 | 16 |
| Compute tier | General Purpose — D2s_v3 (2 vCores) | Burstable — B1ms |
| Admin username | `abtidbadmin` | `abtidbadmin` |
| Admin password | Generate strong password — store in Key Vault | Generate separate password |
| Storage | 32 GB, auto-grow enabled | 32 GB |
| Backup retention | **35 days** | 7 days |
| Geo-redundant backup | **Yes** | No |
| SSL enforcement | **Enabled** | Enabled |
| **Connectivity** | **Private — VNet integration (no public endpoint)** | Public — IP firewall rules |

**Databases to create on each server:**

| Server | Database name |
|---|---|
| `abti-db-prod` | `abti_onboarding` |
| `abti-db-staging` | `abti_onboarding_staging` |

> **Production connectivity:** The production server is deployed directly into `subnet-postgres` using Flexible Server VNet injection. It has no public endpoint — it is not reachable from the internet under any circumstances. The App Services connect to it via VNet Integration through `subnet-appservice`. No IP firewall rules are needed or used.

> **Staging connectivity:** The staging server uses public access with IP firewall rules — see the Network Security section below.

The dev team will run database migrations after provisioning. For production, this requires temporary access via the Azure Bastion or a temporary firewall exception — see the Network Security section.

---

### App Service Plan

One plan per environment. Both App Services (API + worker) share a plan within the same environment.

| Setting | Production | Staging |
|---|---|---|
| Plan name | `abti-plan-prod` | `abti-plan-staging` |
| OS | **Linux** | Linux |
| SKU | **P1v3** (Premium v3) | B2 (Basic) |
| Region | Same as resource group | Same |
| VNet Integration support | **Yes — required** | No (B2 does not support it) |

> P1v3 is required for production — it is the minimum tier that supports Regional VNet Integration, which is needed to connect to the private database.

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
| **VNet Integration (prod only)** | **Subnet: `subnet-appservice` in `abti-vnet-prod`** |

No startup command needed — the app reads the `package.json` `start` script automatically.

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
| **VNet Integration (prod only)** | **Subnet: `subnet-appservice` in `abti-vnet-prod`** |

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

## Network Security

### Production — Fully Private Database

The production PostgreSQL server has **no public endpoint**. Network access works as follows:

```
Internet → App Service (public HTTPS) → VNet Integration → subnet-appservice
                                                              ↓
                                                        subnet-postgres
                                                              ↓
                                                    abti-db-prod (private IP only)
```

No IP firewall rules are created on the production database. The server is not reachable from outside the VNet under any circumstances.

**Running database migrations (one-time, after provisioning):**

The dev team needs temporary access to run the initial database migrations. Two options — choose one:

**Option A — Temporary firewall exception (simpler):**
1. Temporarily enable public access on the PostgreSQL server
2. Add the dev team's IP as a firewall rule
3. Run migrations
4. Disable public access again

Via CLI:
```bash
# Enable temporarily
az postgres flexible-server update \
  --name "abti-db-prod" --resource-group "RG-PCS-ABTI-PROD" \
  --public-access Enabled

az postgres flexible-server firewall-rule create \
  --name "TempDevAccess" --server-name "abti-db-prod" \
  --resource-group "RG-PCS-ABTI-PROD" \
  --start-ip-address <dev-ip> --end-ip-address <dev-ip>

# Dev team runs migrations, then:
az postgres flexible-server update \
  --name "abti-db-prod" --resource-group "RG-PCS-ABTI-PROD" \
  --public-access Disabled
```

**Option B — Azure Bastion (more secure, more setup):**
Set up an Azure Bastion host and a small VM inside the VNet. The dev team connects via Bastion, runs migrations from the VM, then the VM can be deleted.

---

### Staging — Public Access with IP Firewall

The staging database uses public access restricted to known IP addresses.

| Firewall rule | IP | Purpose |
|---|---|---|
| `AllowAzureServices` | 0.0.0.0 (built-in toggle) | Allows staging App Services to connect |
| `DevAccess-Thomas` | Thomas's office/dev IP | Allows running migrations from dev machine |

> Enable **"Allow access to Azure services"** in the PostgreSQL networking settings. This covers all App Service outbound IPs. The dev team's IP can be removed after initial migrations are complete.

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

# Virtual Network (production only)
VNET_PROD="abti-vnet-prod"
SUBNET_APPSERVICE="subnet-appservice"
SUBNET_POSTGRES="subnet-postgres"

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

# ── [1] Resource Groups ─────────────────────────────────────────────────────────
echo "[1/14] Creating resource groups..."
az group create \
  --name "$RG_PROD" --location "$LOCATION" \
  --tags OWNER="$OWNER" PURPOSE="$PURPOSE" ENV="PROD" \
  --output none

az group create \
  --name "$RG_STAGING" --location "$LOCATION" \
  --tags OWNER="$OWNER" PURPOSE="$PURPOSE" ENV="STAGING" \
  --output none

# ── [2] Virtual Network — Production Only ───────────────────────────────────────
echo "[2/14] Creating production VNet and subnets..."
az network vnet create \
  --name "$VNET_PROD" \
  --resource-group "$RG_PROD" \
  --location "$LOCATION" \
  --address-prefix "10.0.0.0/16" \
  --output none

# Subnet for App Service Regional VNet Integration (outbound from API + worker)
az network vnet subnet create \
  --name "$SUBNET_APPSERVICE" \
  --vnet-name "$VNET_PROD" \
  --resource-group "$RG_PROD" \
  --address-prefix "10.0.1.0/24" \
  --output none

# Subnet for PostgreSQL — must be delegated to flexibleServers
az network vnet subnet create \
  --name "$SUBNET_POSTGRES" \
  --vnet-name "$VNET_PROD" \
  --resource-group "$RG_PROD" \
  --address-prefix "10.0.2.0/24" \
  --delegations "Microsoft.DBforPostgreSQL/flexibleServers" \
  --output none

# ── [3] Private DNS Zone for Production PostgreSQL ──────────────────────────────
echo "[3/14] Creating private DNS zone for production database..."
DNS_ZONE="${DB_PROD}.private.postgres.database.azure.com"

az network private-dns zone create \
  --resource-group "$RG_PROD" \
  --name "$DNS_ZONE" \
  --output none

az network private-dns link vnet create \
  --resource-group "$RG_PROD" \
  --zone-name "$DNS_ZONE" \
  --name "dns-link-${VNET_PROD}" \
  --virtual-network "$VNET_PROD" \
  --registration-enabled false \
  --output none

# ── [4] Storage Accounts ────────────────────────────────────────────────────────
echo "[4/14] Creating storage accounts..."
az storage account create \
  --name "$STORAGE_PROD" --resource-group "$RG_PROD" --location "$LOCATION" \
  --sku Standard_ZRS --kind StorageV2 \
  --https-only true --allow-blob-public-access false --min-tls-version TLS1_2 \
  --output none

az storage account create \
  --name "$STORAGE_STAGING" --resource-group "$RG_STAGING" --location "$LOCATION" \
  --sku Standard_LRS --kind StorageV2 \
  --https-only true --allow-blob-public-access false --min-tls-version TLS1_2 \
  --output none

# ── [5] Blob Containers ─────────────────────────────────────────────────────────
echo "[5/14] Creating blob containers..."
for PAIR in "${STORAGE_PROD}:${RG_PROD}" "${STORAGE_STAGING}:${RG_STAGING}"; do
  STORAGE_NAME="${PAIR%%:*}"
  RG="${PAIR##*:}"
  STORAGE_KEY=$(az storage account keys list \
    --account-name "$STORAGE_NAME" --resource-group "$RG" \
    --query "[0].value" --output tsv)
  az storage container create \
    --name "$BLOB_CONTAINER" --account-name "$STORAGE_NAME" \
    --account-key "$STORAGE_KEY" --public-access off --output none
done

az storage blob service-properties delete-policy update \
  --account-name "$STORAGE_PROD" --enable true --days-retained 35 --output none

az storage blob service-properties delete-policy update \
  --account-name "$STORAGE_STAGING" --enable true --days-retained 7 --output none

# ── [6] Service Bus ─────────────────────────────────────────────────────────────
echo "[6/14] Creating Service Bus namespaces and queues..."
for PAIR in "${BUS_PROD}:${RG_PROD}" "${BUS_STAGING}:${RG_STAGING}"; do
  BUS="${PAIR%%:*}"
  RG="${PAIR##*:}"
  az servicebus namespace create \
    --name "$BUS" --resource-group "$RG" --location "$LOCATION" \
    --sku Standard --output none
  az servicebus queue create \
    --name "$BUS_QUEUE" --namespace-name "$BUS" --resource-group "$RG" \
    --lock-duration PT1M --max-delivery-count 5 \
    --enable-dead-lettering-on-message-expiration true --output none
  az servicebus queue authorization-rule create \
    --name "$BUS_POLICY" --queue-name "$BUS_QUEUE" \
    --namespace-name "$BUS" --resource-group "$RG" \
    --rights Send Listen --output none
done

# ── [7] PostgreSQL — Production (private, VNet-injected) ────────────────────────
echo "[7/14] Creating production PostgreSQL server (takes several minutes)..."
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
  --vnet "$VNET_PROD" \
  --subnet "$SUBNET_POSTGRES" \
  --private-dns-zone "$DNS_ZONE" \
  --output none
# Note: --vnet/--subnet deploys the server into the VNet with no public endpoint.
# No firewall rules are needed or created for production.

az postgres flexible-server db create \
  --database-name "$DB_NAME_PROD" --server-name "$DB_PROD" \
  --resource-group "$RG_PROD" --output none

# ── [8] PostgreSQL — Staging (public access, IP firewall) ───────────────────────
echo "[8/14] Creating staging PostgreSQL server (takes several minutes)..."
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
  --public-access Enabled \
  --output none

az postgres flexible-server db create \
  --database-name "$DB_NAME_STAGING" --server-name "$DB_STAGING" \
  --resource-group "$RG_STAGING" --output none

# Allow Azure services (covers staging App Service outbound IPs)
az postgres flexible-server firewall-rule create \
  --name "AllowAzureServices" --server-name "$DB_STAGING" \
  --resource-group "$RG_STAGING" \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 --output none

# ── [9] App Service Plans ────────────────────────────────────────────────────────
echo "[9/14] Creating App Service plans..."
# P1v3 required for production — supports Regional VNet Integration
az appservice plan create \
  --name "$PLAN_PROD" --resource-group "$RG_PROD" --location "$LOCATION" \
  --is-linux --sku P1v3 --output none

az appservice plan create \
  --name "$PLAN_STAGING" --resource-group "$RG_STAGING" --location "$LOCATION" \
  --is-linux --sku B2 --output none

# ── [10] API App Services ────────────────────────────────────────────────────────
echo "[10/14] Creating API App Services..."
for PAIR in "${API_PROD}:${RG_PROD}:${PLAN_PROD}" "${API_STAGING}:${RG_STAGING}:${PLAN_STAGING}"; do
  APP="${PAIR%%:*}"; REST="${PAIR#*:}"; RG="${REST%%:*}"; PLAN="${REST##*:}"
  az webapp create --name "$APP" --resource-group "$RG" --plan "$PLAN" \
    --runtime "NODE:20-lts" --output none
  az webapp config set --name "$APP" --resource-group "$RG" \
    --always-on true --min-tls-version "1.2" --ftps-state Disabled --output none
  az webapp update --name "$APP" --resource-group "$RG" \
    --https-only true --output none
done

# ── [11] Worker App Services ─────────────────────────────────────────────────────
echo "[11/14] Creating worker App Services..."
for PAIR in "${WORKER_PROD}:${RG_PROD}:${PLAN_PROD}" "${WORKER_STAGING}:${RG_STAGING}:${PLAN_STAGING}"; do
  APP="${PAIR%%:*}"; REST="${PAIR#*:}"; RG="${REST%%:*}"; PLAN="${REST##*:}"
  az webapp create --name "$APP" --resource-group "$RG" --plan "$PLAN" \
    --runtime "NODE:20-lts" --output none
  az webapp config set --name "$APP" --resource-group "$RG" \
    --always-on true --startup-file "node src/workers/onboarding-worker.js" \
    --min-tls-version "1.2" --ftps-state Disabled --output none
  az webapp update --name "$APP" --resource-group "$RG" \
    --https-only true --output none
done

# ── [12] VNet Integration — Production App Services Only ─────────────────────────
echo "[12/14] Attaching production App Services to VNet..."
# This routes all outbound traffic from the App Services through the VNet,
# allowing them to reach the private PostgreSQL server.
az webapp vnet-integration add \
  --name "$API_PROD" --resource-group "$RG_PROD" \
  --vnet "$VNET_PROD" --subnet "$SUBNET_APPSERVICE" --output none

az webapp vnet-integration add \
  --name "$WORKER_PROD" --resource-group "$RG_PROD" \
  --vnet "$VNET_PROD" --subnet "$SUBNET_APPSERVICE" --output none

# ── [13] Output ───────────────────────────────────────────────────────────────────
echo "[13/14] Collecting connection strings..."
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
echo "1. Create Static Web Apps via Portal (see section below)"
echo "2. Add dev team's IP to staging PostgreSQL firewall"
echo "3. Grant dev team temporary access to production DB for migrations"
echo "4. Download publish profiles and share as GitHub secrets"
echo "5. Share Static Web App deployment tokens as GitHub secrets"
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

### Virtual Network (Production)
- [ ] `abti-vnet-prod` created with address space `10.0.0.0/16`
- [ ] `subnet-appservice` (10.0.1.0/24) created — no delegation
- [ ] `subnet-postgres` (10.0.2.0/24) created — delegated to `Microsoft.DBforPostgreSQL/flexibleServers`
- [ ] Private DNS zone `abti-db-prod.private.postgres.database.azure.com` created
- [ ] DNS zone linked to `abti-vnet-prod`

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
- [ ] `abti-db-prod` — GeneralPurpose D2s_v3, backup 35 days, geo-redundant, SSL enforced, **no public endpoint**, deployed into `subnet-postgres`
- [ ] `abti-db-staging` — Burstable B1ms, backup 7 days, SSL enforced, public access with firewall
- [ ] Database `abti_onboarding` created on prod server
- [ ] Database `abti_onboarding_staging` created on staging server
- [ ] Staging: `AllowAzureServices` firewall rule enabled

### App Services
- [ ] `abti-plan-prod` (Linux, P1v3) and `abti-plan-staging` (Linux, B2) created
- [ ] `abti-api-prod` — Node 20, Always On, HTTPS Only, TLS 1.2, FTP disabled, **VNet Integration to `subnet-appservice`**
- [ ] `abti-worker-prod` — Node 20, Always On, startup command set, HTTPS Only, FTP disabled, **VNet Integration to `subnet-appservice`**
- [ ] `abti-api-staging` — Node 20, Always On, HTTPS Only, TLS 1.2, FTP disabled
- [ ] `abti-worker-staging` — Node 20, Always On, startup command set, HTTPS Only, FTP disabled
- [ ] Verify production App Services can reach `abti-db-prod` through the VNet (dev team confirms after deploying)

### Static Web Apps
- [ ] `abti-frontend-prod` linked to `master` branch
- [ ] `abti-frontend-staging` linked to `staging` branch
- [ ] Both deployment tokens copied and ready to share

### Handoff
- [ ] All connection strings collected and shared securely with dev team
- [ ] All 6 GitHub Actions secrets (4 publish profiles + 2 SWA tokens) shared with dev team
- [ ] Temporary production DB access arranged with dev team for running initial migrations
- [ ] Dev team's IP added to staging PostgreSQL firewall
