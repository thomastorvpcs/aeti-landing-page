# Azure Infrastructure Requirements
## Apple Business Trade-In — Reseller Onboarding Portal

**Prepared for:** Azure / Infrastructure Team  
**Requested by:** Development Team  
**Date:** April 2026

---

## Overview

The onboarding portal currently runs on AWS (S3 + SQS). This document describes the Azure resources needed to replicate that infrastructure. Once provisioned, the team will need the output connection strings to update the application configuration.

This is a storage and messaging migration only. The application server (Node.js/Express) and database (PostgreSQL) are hosted separately on Render and are not in scope.

---

## Resources Required

### 1. Resource Group

A single resource group to contain all AETI-related Azure resources.

| Setting | Value |
|---------|-------|
| Name | `aeti-rg` (or per naming convention) |
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
| Storage account name | `aetiresellerdocs` *(must be globally unique — adjust if taken)* |
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
| Namespace name | `aeti-onboarding` *(must be globally unique — adjust if taken)* |
| Pricing tier | **Standard** *(required for dead-letter queuing)* |
| Region | Same as resource group |
| Queue name | `onboarding-jobs` |
| Lock duration | 60 seconds |
| Max delivery count | 5 *(messages that fail 5 times are moved to the dead-letter queue)* |
| Dead-lettering on expiration | Yes |
| Message TTL | 7 days (default) |

The lock duration and max delivery count mirror the current SQS visibility timeout and retry settings so the worker logic does not need to change.

---

## Shared Access Policy (Service Bus)

Create a Shared Access Policy on the queue (not the namespace) with **Send + Listen** permissions only. The application does not need Manage rights.

Provide the connection string for this policy to the development team — not the root namespace connection string.

---

## What to Hand Back to the Dev Team

Once provisioned, please provide the following values so the application configuration can be updated:

```
AZURE_STORAGE_CONNECTION_STRING=<storage account connection string>
AZURE_BLOB_CONTAINER=reseller-docs
AZURE_SERVICE_BUS_CONNECTION_STRING=<queue-scoped SAS connection string>
AZURE_SERVICE_BUS_QUEUE_NAME=onboarding-jobs
```

These replace the following AWS variables which can then be removed:
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_ENDPOINT
S3_BUCKET
SQS_QUEUE_URL
```

---

## Security Notes

- **No public blob access** — all documents are private. The application generates short-lived SAS URLs server-side; files are never exposed directly.
- **Managed Identity** — for a production hardening pass, the storage account key and Service Bus connection string can be replaced with Managed Identity bindings to eliminate long-lived credentials entirely. This is recommended but can be done as a follow-up after the initial migration.
- **Service Bus policy scope** — the connection string shared with the app should be scoped to the queue with Send+Listen only, not the full namespace.

---

## Verification Checklist

- [ ] Resource group created
- [ ] Storage account created with public blob access disabled and TLS 1.2 enforced
- [ ] Blob container `reseller-docs` created with private access
- [ ] Service Bus namespace created on Standard tier
- [ ] Queue `onboarding-jobs` created with 60s lock duration and max delivery count of 5
- [ ] Dead-letter queue visible on the Service Bus queue
- [ ] Queue-scoped Shared Access Policy created with Send + Listen only
- [ ] Connection strings handed back to dev team
