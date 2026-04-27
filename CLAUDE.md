# AETI Landing Page — Project Overview

## Git Workflow

After completing any code change, always commit and push automatically without waiting to be asked. Use a concise, descriptive commit message.

## Tech Stack

### Frontend
- **React 18** with **Vite**
- **Tailwind CSS**
- **Axios** — HTTP client
- **react-dropzone** — file upload UI

### Backend
- **Node.js / Express**
- **PostgreSQL** (`pg`) — primary database
- **Azure Blob Storage** — file storage (W-9, bank letter, vendor setup form PDFs)
- **Azure Service Bus** — job queue for async onboarding processing
- **PDFKit** — PDF generation
- **Carbone** — template-based document generation
- **SendGrid** — transactional email
- **Multer** — multipart file upload (buffered in memory, uploaded to Azure)
- **Helmet + express-rate-limit** — security middleware
- **JWT** (`jsonwebtoken`) — auth tokens
- **NetSuite REST API** — vendor creation (via Axios)

---

## Architecture

**Async-first:** Form submission returns `202 Accepted` immediately and enqueues an Azure Service Bus job. All integration work (NetSuite, Acrobat Sign, email) happens in the worker process.

**Idempotent submissions:** EIN is a unique key — resubmissions update rather than duplicate.

**File handling:** Multer buffers uploads in memory and streams them to Azure Blob Storage (no temp files on disk).

**Polling fallback:** Worker polls Acrobat Sign every 5 minutes to catch missed webhook events.

---

## Naming Conventions

| Context | Convention |
|---|---|
| Database columns | `snake_case` |
| JS functions & variables | `camelCase` |
| Constants / env vars | `SCREAMING_SNAKE_CASE` |
| Job types | `SCREAMING_SNAKE_CASE` (e.g. `RESELLER_SUBMITTED`, `NDA_COMPLETED`) |
| React components | `PascalCase` |
| File names | `kebab-case` (e.g. `acrobat-sign.js`, `rate-limit.js`) |
| Blob keys | `snake_case` filenames under `resellers/{id}/` |

---

## Blob Key Structure

```
resellers/{resellerId}/w9.{ext}
resellers/{resellerId}/bank_letter.{ext}
resellers/{resellerId}/vendor_setup_form.pdf
resellers/{resellerId}/signed_nda.pdf
```

All files are private (no public URLs). Access via short-lived SAS tokens.

---

## Worker Job Types

| Job | Trigger | Actions |
|---|---|---|
| `RESELLER_SUBMITTED` | Form submission | Create NetSuite vendor → upload vendor setup form PDF → create finance task → send NDA via Acrobat Sign → send internal alert |
| `NDA_COMPLETED` | Acrobat Sign webhook or polling | Download signed NDA → archive to Azure Blob Storage → send welcome email with authorization letter |

Worker uses exponential backoff retry (max 5 attempts, 2s base). Messages are acknowledged after max retries to avoid infinite loops.

---

## Integration Auth Methods

| Service | Auth Method |
|---|---|
| NetSuite | OAuth 1.0a TBA (HMAC-SHA256 signed header per request) |
| Acrobat Sign | OAuth 2.0 refresh token (access token cached, refreshed 60s before expiry) |
| DocuSign | JWT Grant with RSA private key (legacy/backup path) |
| SendGrid | API key (Bearer token) |
| Azure Blob / Service Bus | Connection string via env vars (use Managed Identity in prod) |

**Webhook verification:**
- Acrobat Sign: client ID echo only (no signature verification yet)

---

## Error Handling Pattern

- All integrations retry up to 5x with exponential backoff via `withRetry()`
- Webhook handlers always return `200` even on processing errors (prevents vendor retries)
- Form submission validates server-side and returns `422` with missing field list
- Rate limit: 5 submissions/hour per IP on `/api/submit`

---

## Key Environment Variables

See `.env.example` for full list. Key groups:

- `DB_*` / `DATABASE_URL` — PostgreSQL connection
- `AZURE_STORAGE_*`, `AZURE_SERVICE_BUS_*` — Azure storage and queue
- `NETSUITE_*` — account ID, OAuth 1.0a credentials, subsidiary/employee IDs
- `ACROBAT_*` — client credentials, refresh token, NDA template ID
- `SENDGRID_*` — API key, from address, template IDs
- `PCS_OPS_EMAIL`, `PCS_LEGAL_EMAIL` — internal routing
